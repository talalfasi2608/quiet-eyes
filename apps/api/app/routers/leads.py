import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.ingestion.lead_engine import generate_leads_for_business
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    Lead,
    LeadStatus,
    RiskLevel,
    User,
)
from app.schemas import ActionCreateRequest, ActionOut, ApprovalOut, LeadGenerateOut, LeadOut

router = APIRouter(tags=["leads"])


@router.post("/businesses/{business_id}/leads/generate", response_model=LeadGenerateOut)
def generate_leads(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    result = generate_leads_for_business(db, biz.id)
    return result


@router.get("/businesses/{business_id}/leads", response_model=list[LeadOut])
def list_leads(
    status: LeadStatus | None = None,
    limit: int = Query(50, le=100),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Lead)
        .options(joinedload(Lead.mention).joinedload("source"))
        .filter(Lead.business_id == biz.id)
    )
    if status:
        query = query.filter(Lead.status == status)
    return query.order_by(Lead.score.desc()).limit(limit).all()


# ── Action creation (creates Action + Approval) ──


RISK_BY_ACTION: dict[ActionType, RiskLevel] = {
    ActionType.REPLY_DRAFT: RiskLevel.LOW,
    ActionType.AUDIENCE_DRAFT: RiskLevel.MEDIUM,
    ActionType.CAMPAIGN_DRAFT: RiskLevel.HIGH,
    ActionType.CRM_SYNC: RiskLevel.LOW,
    ActionType.EXPORT: RiskLevel.LOW,
}


@router.post(
    "/businesses/{business_id}/actions",
    response_model=ApprovalOut,
    status_code=201,
)
def create_action(
    body: ActionCreateRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Validate lead_id if present
    if body.payload and body.payload.get("lead_id"):
        lead = db.get(Lead, uuid.UUID(str(body.payload["lead_id"])))
        if not lead or lead.business_id != biz.id:
            raise HTTPException(status_code=404, detail="Lead not found")

    action = Action(
        business_id=biz.id,
        type=body.type,
        payload=body.payload,
    )
    db.add(action)
    db.flush()

    risk = RISK_BY_ACTION.get(body.type, RiskLevel.MEDIUM)
    confidence = body.payload.get("confidence", 70) if body.payload else 70

    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=risk,
        cost_impact=0,
        confidence=confidence,
        requires_human=True,
    )
    db.add(approval)

    # Audit log
    audit = AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="ACTION_CREATED",
        entity_type="action",
        entity_id=action.id,
        meta={"action_type": body.type.value, "business_id": str(biz.id)},
    )
    db.add(audit)

    db.commit()
    db.refresh(approval)

    # Eager load action for response
    approval.action = action
    return approval
