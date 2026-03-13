import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.models import (
    Action,
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    Lead,
    LeadStatus,
    Mention,
    User,
)
from app.schemas import ApprovalOut, LeadOut, MentionOut

router = APIRouter(tags=["feed"])


@router.get("/businesses/{business_id}/feed")
def get_feed(
    tab: str = Query("recommended", pattern="^(recommended|needs_approval)$"),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
) -> list[Any]:
    if tab == "recommended":
        # First try leads
        leads = (
            db.query(Lead)
            .options(joinedload(Lead.mention).joinedload("source"))
            .filter(Lead.business_id == biz.id, Lead.status == LeadStatus.NEW)
            .order_by(Lead.score.desc())
            .limit(50)
            .all()
        )
        if leads:
            return [LeadOut.model_validate(l) for l in leads]

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
    return query.order_by(Approval.created_at.desc()).limit(50).all()


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalOut)
def approve(
    approval_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    biz = db.get(Business, approval.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval is not pending")

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

    db.commit()
    db.refresh(approval)
    return approval


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalOut)
def reject(
    approval_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
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
