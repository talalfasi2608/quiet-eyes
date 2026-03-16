import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped, get_current_user, require_permission
from app.quota import check_quota, increment_usage
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    CompetitorEvent,
    Lead,
    LeadStatus,
    Mention,
    Permission,
    Review,
    ReviewSentiment,
    Trend,
    User,
)
from app.schemas import ApprovalOut, FeedItemOut, LeadOut, MentionOut

router = APIRouter(tags=["feed"])


@router.get("/businesses/{business_id}/feed")
def get_feed(
    tab: str = Query("recommended", pattern="^(recommended|needs_approval)$"),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
) -> list[Any]:
    if tab == "recommended":
        items: list[FeedItemOut] = []

        # Leads
        leads = (
            db.query(Lead)
            .options(joinedload(Lead.mention).joinedload("source"))
            .filter(Lead.business_id == biz.id, Lead.status == LeadStatus.NEW)
            .order_by(Lead.score.desc())
            .limit(20)
            .all()
        )
        for l in leads:
            mention = l.mention
            items.append(FeedItemOut(
                type="lead",
                id=l.id,
                title=mention.title if mention else l.intent.value,
                why_it_matters=f"{l.intent.value} intent detected with score {l.score}",
                evidence_urls=[mention.url] if mention and mention.url else [],
                confidence=l.confidence,
                primary_action="REPLY_DRAFT",
                created_at=l.created_at,
                data={
                    "intent": l.intent.value,
                    "score": l.score,
                    "suggested_reply": l.suggested_reply,
                    "snippet": mention.snippet if mention else None,
                    "mention_id": str(l.mention_id) if l.mention_id else None,
                },
            ))

        # Trends
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        trends = (
            db.query(Trend)
            .filter(Trend.business_id == biz.id, Trend.created_at >= cutoff)
            .order_by(Trend.spike_score.desc())
            .limit(10)
            .all()
        )
        for t in trends:
            items.append(FeedItemOut(
                type="trend",
                id=t.id,
                title=f"Trending: {t.topic}",
                why_it_matters=f"Topic spike score {t.spike_score} — mentioned significantly more in the last 3 days",
                evidence_urls=t.evidence_urls or [],
                confidence=min(100, t.spike_score),
                primary_action="AUDIENCE_CAMPAIGN",
                created_at=t.created_at,
                data={
                    "topic": t.topic,
                    "spike_score": t.spike_score,
                    "window_days": t.window_days,
                },
            ))

        # Competitor events
        comp_events = (
            db.query(CompetitorEvent)
            .filter(CompetitorEvent.business_id == biz.id, CompetitorEvent.created_at >= cutoff)
            .order_by(CompetitorEvent.detected_at.desc())
            .limit(10)
            .all()
        )
        for ce in comp_events:
            items.append(FeedItemOut(
                type="competitor_event",
                id=ce.id,
                title=f"Competitor: {ce.event_type.value.replace('_', ' ').title()}",
                why_it_matters=ce.summary or "Competitor activity detected",
                evidence_urls=ce.evidence_urls or [],
                confidence=65,
                primary_action="COUNTER_CAMPAIGN",
                created_at=ce.created_at,
                data={
                    "event_type": ce.event_type.value,
                    "competitor_id": str(ce.competitor_id),
                    "summary": ce.summary,
                },
            ))

        # Reviews (negative highlighted)
        reviews = (
            db.query(Review)
            .filter(Review.business_id == biz.id, Review.created_at >= cutoff)
            .order_by(Review.created_at.desc())
            .limit(10)
            .all()
        )
        for r in reviews:
            items.append(FeedItemOut(
                type="review",
                id=r.id,
                title=f"Review: {r.sentiment.value} sentiment" + (f" ({r.rating}/5)" if r.rating else ""),
                why_it_matters=r.text[:200] if r.text else "New review detected",
                evidence_urls=[r.url] if r.url else [],
                confidence=70 if r.sentiment == ReviewSentiment.NEG else 50,
                primary_action="REPLY_DRAFT" if r.sentiment == ReviewSentiment.NEG else None,
                created_at=r.created_at,
                data={
                    "sentiment": r.sentiment.value,
                    "rating": r.rating,
                    "author": r.author,
                    "text": r.text[:500] if r.text else None,
                },
            ))

        # Sort all items by confidence (descending), then by created_at
        items.sort(key=lambda x: (x.confidence, x.created_at.timestamp()), reverse=True)

        if items:
            return items[:50]

        # Fall back to recent mentions as feed cards
        mentions = (
            db.query(Mention)
            .options(joinedload(Mention.source))
            .filter(Mention.business_id == biz.id)
            .order_by(Mention.fetched_at.desc())
            .limit(50)
            .all()
        )
        return [MentionOut.model_validate(m) for m in mentions]
    else:
        leads = (
            db.query(Lead)
            .options(joinedload(Lead.mention))
            .filter(
                Lead.business_id == biz.id,
                Lead.status.in_([LeadStatus.SAVED, LeadStatus.SENT]),
            )
            .limit(50)
            .all()
        )
        return [LeadOut.model_validate(l) for l in leads]


