import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped, get_current_user, require_permission
from app.intelligence.autopilot import run_autopilot
from app.models import (
    Approval,
    ApprovalStatus,
    AuditLog,
    AutopilotSettings,
    Business,
    Digest,
    Permission,
    RiskLevel,
    User,
)
from app.schemas import (
    ApprovalOut,
    AutopilotRunOut,
    AutopilotSettingsOut,
    AutopilotSettingsUpdateRequest,
    BulkApproveRequest,
    BulkApproveResponse,
    DigestOut,
)

router = APIRouter(tags=["autopilot"])


# ── Settings CRUD ──


@router.get(
    "/businesses/{business_id}/autopilot/settings",
    response_model=AutopilotSettingsOut,
)
def get_autopilot_settings(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    settings = (
        db.query(AutopilotSettings)
        .filter(AutopilotSettings.business_id == biz.id)
        .first()
    )
    if not settings:
        settings = AutopilotSettings(business_id=biz.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put(
    "/businesses/{business_id}/autopilot/settings",
    response_model=AutopilotSettingsOut,
)
def update_autopilot_settings(
    body: AutopilotSettingsUpdateRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission(Permission.MANAGE_AUTOPILOT)),
):
    settings = (
        db.query(AutopilotSettings)
        .filter(AutopilotSettings.business_id == biz.id)
        .first()
    )
    if not settings:
        settings = AutopilotSettings(business_id=biz.id)
        db.add(settings)
        db.flush()

    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(settings, field, value)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=_user.id,
        event_type="AUTOPILOT_SETTINGS_UPDATED",
        entity_type="business",
        entity_id=biz.id,
        meta={"changed_fields": list(changes.keys())},
    ))

    db.commit()
    db.refresh(settings)
    return settings


# ── Run Now ──


@router.post(
    "/businesses/{business_id}/autopilot/run_now",
    response_model=AutopilotRunOut,
)
def autopilot_run_now(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_AUTOPILOT)),
):
    result = run_autopilot(db, biz.id)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="AUTOPILOT_RUN",
        entity_type="business",
        entity_id=biz.id,
        meta=result,
    ))
    db.commit()

    return AutopilotRunOut(**result)


# ── Digests ──


@router.get(
    "/businesses/{business_id}/digests",
    response_model=list[DigestOut],
)
def list_digests(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    limit: int = Query(default=10, le=50),
):
    return (
        db.query(Digest)
        .filter(Digest.business_id == biz.id)
        .order_by(Digest.date.desc())
        .limit(limit)
        .all()
    )


# ── Bulk Approve ──


@router.post(
    "/businesses/{business_id}/approvals/bulk-approve",
    response_model=BulkApproveResponse,
)
def bulk_approve(
    body: BulkApproveRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.APPROVE_ACTIONS)),
):
    query = (
        db.query(Approval)
        .options(joinedload(Approval.action))
        .filter(
            Approval.business_id == biz.id,
            Approval.status == ApprovalStatus.PENDING,
            Approval.confidence >= body.min_confidence,
        )
    )

    risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]
    max_risk_idx = risk_order.index(body.max_risk)
    approvals = query.all()

    approved = 0
    skipped = 0
    total_cost = 0
    now = datetime.now(timezone.utc)

    for approval in approvals:
        # Filter by risk tolerance
        risk_idx = risk_order.index(approval.risk) if approval.risk in risk_order else 2
        if risk_idx > max_risk_idx:
            skipped += 1
            continue

        # Filter by allowed action types
        if body.action_types:
            action_type = approval.action.type.value if approval.action else None
            if action_type not in body.action_types:
                skipped += 1
                continue

        approval.status = ApprovalStatus.EXECUTED
        approval.decided_at = now
        total_cost += approval.cost_impact
        approved += 1

        db.add(AuditLog(
            org_id=biz.org_id,
            user_id=user.id,
            event_type="BULK_APPROVAL_APPROVED",
            entity_type="approval",
            entity_id=approval.id,
            meta={"action_id": str(approval.action_id), "source": "bulk_approve"},
        ))

    db.commit()
    return BulkApproveResponse(
        approved_count=approved,
        skipped_count=skipped,
        total_cost=total_cost,
    )
