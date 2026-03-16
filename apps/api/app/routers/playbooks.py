import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user, require_permission
from app.intelligence.optimization_engine import run_optimization
from app.intelligence.vertical_templates import get_template, list_templates
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    OptimizationRecommendation,
    Permission,
    Playbook,
    RecommendationStatus,
    RiskLevel,
    User,
)
from app.schemas import (
    OptimizationRecommendationOut,
    OptimizationRunOut,
    PlaybookCreateRequest,
    PlaybookOut,
    PlaybookUpdateRequest,
    RecommendationActionRequest,
    VerticalTemplateOut,
)

router = APIRouter(tags=["playbooks"])


# ── Vertical Templates ──


@router.get("/vertical-templates", response_model=list[VerticalTemplateOut])
def list_vertical_templates():
    return list_templates()


@router.get("/vertical-templates/{slug}", response_model=VerticalTemplateOut)
def get_vertical_template(slug: str):
    tpl = get_template(slug)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.post("/businesses/{business_id}/vertical-template")
def assign_vertical_template(
    slug: str,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tpl = get_template(slug)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    biz.vertical_template = slug

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="VERTICAL_TEMPLATE_ASSIGNED",
        entity_type="business",
        entity_id=biz.id,
        meta={"template": slug},
    ))

    db.commit()
    return {"status": "ok", "template": slug}


# ── Playbooks CRUD ──


@router.post(
    "/businesses/{business_id}/playbooks",
    response_model=PlaybookOut,
    status_code=201,
)
def create_playbook(
    body: PlaybookCreateRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_PLAYBOOKS)),
):
    playbook = Playbook(
        business_id=biz.id,
        name=body.name,
        description=body.description,
        trigger_conditions=body.trigger_conditions,
        suggested_actions=body.suggested_actions,
        approval_policy=body.approval_policy,
        campaign_template=body.campaign_template,
        audience_template=body.audience_template,
    )
    db.add(playbook)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="PLAYBOOK_CREATED",
        entity_type="playbook",
        entity_id=playbook.id,
        meta={"name": body.name},
    ))

    db.commit()
    db.refresh(playbook)
    return playbook


@router.get(
    "/businesses/{business_id}/playbooks",
    response_model=list[PlaybookOut],
)
def list_playbooks(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(Playbook)
        .filter(Playbook.business_id == biz.id)
        .order_by(Playbook.created_at.desc())
        .all()
    )


@router.patch(
    "/playbooks/{playbook_id}",
    response_model=PlaybookOut,
)
def update_playbook(
    playbook_id: uuid.UUID,
    body: PlaybookUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if not pb.business_id:
        raise HTTPException(status_code=404, detail="Playbook not found")
    biz = db.get(Business, pb.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Playbook not found")

    for field in ("name", "description", "trigger_conditions", "suggested_actions",
                  "approval_policy", "campaign_template", "audience_template", "is_active"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(pb, field, val)

    db.commit()
    db.refresh(pb)
    return pb


@router.delete("/playbooks/{playbook_id}", status_code=204)
def delete_playbook(
    playbook_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if not pb.business_id:
        raise HTTPException(status_code=404, detail="Playbook not found")
    biz = db.get(Business, pb.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Playbook not found")
    db.delete(pb)
    db.commit()


# ── Optimization Recommendations ──


@router.post(
    "/businesses/{business_id}/optimize",
    response_model=OptimizationRunOut,
)
def run_optimization_endpoint(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run optimization v2 pipeline: attribution → learning → recommendations."""
    from app.intelligence.attribution_engine import build_attribution_records
    from app.intelligence.historical_learning import compute_learning_insights

    # Step 1: Build attribution records
    build_attribution_records(db, biz)

    # Step 2: Compute learning insights
    learning_count = compute_learning_insights(db, biz)

    # Step 3: Generate recommendations
    count = run_optimization(db, biz)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="OPTIMIZATION_RUN",
        entity_type="business",
        entity_id=biz.id,
        meta={"recommendations_created": count, "learning_insights": learning_count},
    ))
    db.commit()

    return OptimizationRunOut(recommendations_created=count, learning_insights_updated=learning_count)


@router.get(
    "/businesses/{business_id}/recommendations",
    response_model=list[OptimizationRecommendationOut],
)
def list_recommendations(
    status: RecommendationStatus | None = None,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = (
        db.query(OptimizationRecommendation)
        .filter(OptimizationRecommendation.business_id == biz.id)
    )
    if status:
        query = query.filter(OptimizationRecommendation.status == status)
    return query.order_by(OptimizationRecommendation.created_at.desc()).limit(50).all()


@router.post(
    "/recommendations/{recommendation_id}/action",
    response_model=OptimizationRecommendationOut,
)
def act_on_recommendation(
    recommendation_id: uuid.UUID,
    body: RecommendationActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = db.get(OptimizationRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    biz = db.get(Business, rec.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status != RecommendationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Recommendation already actioned")

    now = datetime.now(timezone.utc)

    if body.action == "dismiss":
        rec.status = RecommendationStatus.DISMISSED
        rec.decided_at = now
    elif body.action == "save":
        rec.status = RecommendationStatus.SAVED
    elif body.action == "apply":
        # Create an action + approval so the change goes through approval flow
        action = Action(
            business_id=biz.id,
            type=ActionType.CAMPAIGN_DRAFT,  # Generic action type for optimization
            payload={
                "recommendation_id": str(rec.id),
                "recommendation_type": rec.type.value,
                "title": rec.title,
                "suggested_value": rec.suggested_value,
                "optimization_payload": rec.payload,
            },
        )
        db.add(action)
        db.flush()

        approval = Approval(
            business_id=biz.id,
            action_id=action.id,
            status=ApprovalStatus.PENDING,
            risk=RiskLevel.MEDIUM,
            cost_impact=0,
            confidence=rec.confidence,
            requires_human=True,
        )
        db.add(approval)

        rec.status = RecommendationStatus.APPLIED
        rec.decided_at = now

        db.add(AuditLog(
            org_id=biz.org_id,
            user_id=user.id,
            event_type="RECOMMENDATION_APPLIED",
            entity_type="recommendation",
            entity_id=rec.id,
            meta={"type": rec.type.value, "title": rec.title},
        ))
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use: apply, dismiss, save")

    db.commit()
    db.refresh(rec)
    return rec
