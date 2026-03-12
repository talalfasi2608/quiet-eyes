import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.models import Action, Approval, ApprovalStatus, Business, Lead, LeadStatus, User
from app.schemas import ApprovalOut, LeadOut

router = APIRouter(tags=["feed"])


@router.get("/businesses/{business_id}/feed", response_model=list[LeadOut])
def get_feed(
    tab: str = Query("recommended", pattern="^(recommended|needs_approval)$"),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = db.query(Lead).options(joinedload(Lead.mention)).filter(Lead.business_id == biz.id)

    if tab == "recommended":
        query = query.filter(Lead.status == LeadStatus.NEW).order_by(Lead.score.desc())
    else:
        query = query.filter(Lead.status.in_([LeadStatus.SAVED, LeadStatus.SENT]))

    return query.limit(50).all()


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

    approval.status = ApprovalStatus.APPROVED
    approval.decided_at = datetime.now(timezone.utc)
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
    db.commit()
    db.refresh(approval)
    return approval
