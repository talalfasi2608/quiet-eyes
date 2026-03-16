"""
Optimization & Attribution API endpoints.

Endpoints:
- GET  /businesses/{id}/optimizations        — list optimization recommendations
- POST /optimizations/{id}/apply             — apply a recommendation (creates approval)
- POST /optimizations/{id}/dismiss           — dismiss a recommendation
- POST /optimizations/{id}/save              — save for later
- GET  /businesses/{id}/attribution          — list attribution records
- GET  /businesses/{id}/learning-insights    — get learning insights
- POST /businesses/{id}/optimize             — run optimization engine v2 + attribution + learning
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.intelligence.attribution_engine import build_attribution_records
from app.intelligence.historical_learning import compute_learning_insights, get_insights_for_business
from app.intelligence.optimization_engine import run_optimization
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AuditLog,
    AttributionRecord,
    Business,
    OptimizationRecommendation,
    RecommendationStatus,
    RecommendationType,
    RiskLevel,
    User,
)
from app.schemas import (
    AttributionRecordOut,
    OptimizationRecommendationOut,
    OptimizationRunOut,
)

router = APIRouter(tags=["optimizations"])


# ── List Recommendations ──


@router.get(
    "/businesses/{business_id}/optimizations",
    response_model=list[OptimizationRecommendationOut],
)
def list_optimizations(
    status: str | None = Query(None, description="Filter by status: PENDING, NEW, APPLIED, DISMISSED, SAVED, EXPIRED"),
    rec_type: str | None = Query(None, alias="type", description="Filter by recommendation type"),
    limit: int = Query(50, ge=1, le=100),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = (
        db.query(OptimizationRecommendation)
        .filter(OptimizationRecommendation.business_id == biz.id)
    )
    if status:
        try:
            status_enum = RecommendationStatus(status)
            query = query.filter(OptimizationRecommendation.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    if rec_type:
        try:
            type_enum = RecommendationType(rec_type)
            query = query.filter(OptimizationRecommendation.type == type_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid type: {rec_type}")

    return (
        query
        .order_by(OptimizationRecommendation.impact_score.desc(), OptimizationRecommendation.confidence.desc(), OptimizationRecommendation.created_at.desc())
        .limit(limit)
        .all()
    )


# ── Apply Recommendation ──


@router.post(
    "/optimizations/{recommendation_id}/apply",
    response_model=OptimizationRecommendationOut,
)
def apply_recommendation(
    recommendation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = db.get(OptimizationRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    biz = db.get(Business, rec.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status not in (RecommendationStatus.PENDING, RecommendationStatus.NEW, RecommendationStatus.SAVED):
        raise HTTPException(status_code=400, detail="Recommendation cannot be applied in current state")

    now = datetime.now(timezone.utc)

    # Determine risk level based on recommendation type
    risk = _risk_for_type(rec.type)

    # Create action + approval so the change goes through approval flow
    action = Action(
        business_id=biz.id,
        type=ActionType.CAMPAIGN_DRAFT,
        payload={
            "recommendation_id": str(rec.id),
            "recommendation_type": rec.type.value,
            "title": rec.title,
            "summary": rec.summary,
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
        risk=risk,
        cost_impact=rec.impact_score,
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

    db.commit()
    db.refresh(rec)
    return rec


# ── Dismiss Recommendation ──


@router.post(
    "/optimizations/{recommendation_id}/dismiss",
    response_model=OptimizationRecommendationOut,
)
def dismiss_recommendation(
    recommendation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = db.get(OptimizationRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    biz = db.get(Business, rec.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status not in (RecommendationStatus.PENDING, RecommendationStatus.NEW, RecommendationStatus.SAVED):
        raise HTTPException(status_code=400, detail="Recommendation already actioned")

    rec.status = RecommendationStatus.DISMISSED
    rec.decided_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="RECOMMENDATION_DISMISSED",
        entity_type="recommendation",
        entity_id=rec.id,
    ))

    db.commit()
    db.refresh(rec)
    return rec


# ── Save for Later ──


@router.post(
    "/optimizations/{recommendation_id}/save",
    response_model=OptimizationRecommendationOut,
)
def save_recommendation(
    recommendation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = db.get(OptimizationRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    biz = db.get(Business, rec.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status not in (RecommendationStatus.PENDING, RecommendationStatus.NEW):
        raise HTTPException(status_code=400, detail="Recommendation already actioned")

    rec.status = RecommendationStatus.SAVED
    db.commit()
    db.refresh(rec)
    return rec


# ── Run Full Optimization Pipeline ──


@router.post(
    "/businesses/{business_id}/optimize-v2",
    response_model=OptimizationRunOut,
)
def run_optimization_v2_endpoint(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run the full optimization pipeline: attribution → learning → recommendations."""
    # Step 1: Build attribution records
    attribution_count = build_attribution_records(db, biz)

    # Step 2: Compute learning insights
    learning_count = compute_learning_insights(db, biz)

    # Step 3: Generate optimization recommendations
    rec_count = run_optimization(db, biz)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="OPTIMIZATION_V2_RUN",
        entity_type="business",
        entity_id=biz.id,
        meta={
            "attribution_records": attribution_count,
            "learning_insights": learning_count,
            "recommendations_created": rec_count,
        },
    ))
    db.commit()

    return OptimizationRunOut(
        recommendations_created=rec_count,
        learning_insights_updated=learning_count,
    )


# ── Attribution Records ──


@router.get(
    "/businesses/{business_id}/attribution",
    response_model=list[AttributionRecordOut],
)
def list_attribution_records(
    signal_type: str | None = None,
    outcome_type: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = (
        db.query(AttributionRecord)
        .filter(AttributionRecord.business_id == biz.id)
    )
    if signal_type:
        query = query.filter(AttributionRecord.signal_type == signal_type)
    if outcome_type:
        query = query.filter(AttributionRecord.outcome_type == outcome_type)
    return query.order_by(AttributionRecord.created_at.desc()).limit(limit).all()


# ── Learning Insights ──


@router.get(
    "/businesses/{business_id}/learning-insights",
)
def get_learning_insights(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return get_insights_for_business(db, biz.id)


# ── Helpers ──


def _risk_for_type(rec_type: RecommendationType) -> RiskLevel:
    """Determine risk level based on recommendation type."""
    return {
        RecommendationType.BUDGET_CHANGE: RiskLevel.MEDIUM,
        RecommendationType.CREATIVE_CHANGE: RiskLevel.LOW,
        RecommendationType.AUDIENCE_REFINEMENT: RiskLevel.LOW,
        RecommendationType.APPROVAL_THRESHOLD: RiskLevel.MEDIUM,
        RecommendationType.AUTOPILOT_TUNING: RiskLevel.HIGH,
        RecommendationType.PLAYBOOK_SUGGESTION: RiskLevel.LOW,
    }.get(rec_type, RiskLevel.MEDIUM)
