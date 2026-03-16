"""Prediction Engine v1 — heuristic-based scoring for leads, audiences, campaigns."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import (
    Approval,
    ApprovalStatus,
    Audience,
    Campaign,
    CampaignStatus,
    Feedback,
    FeedbackRating,
    Lead,
    LeadIntent,
    LeadStatus,
    PredictiveEntityType,
    PredictiveScore,
    Trend,
)


MODEL_VERSION = "v1"

# Intent weights for conversion likelihood
INTENT_WEIGHTS: dict[str, int] = {
    LeadIntent.PURCHASE.value: 35,
    LeadIntent.COMPARISON.value: 25,
    LeadIntent.COMPLAINT.value: 10,
    LeadIntent.RECOMMENDATION.value: 20,
    LeadIntent.QUESTION.value: 15,
    LeadIntent.OTHER.value: 5,
}


def predict_lead(db: Session, lead: Lead, business_id: uuid.UUID) -> PredictiveScore:
    """Generate a predictive conversion score for a single lead."""
    signals: dict[str, float] = {}
    score = 0.0

    # 1. Intent signal
    intent_weight = INTENT_WEIGHTS.get(lead.intent.value, 5)
    signals["intent"] = intent_weight
    score += intent_weight

    # 2. Lead score signal (normalized to 0-20)
    lead_score_signal = min(20, lead.score * 20 / 100) if lead.score else 0
    signals["lead_score"] = round(lead_score_signal, 1)
    score += lead_score_signal

    # 3. Confidence signal (normalized to 0-15)
    conf_signal = min(15, lead.confidence * 15 / 100) if lead.confidence else 0
    signals["confidence"] = round(conf_signal, 1)
    score += conf_signal

    # 4. Historical approval rate for this business
    total_approvals = db.query(Approval).filter(Approval.business_id == business_id).count()
    executed_approvals = db.query(Approval).filter(
        Approval.business_id == business_id,
        Approval.status == ApprovalStatus.EXECUTED,
    ).count()
    if total_approvals > 0:
        approval_rate = executed_approvals / total_approvals
        approval_signal = approval_rate * 10
        signals["approval_rate"] = round(approval_signal, 1)
        score += approval_signal

    # 5. Feedback signal — positive feedback on similar leads boosts score
    good_feedback = db.query(Feedback).filter(
        Feedback.business_id == business_id,
        Feedback.rating == FeedbackRating.GOOD,
    ).count()
    bad_feedback = db.query(Feedback).filter(
        Feedback.business_id == business_id,
        Feedback.rating == FeedbackRating.BAD,
    ).count()
    total_feedback = good_feedback + bad_feedback
    if total_feedback > 0:
        feedback_ratio = good_feedback / total_feedback
        feedback_signal = feedback_ratio * 10
        signals["feedback_quality"] = round(feedback_signal, 1)
        score += feedback_signal

    # 6. Trend alignment — if there are active trends, slight boost
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    active_trends = db.query(Trend).filter(
        Trend.business_id == business_id,
        Trend.created_at >= cutoff,
    ).count()
    if active_trends > 0:
        trend_signal = min(5, active_trends * 1.5)
        signals["trend_alignment"] = round(trend_signal, 1)
        score += trend_signal

    # Normalize to 0-100
    predicted = max(0, min(100, int(score)))

    # Build explanation
    top_signals = sorted(signals.items(), key=lambda x: x[1], reverse=True)[:3]
    explanation_parts = []
    for name, val in top_signals:
        explanation_parts.append(f"{name}: {val}")
    explanation = f"Predicted conversion score {predicted}/100. Top signals: {', '.join(explanation_parts)}."

    return PredictiveScore(
        business_id=business_id,
        entity_type=PredictiveEntityType.LEAD,
        entity_id=lead.id,
        predicted_conversion_score=predicted,
        predicted_roi=None,
        model_version=MODEL_VERSION,
        contributing_signals=signals,
        explanation=explanation,
    )


def predict_audience(db: Session, audience: Audience, business_id: uuid.UUID) -> PredictiveScore:
    """Generate a quality prediction for an audience segment."""
    signals: dict[str, float] = {}
    score = 50.0  # Base score for audiences

    # 1. Definition completeness
    definition = audience.definition or {}
    has_intents = bool(definition.get("intents"))
    has_min_score = bool(definition.get("min_score"))
    completeness = 0
    if has_intents:
        completeness += 10
    if has_min_score:
        completeness += 10
    signals["definition_completeness"] = completeness
    score += completeness

    # 2. Lead count in this audience definition
    query = db.query(Lead).filter(Lead.business_id == business_id)
    if has_intents:
        intents = definition.get("intents", [])
        if intents:
            query = query.filter(Lead.intent.in_(intents))
    if has_min_score:
        query = query.filter(Lead.score >= definition.get("min_score", 0))
    lead_count = query.count()
    size_signal = min(15, lead_count * 1.5)
    signals["audience_size"] = round(size_signal, 1)
    score += size_signal

    # 3. Average lead score in audience
    leads = query.limit(50).all()
    if leads:
        avg_score = sum(l.score for l in leads) / len(leads)
        quality_signal = min(15, avg_score * 15 / 100)
        signals["avg_lead_quality"] = round(quality_signal, 1)
        score += quality_signal

    predicted = max(0, min(100, int(score)))
    top_signals = sorted(signals.items(), key=lambda x: x[1], reverse=True)[:3]
    explanation = f"Audience quality score {predicted}/100. Top signals: {', '.join(f'{n}: {v}' for n, v in top_signals)}."

    return PredictiveScore(
        business_id=business_id,
        entity_type=PredictiveEntityType.AUDIENCE,
        entity_id=audience.id,
        predicted_conversion_score=predicted,
        predicted_roi=None,
        model_version=MODEL_VERSION,
        contributing_signals=signals,
        explanation=explanation,
    )


def predict_campaign(db: Session, campaign: Campaign, business_id: uuid.UUID) -> PredictiveScore:
    """Generate a predicted ROI for a campaign."""
    signals: dict[str, float] = {}
    score = 40.0  # Base
    predicted_roi = 1.0

    draft = campaign.draft or {}

    # 1. Budget efficiency signal
    daily_budget = draft.get("schedule_suggestion", {}).get("daily_budget", 50)
    if daily_budget <= 30:
        budget_signal = 5
    elif daily_budget <= 100:
        budget_signal = 10
    else:
        budget_signal = 7  # Higher budgets have diminishing returns in SMB context
    signals["budget_efficiency"] = budget_signal
    score += budget_signal

    # 2. Creatives count
    creatives = draft.get("creatives", [])
    creative_signal = min(10, len(creatives) * 4)
    signals["creative_variants"] = creative_signal
    score += creative_signal

    # 3. Targeting quality
    targeting = draft.get("targeting_suggestions", [])
    targeting_signal = min(10, len(targeting) * 2.5)
    signals["targeting_depth"] = round(targeting_signal, 1)
    score += targeting_signal

    # 4. Historical campaign performance
    executed_campaigns = db.query(Campaign).filter(
        Campaign.business_id == business_id,
        Campaign.status.in_([CampaignStatus.EXECUTED, CampaignStatus.PUBLISHED]),
    ).count()
    experience_signal = min(10, executed_campaigns * 3)
    signals["campaign_experience"] = experience_signal
    score += experience_signal

    # 5. Platform signal
    platform = draft.get("platform", "meta")
    platform_scores = {"meta": 8, "google": 7, "tiktok": 5}
    platform_signal = platform_scores.get(platform, 5)
    signals["platform_fit"] = platform_signal
    score += platform_signal

    predicted = max(0, min(100, int(score)))

    # Estimate ROI multiplier based on score
    if predicted >= 75:
        predicted_roi = 3.5
    elif predicted >= 60:
        predicted_roi = 2.5
    elif predicted >= 45:
        predicted_roi = 1.8
    else:
        predicted_roi = 1.2

    top_signals = sorted(signals.items(), key=lambda x: x[1], reverse=True)[:3]
    explanation = f"Predicted ROI {predicted_roi}x with confidence {predicted}/100. Top signals: {', '.join(f'{n}: {v}' for n, v in top_signals)}."

    return PredictiveScore(
        business_id=business_id,
        entity_type=PredictiveEntityType.CAMPAIGN,
        entity_id=campaign.id,
        predicted_conversion_score=predicted,
        predicted_roi=predicted_roi,
        model_version=MODEL_VERSION,
        contributing_signals=signals,
        explanation=explanation,
    )


def run_predictions(
    db: Session,
    business_id: uuid.UUID,
    entity_type: str,
    entity_ids: list[uuid.UUID] | None = None,
) -> int:
    """Run predictions for a given entity type. Returns count of predictions created."""
    created = 0

    if entity_type == "LEAD":
        query = db.query(Lead).filter(Lead.business_id == business_id, Lead.status == LeadStatus.NEW)
        if entity_ids:
            query = query.filter(Lead.id.in_(entity_ids))
        leads = query.limit(100).all()
        for lead in leads:
            prediction = predict_lead(db, lead, business_id)
            db.add(prediction)
            created += 1

    elif entity_type == "AUDIENCE":
        query = db.query(Audience).filter(Audience.business_id == business_id)
        if entity_ids:
            query = query.filter(Audience.id.in_(entity_ids))
        audiences = query.limit(50).all()
        for audience in audiences:
            prediction = predict_audience(db, audience, business_id)
            db.add(prediction)
            created += 1

    elif entity_type == "CAMPAIGN":
        query = db.query(Campaign).filter(Campaign.business_id == business_id)
        if entity_ids:
            query = query.filter(Campaign.id.in_(entity_ids))
        campaigns = query.limit(50).all()
        for campaign in campaigns:
            prediction = predict_campaign(db, campaign, business_id)
            db.add(prediction)
            created += 1

    if created > 0:
        db.commit()

    return created
