"""
Outcome Attribution Engine: connects signals → actions → approvals → executions → outcomes.
Builds traceable attribution records for every meaningful path through the system.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AttributionRecord,
    Business,
    Campaign,
    CampaignStatus,
    Export,
    ExportStatus,
    IntegrationEvent,
    IntegrationEventStatus,
    Lead,
    LeadStatus,
    PublishLog,
)

logger = logging.getLogger(__name__)


def build_attribution_records(db: Session, business: Business) -> int:
    """
    Scan recent approvals and executions to create attribution records that trace
    the full path: signal → action → approval → execution → outcome.
    Returns the number of new records created.
    """
    created = 0
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7)

    # Find executed approvals that don't yet have attribution records
    executed_approvals = (
        db.query(Approval)
        .filter(
            Approval.business_id == business.id,
            Approval.status == ApprovalStatus.EXECUTED,
            Approval.decided_at >= cutoff,
        )
        .all()
    )

    existing_approval_ids = set(
        row[0]
        for row in db.query(AttributionRecord.approval_id)
        .filter(
            AttributionRecord.business_id == business.id,
            AttributionRecord.approval_id.isnot(None),
        )
        .all()
    )

    for approval in executed_approvals:
        if approval.id in existing_approval_ids:
            continue

        action = db.get(Action, approval.action_id)
        if not action:
            continue

        record = _build_record_from_action(db, business, action, approval)
        if record:
            db.add(record)
            created += 1

    # Attribute lead conversions (leads that moved to CLOSED)
    closed_leads = (
        db.query(Lead)
        .filter(
            Lead.business_id == business.id,
            Lead.status == LeadStatus.CLOSED,
            Lead.created_at >= cutoff,
        )
        .all()
    )

    existing_lead_signals = set(
        row[0]
        for row in db.query(AttributionRecord.signal_id)
        .filter(
            AttributionRecord.business_id == business.id,
            AttributionRecord.signal_type == "lead",
            AttributionRecord.outcome_type == "lead_converted",
        )
        .all()
    )

    for lead in closed_leads:
        if lead.id in existing_lead_signals:
            continue
        db.add(AttributionRecord(
            business_id=business.id,
            signal_type="lead",
            signal_id=lead.id,
            outcome_type="lead_converted",
            outcome_data={
                "intent": lead.intent.value,
                "score": lead.score,
                "confidence": lead.confidence,
                "mention_id": str(lead.mention_id) if lead.mention_id else None,
            },
        ))
        created += 1

    if created > 0:
        db.commit()

    return created


def _build_record_from_action(
    db: Session,
    business: Business,
    action: Action,
    approval: Approval,
) -> AttributionRecord | None:
    """Build an attribution record by tracing from action → signal and action → execution → outcome."""
    payload = action.payload or {}

    signal_type = _infer_signal_type(action, payload)
    signal_id = _extract_signal_id(payload)
    execution_type = _infer_execution_type(action)
    execution_id = None
    outcome_type = None
    outcome_data = {}

    # Trace execution outcomes
    if action.type == ActionType.CAMPAIGN_DRAFT:
        campaign_id_str = payload.get("campaign_id")
        if campaign_id_str:
            from uuid import UUID
            try:
                campaign = db.get(Campaign, UUID(campaign_id_str))
                if campaign:
                    execution_id = campaign.id
                    if campaign.status in (CampaignStatus.PUBLISHED, CampaignStatus.EXECUTED):
                        outcome_type = "campaign_published" if campaign.status == CampaignStatus.PUBLISHED else "campaign_executed"
                        outcome_data = {
                            "campaign_name": campaign.name,
                            "status": campaign.status.value,
                            "budget": campaign.draft.get("budget_suggestion") if campaign.draft else None,
                        }
            except (ValueError, TypeError):
                pass

    elif action.type == ActionType.CAMPAIGN_PUBLISH:
        campaign_id_str = payload.get("campaign_id")
        if campaign_id_str:
            from uuid import UUID
            try:
                log = (
                    db.query(PublishLog)
                    .filter(PublishLog.campaign_id == UUID(campaign_id_str))
                    .order_by(PublishLog.created_at.desc())
                    .first()
                )
                if log:
                    execution_id = log.id
                    outcome_type = "campaign_published" if log.status == "PUBLISHED" else "campaign_publish_failed"
                    outcome_data = {
                        "platform": log.platform,
                        "external_id": log.external_id,
                        "status": log.status,
                    }
            except (ValueError, TypeError):
                pass

    elif action.type == ActionType.EXPORT:
        export_id_str = payload.get("export_id")
        if export_id_str:
            from uuid import UUID
            try:
                export = db.get(Export, UUID(export_id_str))
                if export:
                    execution_id = export.id
                    outcome_type = "export_completed" if export.status == ExportStatus.READY else "export_pending"
                    outcome_data = {"export_type": export.type.value, "status": export.status.value}
            except (ValueError, TypeError):
                pass

    elif action.type == ActionType.CRM_SYNC:
        execution_type = "crm_sync"
        # Find the integration event
        crm_query = (
            db.query(IntegrationEvent)
            .filter(
                IntegrationEvent.business_id == business.id,
                IntegrationEvent.event_type == "crm_sync",
            )
        )
        if approval.decided_at:
            crm_query = crm_query.filter(
                IntegrationEvent.created_at >= approval.decided_at - timedelta(minutes=5),
            )
        event = crm_query.order_by(IntegrationEvent.created_at.desc()).first()
        if event:
            execution_id = event.id
            outcome_type = "crm_synced" if event.status == IntegrationEventStatus.SENT else "crm_sync_failed"
            outcome_data = {"status": event.status.value}

    elif action.type == ActionType.REPLY_DRAFT:
        execution_type = "reply_draft"
        outcome_type = "reply_drafted"
        outcome_data = {"lead_id": payload.get("lead_id"), "reply_text": (payload.get("reply_text") or "")[:100]}

    return AttributionRecord(
        business_id=business.id,
        signal_type=signal_type,
        signal_id=signal_id,
        action_id=action.id,
        approval_id=approval.id,
        execution_type=execution_type,
        execution_id=execution_id,
        outcome_type=outcome_type,
        outcome_data=outcome_data,
    )


def _infer_signal_type(action: Action, payload: dict) -> str:
    """Infer signal type from the action."""
    if payload.get("mention_id"):
        return "mention"
    if payload.get("lead_id"):
        return "lead"
    if payload.get("trend_id"):
        return "trend"
    if payload.get("competitor_event_id"):
        return "competitor_event"
    if payload.get("review_id"):
        return "review"
    if payload.get("recommendation_id"):
        return "optimization"
    # Default based on action type
    return {
        ActionType.REPLY_DRAFT: "lead",
        ActionType.AUDIENCE_DRAFT: "lead",
        ActionType.CAMPAIGN_DRAFT: "campaign",
        ActionType.CAMPAIGN_PUBLISH: "campaign",
        ActionType.EXPORT: "audience",
        ActionType.CRM_SYNC: "lead",
    }.get(action.type, "unknown")


def _extract_signal_id(payload: dict):
    """Extract the most relevant signal UUID from payload."""
    from uuid import UUID
    for key in ("mention_id", "lead_id", "trend_id", "competitor_event_id", "review_id", "campaign_id"):
        val = payload.get(key)
        if val:
            try:
                return UUID(str(val))
            except (ValueError, TypeError):
                pass
    return None


def _infer_execution_type(action: Action) -> str | None:
    return {
        ActionType.CAMPAIGN_DRAFT: "campaign_execute",
        ActionType.CAMPAIGN_PUBLISH: "campaign_publish",
        ActionType.EXPORT: "export",
        ActionType.CRM_SYNC: "crm_sync",
        ActionType.REPLY_DRAFT: "reply_draft",
        ActionType.AUDIENCE_DRAFT: "audience_draft",
    }.get(action.type)