@router.get("/businesses/{business_id}/approvals", response_model=list[ApprovalOut])
def list_approvals(
    status: ApprovalStatus | None = None,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Approval)
        .options(joinedload(Approval.action))
        .filter(Approval.business_id == biz.id)
    )
    if status:
        query = query.filter(Approval.status == status)
    return query.order_by(Approval.priority_score.desc(), Approval.created_at.desc()).limit(50).all()


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalOut)
def approve(
    approval_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.APPROVE_ACTIONS)),
):
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    biz = db.get(Business, approval.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval is not pending")

    check_quota(db, biz.org_id, "approval")

    now = datetime.now(timezone.utc)

    # Mark APPROVED then immediately EXECUTED (stub execution)
    approval.status = ApprovalStatus.EXECUTED
    approval.decided_at = now

    # Audit: approval
    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="APPROVAL_APPROVED",
        entity_type="approval",
        entity_id=approval.id,
        meta={"action_id": str(approval.action_id)},
    ))

    # Audit: execution
    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="ACTION_EXECUTED",
        entity_type="action",
        entity_id=approval.action_id,
        meta={"approval_id": str(approval.id), "execution": "stub"},
    ))

    increment_usage(db, biz.org_id, "approval")
    db.commit()

    # Execute side-effects by action type
    action = db.get(Action, approval.action_id)
    if action and action.payload:
        import uuid as _uuid
        if action.type == ActionType.EXPORT:
            export_id_str = action.payload.get("export_id")
            if export_id_str:
                from app.routers.audiences import execute_export
                try:
                    execute_export(db, _uuid.UUID(export_id_str))
                except Exception:
                    pass  # export failure is non-blocking
        elif action.type == ActionType.CAMPAIGN_DRAFT:
            campaign_id_str = action.payload.get("campaign_id")
            if campaign_id_str:
                from app.routers.campaigns import execute_campaign
                try:
                    execute_campaign(db, _uuid.UUID(campaign_id_str), user)
                except Exception:
                    pass  # campaign execution failure is non-blocking
        elif action.type == ActionType.CRM_SYNC:
            from app.routers.integrations import execute_crm_sync
            try:
                execute_crm_sync(db, biz, user, action.payload or {})
            except Exception:
                pass  # CRM sync failure is non-blocking
        elif action.type == ActionType.CAMPAIGN_PUBLISH:
            campaign_id_str = action.payload.get("campaign_id")
            if campaign_id_str:
                from app.routers.campaigns import execute_campaign_publish
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.ensure_future(
                            execute_campaign_publish(db, _uuid.UUID(campaign_id_str), user, action.payload)
                        )
                    else:
                        asyncio.run(
                            execute_campaign_publish(db, _uuid.UUID(campaign_id_str), user, action.payload)
                        )
                except Exception:
                    pass  # publish failure is non-blocking
        elif action.type == ActionType.OUTBOUND_MESSAGE:
            from app.routers.outbound import execute_outbound
            try:
                execute_outbound(db, {**(action.payload or {}), "_action_id": str(action.id)}, biz, user)
            except Exception:
                pass  # outbound failure is non-blocking
    db.refresh(approval)
    return approval


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalOut)
def reject(
    approval_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.APPROVE_ACTIONS)),
):
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    biz = db.get(Business, approval.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval is not pending")

    approval.status = ApprovalStatus.REJECTED
    approval.decided_at = datetime.now(timezone.utc)

    # Audit: rejection
    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="APPROVAL_REJECTED",
        entity_type="approval",
        entity_id=approval.id,
        meta={"action_id": str(approval.action_id)},
    ))

    db.commit()
    db.refresh(approval)
    return approval
