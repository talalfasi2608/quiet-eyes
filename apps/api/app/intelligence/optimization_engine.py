"""
Optimization Engine v2: learning-informed recommendations from outcomes, feedback, and attribution.

Builds on v1 heuristics and adds:
- Learning-informed budget recommendations
- Audience radius refinement from lead conversion insights
- Keyword exclusion suggestions from low-performing trends
- CTA improvement from feedback analysis
- Stronger approval threshold suggestions from pattern learning
- Autopilot settings changes from review/sentiment analysis
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Approval,
    ApprovalStatus,
    AttributionRecord,
    Business,
    Campaign,
    CampaignStatus,
    Feedback,
    FeedbackRating,
    Lead,
    LeadStatus,
    LearningInsight,
    OptimizationRecommendation,
    RecommendationStatus,
    RecommendationType,
    Review,
    ReviewSentiment,
    Trend,
)

logger = logging.getLogger(__name__)


def run_optimization(db: Session, business: Business) -> int:
    """Generate optimization recommendations for a business. Returns count created."""
    created = 0
    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    # Skip if there are already too many pending recommendations
    pending_count = (
        db.query(func.count(OptimizationRecommendation.id))
        .filter(
            OptimizationRecommendation.business_id == business.id,
            OptimizationRecommendation.status.in_([RecommendationStatus.PENDING, RecommendationStatus.NEW]),
        )
        .scalar()
    )
    if pending_count >= 15:
        return 0

    # Load learning insights for smarter recommendations
    insights = _load_insights(db, business.id)

    # ── 1. Budget recommendations based on campaign performance + attribution ──
    created += _recommend_budget(db, business, cutoff_7d, cutoff_30d, insights)

    # ── 2. Creative/CTA recommendations based on feedback ──
    created += _recommend_creative(db, business, cutoff_7d, cutoff_30d, insights)

    # ── 3. Audience refinement from lead conversion insights ──
    created += _recommend_audience(db, business, cutoff_7d, cutoff_30d, insights)

    # ── 4. Approval threshold tuning ──
    created += _recommend_approval_threshold(db, business, cutoff_7d, insights)

    # ── 5. Autopilot tuning based on review sentiment ──
    created += _recommend_autopilot(db, business, cutoff_7d, cutoff_30d)

    # ── 6. Keyword exclusion from weak trends ──
    created += _recommend_keyword_exclusions(db, business, cutoff_7d, cutoff_30d)

    # ── 7. Playbook suggestions from attribution patterns ──
    created += _recommend_playbook_from_patterns(db, business, cutoff_7d, cutoff_30d)

    if created > 0:
        db.commit()

    return created


def _load_insights(db: Session, business_id) -> dict[str, dict]:
    """Load learning insights into a lookup dict."""
    raw = (
        db.query(LearningInsight)
        .filter(LearningInsight.business_id == business_id)
        .all()
    )
    result: dict[str, dict] = {}
    for i in raw:
        key = f"{i.insight_type}:{i.insight_key}"
        result[key] = i.value
    return result


def _recommend_budget(db: Session, business: Business, cutoff_7d, cutoff_30d, insights: dict) -> int:
    """Budget recommendations informed by campaign performance and attribution."""
    campaigns = (
        db.query(Campaign)
        .filter(Campaign.business_id == business.id)
        .order_by(Campaign.created_at.desc())
        .limit(20)
        .all()
    )

    published_count = sum(1 for c in campaigns if c.status == CampaignStatus.PUBLISHED)
    failed_count = sum(1 for c in campaigns if c.status == CampaignStatus.PUBLISH_FAILED)

    if published_count < 3:
        return 0

    avg_budget = 0
    budget_campaigns = [c for c in campaigns if c.draft and c.draft.get("budget_suggestion")]
    if budget_campaigns:
        avg_budget = sum(c.draft["budget_suggestion"] for c in budget_campaigns) // len(budget_campaigns)

    if avg_budget <= 0:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.BUDGET_CHANGE, cutoff_7d):
        return 0

    # Check attribution: how many published campaigns led to conversions?
    attributed_outcomes = (
        db.query(func.count(AttributionRecord.id))
        .filter(
            AttributionRecord.business_id == business.id,
            AttributionRecord.outcome_type.in_(["campaign_published", "campaign_executed"]),
            AttributionRecord.created_at >= cutoff_30d,
        )
        .scalar()
    )

    # Learning-informed: check campaign approval rates
    campaign_insight = insights.get("campaign_approval_by_objective:LEADS", {})
    approval_rate = campaign_insight.get("approval_rate", 50)

    if published_count >= 5 and (failed_count == 0 or published_count / max(1, failed_count) >= 3):
        # Strong performance — suggest increase
        boost = 25 if attributed_outcomes and attributed_outcomes >= 3 else 15
        suggested = min(avg_budget + boost, avg_budget * 2)
        impact = max(30, min(80, published_count * 8 + (attributed_outcomes or 0) * 5))

        db.add(OptimizationRecommendation(
            business_id=business.id,
            type=RecommendationType.BUDGET_CHANGE,
            title="Increase daily budget for better reach",
            description=f"Your campaigns are performing well with {published_count} published. Consider increasing budget.",
            summary=f"Budget increase from ${avg_budget} to ${suggested}/day based on {published_count} successful campaigns",
            current_value=f"${avg_budget}/day",
            suggested_value=f"${suggested}/day",
            confidence=70 + min(15, (attributed_outcomes or 0) * 3),
            impact_estimate="10-20% more impressions",
            impact_score=impact,
            reasoning=f"{published_count} successful publishes, {attributed_outcomes or 0} attributed outcomes, {approval_rate}% approval rate suggest room to scale.",
            payload={"current_budget": avg_budget, "suggested_budget": suggested, "attributed_outcomes": attributed_outcomes},
        ))
        return 1

    elif failed_count > published_count and avg_budget > 30:
        # Poor performance — suggest decrease
        suggested = max(20, avg_budget - 20)
        db.add(OptimizationRecommendation(
            business_id=business.id,
            type=RecommendationType.BUDGET_CHANGE,
            title="Reduce daily budget — high publish failure rate",
            description=f"{failed_count} campaigns failed vs {published_count} published. Reduce budget and fix creatives first.",
            summary=f"Budget decrease from ${avg_budget} to ${suggested}/day due to high failure rate",
            current_value=f"${avg_budget}/day",
            suggested_value=f"${suggested}/day",
            confidence=65,
            impact_estimate="Save budget while improving campaign quality",
            impact_score=50,
            reasoning=f"Failure rate is high ({failed_count}/{len(campaigns)}). Better to reduce spend and improve quality.",
            payload={"current_budget": avg_budget, "suggested_budget": suggested, "failure_rate": failed_count},
        ))
        return 1

    return 0


def _recommend_creative(db: Session, business: Business, cutoff_7d, cutoff_30d, insights: dict) -> int:
    """Creative/CTA recommendations based on feedback patterns."""
    good_feedback = (
        db.query(func.count(Feedback.id))
        .filter(Feedback.business_id == business.id, Feedback.rating == FeedbackRating.GOOD, Feedback.created_at >= cutoff_30d)
        .scalar()
    )
    bad_feedback = (
        db.query(func.count(Feedback.id))
        .filter(Feedback.business_id == business.id, Feedback.rating == FeedbackRating.BAD, Feedback.created_at >= cutoff_30d)
        .scalar()
    )
    total_feedback = good_feedback + bad_feedback

    if total_feedback < 5 or bad_feedback <= good_feedback:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.CREATIVE_CHANGE, cutoff_7d):
        return 0

    bad_pct = (bad_feedback * 100) // total_feedback

    # Check learning insights for satisfaction trends
    feedback_insight = insights.get("feedback_patterns:summary", {})
    satisfaction_rate = feedback_insight.get("satisfaction_rate", 50)

    impact = max(40, min(90, bad_pct))

    db.add(OptimizationRecommendation(
        business_id=business.id,
        type=RecommendationType.CREATIVE_CHANGE,
        title="Improve CTAs and ad creatives — high negative feedback",
        description=f"{bad_pct}% of recent feedback is negative. Consider refreshing ad creatives, headlines, and CTAs.",
        summary=f"Creative refresh recommended: {bad_pct}% negative feedback, {satisfaction_rate}% satisfaction rate",
        current_value=f"{bad_feedback}/{total_feedback} negative",
        suggested_value="Refresh headlines, CTAs, and ad copy",
        confidence=65 + min(15, bad_pct // 5),
        impact_estimate="Better engagement and conversion rates",
        impact_score=impact,
        reasoning=f"High negative feedback ratio ({bad_pct}%) with satisfaction rate of {satisfaction_rate}% suggests current messaging isn't resonating.",
        payload={"bad_pct": bad_pct, "satisfaction_rate": satisfaction_rate},
    ))
    return 1


def _recommend_audience(db: Session, business: Business, cutoff_7d, cutoff_30d, insights: dict) -> int:
    """Audience refinement from lead conversion insights."""
    total_leads = (
        db.query(func.count(Lead.id))
        .filter(Lead.business_id == business.id, Lead.created_at >= cutoff_30d)
        .scalar()
    )
    closed_leads = (
        db.query(func.count(Lead.id))
        .filter(Lead.business_id == business.id, Lead.status == LeadStatus.CLOSED, Lead.created_at >= cutoff_30d)
        .scalar()
    )

    if total_leads < 10:
        return 0

    conversion_rate = (closed_leads * 100) // total_leads if total_leads > 0 else 0

    if conversion_rate >= 15:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.AUDIENCE_REFINEMENT, cutoff_7d):
        return 0

    # Use learning insights to find the best-performing intent
    best_intent = "PURCHASE"
    best_rate = 0
    for intent in ("PURCHASE", "COMPARISON", "COMPLAINT", "RECOMMENDATION", "QUESTION"):
        insight = insights.get(f"lead_conversion_by_intent:{intent}", {})
        rate = insight.get("conversion_rate", 0)
        if rate > best_rate:
            best_rate = rate
            best_intent = intent

    # Find best score range
    best_score_range = "50-75"
    best_score_rate = 0
    for bucket in ("0-25", "25-50", "50-75", "75-100"):
        insight = insights.get(f"lead_conversion_by_score:{bucket}", {})
        rate = insight.get("conversion_rate", 0)
        if rate > best_score_rate:
            best_score_rate = rate
            best_score_range = bucket

    min_score = int(best_score_range.split("-")[0])
    suggested_min = max(min_score, 50)

    db.add(OptimizationRecommendation(
        business_id=business.id,
        type=RecommendationType.AUDIENCE_REFINEMENT,
        title="Refine audience targeting — low conversion rate",
        description=f"Only {conversion_rate}% of leads converted. Best-performing intent: {best_intent} ({best_rate}%), best score range: {best_score_range}.",
        summary=f"Focus on {best_intent} intent with min score {suggested_min} to improve from {conversion_rate}% conversion",
        current_value=f"{conversion_rate}% conversion ({closed_leads}/{total_leads})",
        suggested_value=f"Focus on {best_intent} intent, min score {suggested_min}",
        confidence=int(60 + min(20, best_rate // 3)),
        impact_estimate="Higher quality leads, better conversion",
        impact_score=int(max(40, min(80, (15 - conversion_rate) * 5))),
        reasoning=f"Low conversion ({conversion_rate}%) suggests audience is too broad. Learning insights show {best_intent} intent converts at {best_rate}% and score range {best_score_range} performs best.",
        payload={
            "suggested_min_score": suggested_min,
            "suggested_intents": [best_intent],
            "best_score_range": best_score_range,
            "current_conversion": conversion_rate,
        },
    ))
    return 1


def _recommend_approval_threshold(db: Session, business: Business, cutoff_7d, insights: dict) -> int:
    """Approval threshold tuning from approval pattern learning."""
    recent_approvals = (
        db.query(Approval)
        .filter(Approval.business_id == business.id, Approval.created_at >= cutoff_7d)
        .all()
    )
    if len(recent_approvals) < 10:
        return 0

    auto_approvable = sum(1 for a in recent_approvals if a.confidence >= 85 and a.status == ApprovalStatus.EXECUTED)
    ratio = (auto_approvable * 100) // len(recent_approvals)

    if ratio < 80:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.APPROVAL_THRESHOLD, cutoff_7d):
        return 0

    # Check learning: what's the actual approval pattern?
    approval_insight = insights.get("approval_patterns:summary", {})
    avg_confidence = approval_insight.get("avg_confidence", 70)
    approval_rate = approval_insight.get("approval_rate", 50)

    suggested_threshold = int(max(75, min(90, avg_confidence - 5)))

    db.add(OptimizationRecommendation(
        business_id=business.id,
        type=RecommendationType.APPROVAL_THRESHOLD,
        title="Lower approval threshold — most items auto-approvable",
        description=f"{ratio}% of recent approvals had confidence >= 85 and were executed. Overall approval rate: {approval_rate}%.",
        summary=f"Switch to Operator mode with {suggested_threshold}% threshold based on {approval_rate}% historical approval rate",
        current_value="Manual review required",
        suggested_value=f"Operator mode with {suggested_threshold}% threshold",
        confidence=75 + min(10, ratio // 10),
        impact_estimate="Faster execution, less manual work",
        impact_score=max(40, min(70, ratio - 30)),
        reasoning=f"{auto_approvable}/{len(recent_approvals)} approvals were high-confidence. Avg confidence: {avg_confidence}%, approval rate: {approval_rate}%.",
        payload={"suggested_mode": "OPERATOR", "suggested_threshold": suggested_threshold, "avg_confidence": avg_confidence},
    ))
    return 1


def _recommend_autopilot(db: Session, business: Business, cutoff_7d, cutoff_30d) -> int:
    """Autopilot tuning based on review sentiment."""
    neg_reviews = (
        db.query(func.count(Review.id))
        .filter(Review.business_id == business.id, Review.sentiment == ReviewSentiment.NEG, Review.created_at >= cutoff_30d)
        .scalar()
    )
    total_reviews = (
        db.query(func.count(Review.id))
        .filter(Review.business_id == business.id, Review.created_at >= cutoff_30d)
        .scalar()
    )

    if total_reviews < 5 or neg_reviews == 0:
        return 0

    neg_pct = (neg_reviews * 100) // total_reviews
    if neg_pct < 30:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.AUTOPILOT_TUNING, cutoff_7d):
        return 0

    db.add(OptimizationRecommendation(
        business_id=business.id,
        type=RecommendationType.AUTOPILOT_TUNING,
        title="Pause autopilot — high negative review rate",
        description=f"{neg_pct}% negative reviews detected. Consider pausing autopilot and reviewing reputation strategy.",
        summary=f"Switch to ASSIST mode due to {neg_pct}% negative reviews ({neg_reviews}/{total_reviews})",
        current_value=f"{neg_reviews}/{total_reviews} negative reviews",
        suggested_value="Switch to ASSIST mode, review reputation",
        confidence=80,
        impact_estimate="Reduced reputational risk",
        impact_score=max(50, min(90, neg_pct)),
        reasoning="High negative sentiment suggests caution with automated actions.",
        payload={"suggested_mode": "ASSIST", "neg_pct": neg_pct},
    ))
    return 1


def _recommend_keyword_exclusions(db: Session, business: Business, cutoff_7d, cutoff_30d) -> int:
    """Suggest excluding weak-performing trend keywords."""
    trends = (
        db.query(Trend)
        .filter(Trend.business_id == business.id, Trend.created_at >= cutoff_30d)
        .order_by(Trend.spike_score.asc())
        .limit(20)
        .all()
    )

    if len(trends) < 5:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.AUDIENCE_REFINEMENT, cutoff_7d):
        return 0

    # Find trends that had low spike scores and no actions
    weak_topics = []
    for t in trends:
        if t.spike_score < 20:
            weak_topics.append(t.topic)

    if len(weak_topics) < 3:
        return 0

    # Check if there are attribution records for these weak trends
    # (if no attributions, they're truly weak)
    top_weak = weak_topics[:5]

    db.add(OptimizationRecommendation(
        business_id=business.id,
        type=RecommendationType.AUDIENCE_REFINEMENT,
        title="Exclude weak-performing keywords from monitoring",
        description=f"{len(weak_topics)} trend topics have very low spike scores (<20). Consider excluding them to reduce noise.",
        summary=f"Exclude {len(top_weak)} weak keywords: {', '.join(top_weak[:3])}{'...' if len(top_weak) > 3 else ''}",
        current_value=f"Monitoring {len(trends)} trend topics",
        suggested_value=f"Exclude: {', '.join(top_weak[:3])}",
        confidence=55,
        impact_estimate="Less noise, more relevant signals",
        impact_score=35,
        reasoning=f"{len(weak_topics)} topics have spike score <20, generating noise without actionable signals.",
        payload={"weak_topics": top_weak, "total_trends": len(trends)},
    ))
    return 1


def _recommend_playbook_from_patterns(db: Session, business: Business, cutoff_7d, cutoff_30d) -> int:
    """Suggest playbook creation when clear attribution patterns emerge."""
    # Check if there's a pattern of repeated action types
    attributed = (
        db.query(
            AttributionRecord.signal_type,
            AttributionRecord.execution_type,
            func.count(AttributionRecord.id).label("cnt"),
        )
        .filter(
            AttributionRecord.business_id == business.id,
            AttributionRecord.created_at >= cutoff_30d,
            AttributionRecord.outcome_type.isnot(None),
        )
        .group_by(AttributionRecord.signal_type, AttributionRecord.execution_type)
        .having(func.count(AttributionRecord.id) >= 3)
        .all()
    )

    if not attributed:
        return 0

    if _has_recent_rec(db, business.id, RecommendationType.PLAYBOOK_SUGGESTION, cutoff_7d):
        return 0

    # Find the strongest pattern
    best = max(attributed, key=lambda x: x[2])
    signal_type, exec_type, count = best

    db.add(OptimizationRecommendation(
        business_id=business.id,
        type=RecommendationType.PLAYBOOK_SUGGESTION,
        title=f"Create playbook: {signal_type} → {exec_type}",
        description=f"Detected {count} successful {signal_type} → {exec_type} paths in the last 30 days. Automate this pattern with a playbook.",
        summary=f"Automate the {signal_type} → {exec_type} pattern ({count} successful executions)",
        current_value="Manual",
        suggested_value=f"Playbook: {signal_type} triggers {exec_type}",
        confidence=60 + min(20, count * 3),
        impact_estimate="Automated response to recurring patterns",
        impact_score=max(30, min(70, count * 8)),
        reasoning=f"{count} attributed outcomes show a clear {signal_type} → {exec_type} pattern worth automating.",
        payload={"signal_type": signal_type, "execution_type": exec_type, "count": count},
    ))
    return 1


def _has_recent_rec(db: Session, business_id, rec_type: RecommendationType, cutoff: datetime) -> bool:
    """Check if a similar recommendation already exists recently."""
    return (
        db.query(OptimizationRecommendation)
        .filter(
            OptimizationRecommendation.business_id == business_id,
            OptimizationRecommendation.type == rec_type,
            OptimizationRecommendation.created_at >= cutoff,
        )
        .first()
    ) is not None
