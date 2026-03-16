"""
Outbound Actions — multi-channel message drafts, approval, and execution.

Endpoints:
- POST   /businesses/{business_id}/outbound/draft  — generate & create outbound draft
- GET    /businesses/{business_id}/outbound         — list outbound actions (filterable)
- GET    /outbound/{outbound_id}                    — get single outbound action
- DELETE /outbound/{outbound_id}                    — delete draft
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user, require_permission
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    Lead,
    OutboundAction,
    OutboundChannel,
    OutboundStatus,
    Permission,
    RiskLevel,
    User,
)
from app.schemas import OutboundActionOut, OutboundDraftRequest

router = APIRouter(tags=["outbound"])


@router.post(
    "/businesses/{business_id}/outbound/draft",
    response_model=OutboundActionOut,
    status_code=201,
)
def create_outbound_draft(
    body: OutboundDraftRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_CAMPAIGNS)),
):
    """Generate an AI outbound draft and create it with APPROVAL_PENDING status."""
    from app.outbound.draft_generator import generate_draft

    # Validate channel
    try:
        channel = OutboundChannel(body.channel)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {body.channel}")

    # Resolve lead if provided
    lead = None
    if body.lead_id:
        lead = db.get(Lead, body.lead_id)
        if not lead or lead.business_id != biz.id:
            raise HTTPException(status_code=404, detail="Lead not found")

    # Generate draft
    draft = generate_draft(channel, biz, lead, body.prompt)

    # Create the Action for approval flow
    action = Action(
        business_id=biz.id,
        type=ActionType.OUTBOUND_MESSAGE,
        payload={
            "channel": channel.value,
            "recipient_name": body.recipient_name or draft["recipient_name"],
            "recipient_handle": body.recipient_handle or draft["recipient_handle"],
            "subject": draft["subject"],
        },
    )
    db.add(action)
    db.flush()

    # Create PENDING approval
    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=RiskLevel.MEDIUM,
        cost_impact=0,
        confidence=70,
        requires_human=True,
    )
    db.add(approval)
    db.flush()

    # Create the outbound action record
    outbound = OutboundAction(
        business_id=biz.id,
        channel=channel,
        recipient_name=body.recipient_name or draft["recipient_name"],
        recipient_handle=body.recipient_handle or draft["recipient_handle"],
        subject=draft["subject"],
        body=draft["body"],
        payload={"approval_id": str(approval.id)},
        reason=draft["reason"],
        evidence_url=draft["evidence_url"],
        lead_id=body.lead_id,
        action_id=action.id,
        status=OutboundStatus.APPROVAL_PENDING,
    )
    db.add(outbound)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="OUTBOUND_DRAFT_CREATED",
        entity_type="outbound_action",
        entity_id=outbound.id,
        meta={"channel": channel.value, "lead_id": str(body.lead_id) if body.lead_id else None},
    ))

    db.commit()
    db.refresh(outbound)
    return outbound


@router.get(
    "/businesses/{business_id}/outbound",
    response_model=list[OutboundActionOut],
)
def list_outbound_actions(
    status: str | None = Query(None),
    channel: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = db.query(OutboundAction).filter(OutboundAction.business_id == biz.id)
    if status:
        query = query.filter(OutboundAction.status == status)
    if channel:
        query = query.filter(OutboundAction.channel == channel)
    return query.order_by(OutboundAction.created_at.desc()).limit(limit).all()


@router.get(
    "/outbound/{outbound_id}",
    response_model=OutboundActionOut,
)
def get_outbound_action(
    outbound_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    oa = db.get(OutboundAction, outbound_id)
    if not oa:
        raise HTTPException(status_code=404, detail="Outbound action not found")
    biz = db.get(Business, oa.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Outbound action not found")
    return oa


@router.delete("/outbound/{outbound_id}", status_code=204)
def delete_outbound_action(
    outbound_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    oa = db.get(OutboundAction, outbound_id)
    if not oa:
        raise HTTPException(status_code=404, detail="Outbound action not found")
    biz = db.get(Business, oa.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Outbound action not found")
    if oa.status not in (OutboundStatus.DRAFT, OutboundStatus.APPROVAL_PENDING):
        raise HTTPException(status_code=400, detail="Can only delete drafts or pending actions")
    db.delete(oa)
    db.commit()


def execute_outbound(db: Session, action_payload: dict, biz: Business, user: User) -> None:
    """Execute an outbound action after approval. Called from the approval flow."""
    from app.outbound.adapters import dispatch

    # Find the outbound_action linked to this action
    action_id_str = action_payload.get("_action_id")
    if not action_id_str:
        return

    outbound = (
        db.query(OutboundAction)
        .filter(OutboundAction.action_id == uuid.UUID(action_id_str))
        .first()
    )
    if not outbound:
        return

    outbound.status = OutboundStatus.APPROVED

    result = dispatch(
        channel=outbound.channel.value,
        recipient=outbound.recipient_handle,
        subject=outbound.subject,
        body=outbound.body,
        payload=outbound.payload,
    )

    now = datetime.now(timezone.utc)
    if result.success:
        outbound.status = OutboundStatus.EXECUTED
        outbound.executed_at = now
        outbound.payload = {**(outbound.payload or {}), "external_id": result.external_id}
    else:
        outbound.status = OutboundStatus.FAILED
        outbound.payload = {**(outbound.payload or {}), "error": result.error}

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="OUTBOUND_EXECUTED" if result.success else "OUTBOUND_FAILED",
        entity_type="outbound_action",
        entity_id=outbound.id,
        meta={"channel": outbound.channel.value, "success": result.success},
    ))

    db.commit()
