"""
Historical Learning Engine v1: heuristic-based pattern detection from outcomes.

Learns:
- What kinds of leads convert best (by intent, score range, source)
- Which campaign drafts get approved most (by objective, platform, budget range)
- Which audiences get exported most
- Which trend types lead to actions
- Approval patterns (auto-approve rates by confidence/risk)
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models import (
    Action,
    Approval,
    ApprovalStatus,
    Audience,
    Business,
    Campaign,
    CampaignStatus,
    Export,
    ExportStatus,
    Feedback,
    FeedbackRating,
    Lead,
    LeadStatus,
    LearningInsight,
    Trend,
)

logger = logging.getLogger(__name__)


def compute_learning_insights(db: Session, business: Business) -> int:
    """Compute and store learning insights for a business. Returns count of insights updated."""
    updated = 0
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)
    cutoff_90d = now - timedelta(days=90)

    # 1. Lead conversion by intent
    updated += _learn_lead_conversion_by_intent(db, business, cutoff_90d, now)

    # 2. Lead conversion by score range
    updated += _learn_lead_conversion_by_score(db, business, cutoff_90d, now)

    # 3. Campaign approval rates by objective
    updated += _learn_campaign_approval_rates(db, business, cutoff_90d, now)

    # 4. Audience export frequency
    updated += _learn_audience_export_patterns(db, business, cutoff_90d, now)

    # 5. Trend-to-action conversion
    updated += _learn_trend_action_patterns(db, business, cutoff_90d, now)

    # 6. Approval patterns by confidence threshold
    updated += _learn_approval_patterns(db, business, cutoff_30d, now)

    # 7. Feedback patterns
    updated += _learn_feedback_patterns(db, business, cutoff_30d, now)

    if updated > 0:
        db.commit()

    return updated


def _upsert_insight(db: Session, business_id, insight_type: str, insight_key: str, value: dict, sample_size: int, now: datetime) -> bool:
    """Insert or update a learning insight. Returns True if changed."""
    existing = (
        db.query(LearningInsight)
        .filter(
            LearningInsight.business_id == business_id,
            LearningInsight.insight_type == insight_type,
            LearningInsight.insight_key == insight_key,
        )
        .first()
    )
    if existing:
        existing.value = value
        existing.sample_size = sample_size
        existing.computed_at = now
    else:
        db.add(LearningInsight(
            business_id=business_id,
            insight_type=insight_type,
            insight_key=insight_key,
            value=value,
            sample_size=sample_size,
            computed_at=now,
        ))
    return True


def _learn_lead_conversion_by_intent(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """Which lead intents convert best?"""
    results = (
        db.query(
            Lead.intent,
            func.count(Lead.id).label("total"),
            func.sum(case((Lead.status == LeadStatus.CLOSED, 1), else_=0)).label("converted"),
        )
        .filter(Lead.business_id == business.id, Lead.created_at >= cutoff)
        .group_by(Lead.intent)
        .all()
    )

    if not results:
        return 0

    updated = 0
    for intent, total, converted in results:
        if total < 3:
            continue
        rate = round((converted / total) * 100, 1) if total else 0
        _upsert_insight(db, business.id, "lead_conversion_by_intent", intent.value, {
            "conversion_rate": rate,
            "total": total,
            "converted": converted,
            "rank": "high" if rate >= 20 else "medium" if rate >= 10 else "low",
        }, total, now)
        updated += 1
    return updated


def _learn_lead_conversion_by_score(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """Which score ranges produce the best leads?"""
    # Bucket scores: 0-25, 25-50, 50-75, 75-100
    buckets = [(0, 25), (25, 50), (50, 75), (75, 100)]
    updated = 0

    for low, high in buckets:
        total = (
            db.query(func.count(Lead.id))
            .filter(Lead.business_id == business.id, Lead.score >= low, Lead.score < high, Lead.created_at >= cutoff)
            .scalar()
        )
        converted = (
            db.query(func.count(Lead.id))
            .filter(Lead.business_id == business.id, Lead.score >= low, Lead.score < high, Lead.status == LeadStatus.CLOSED, Lead.created_at >= cutoff)
            .scalar()
        )
        if total < 3:
            continue

        rate = round((converted / total) * 100, 1) if total else 0
        _upsert_insight(db, business.id, "lead_conversion_by_score", f"{low}-{high}", {
            "conversion_rate": rate,
            "total": total,
            "converted": converted,
            "min_score": low,
            "max_score": high,
        }, total, now)
        updated += 1
    return updated


def _learn_campaign_approval_rates(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """Which campaign types get approved most?"""
    campaigns = (
        db.query(Campaign)
        .filter(Campaign.business_id == business.id, Campaign.created_at >= cutoff)
        .all()
    )

    if len(campaigns) < 3:
        return 0

    # Group by objective
    by_objective: dict[str, dict] = {}
    for c in campaigns:
        obj = (c.draft or {}).get("objective", "unknown")
        if obj not in by_objective:
            by_objective[obj] = {"total": 0, "approved": 0, "published": 0}
        by_objective[obj]["total"] += 1
        if c.status in (CampaignStatus.APPROVED, CampaignStatus.EXECUTED, CampaignStatus.PUBLISHED, CampaignStatus.READY_TO_PUBLISH):
            by_objective[obj]["approved"] += 1
        if c.status == CampaignStatus.PUBLISHED:
            by_objective[obj]["published"] += 1

    updated = 0
    for obj, stats in by_objective.items():
        if stats["total"] < 2:
            continue
        approval_rate = round((stats["approved"] / stats["total"]) * 100, 1)
        _upsert_insight(db, business.id, "campaign_approval_by_objective", obj, {
            "approval_rate": approval_rate,
            "publish_rate": round((stats["published"] / stats["total"]) * 100, 1),
            **stats,
        }, stats["total"], now)
        updated += 1
    return updated


def _learn_audience_export_patterns(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """Which audiences get exported most?"""
    results = (
        db.query(
            Export.audience_id,
            func.count(Export.id).label("export_count"),
            func.sum(case((Export.status == ExportStatus.READY, 1), else_=0)).label("successful"),
        )
        .filter(Export.business_id == business.id, Export.created_at >= cutoff, Export.audience_id.isnot(None))
        .group_by(Export.audience_id)
        .all()
    )

    updated = 0
    for audience_id, count, successful in results:
        if count < 2:
            continue
        audience = db.get(Audience, audience_id)
        _upsert_insight(db, business.id, "audience_export_frequency", str(audience_id), {
            "export_count": count,
            "successful": successful,
            "audience_name": audience.name if audience else "Unknown",
            "definition": audience.definition if audience else None,
        }, count, now)
        updated += 1
    return updated


def _learn_trend_action_patterns(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """Which trend topics lead to actions?"""
    trends = (
        db.query(Trend)
        .filter(Trend.business_id == business.id, Trend.created_at >= cutoff)
        .all()
    )

    if len(trends) < 3:
        return 0

    # Count how many actions reference each trend topic
    actions = (
        db.query(Action)
        .filter(Action.business_id == business.id, Action.created_at >= cutoff)
        .all()
    )

    topic_actions: dict[str, int] = {}
    for t in trends:
        topic_actions[t.topic] = 0

    for a in actions:
        if a.payload:
            # Check if action payload references a trend topic
            for t in trends:
                payload_str = str(a.payload)
                if t.topic.lower() in payload_str.lower():
                    topic_actions[t.topic] = topic_actions.get(t.topic, 0) + 1

    updated = 0
    for topic, action_count in topic_actions.items():
        trend = next((t for t in trends if t.topic == topic), None)
        if not trend:
            continue
        _upsert_insight(db, business.id, "trend_action_conversion", topic, {
            "spike_score": trend.spike_score,
            "actions_generated": action_count,
            "has_action": action_count > 0,
        }, 1, now)
        updated += 1
    return updated


def _learn_approval_patterns(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """What confidence levels get auto-approved?"""
    approvals = (
        db.query(Approval)
        .filter(Approval.business_id == business.id, Approval.created_at >= cutoff)
        .all()
    )

    if len(approvals) < 5:
        return 0

    total = len(approvals)
    approved = sum(1 for a in approvals if a.status == ApprovalStatus.EXECUTED)
    rejected = sum(1 for a in approvals if a.status == ApprovalStatus.REJECTED)
    high_conf_approved = sum(1 for a in approvals if a.confidence >= 85 and a.status == ApprovalStatus.EXECUTED)
    low_risk_approved = sum(1 for a in approvals if a.risk.value == "LOW" and a.status == ApprovalStatus.EXECUTED)

    _upsert_insight(db, business.id, "approval_patterns", "summary", {
        "total": total,
        "approval_rate": round((approved / total) * 100, 1),
        "rejection_rate": round((rejected / total) * 100, 1),
        "high_conf_approval_rate": round((high_conf_approved / total) * 100, 1) if total else 0,
        "low_risk_approval_rate": round((low_risk_approved / total) * 100, 1) if total else 0,
        "avg_confidence": round(sum(a.confidence for a in approvals) / total, 1),
    }, total, now)
    return 1


def _learn_feedback_patterns(db: Session, business: Business, cutoff: datetime, now: datetime) -> int:
    """What feedback patterns exist?"""
    good = (
        db.query(func.count(Feedback.id))
        .filter(Feedback.business_id == business.id, Feedback.rating == FeedbackRating.GOOD, Feedback.created_at >= cutoff)
        .scalar()
    )
    bad = (
        db.query(func.count(Feedback.id))
        .filter(Feedback.business_id == business.id, Feedback.rating == FeedbackRating.BAD, Feedback.created_at >= cutoff)
        .scalar()
    )
    total = good + bad
    if total < 3:
        return 0

    _upsert_insight(db, business.id, "feedback_patterns", "summary", {
        "total": total,
        "good": good,
        "bad": bad,
        "satisfaction_rate": round((good / total) * 100, 1),
    }, total, now)
    return 1


def get_insights_for_business(db: Session, business_id) -> dict[str, list[dict]]:
    """Get all learning insights grouped by type."""
    insights = (
        db.query(LearningInsight)
        .filter(LearningInsight.business_id == business_id)
        .order_by(LearningInsight.computed_at.desc())
        .all()
    )

    grouped: dict[str, list[dict]] = {}
    for i in insights:
        if i.insight_type not in grouped:
            grouped[i.insight_type] = []
        grouped[i.insight_type].append({
            "key": i.insight_key,
            "value": i.value,
            "sample_size": i.sample_size,
            "computed_at": i.computed_at.isoformat() if i.computed_at else None,
        })
    return grouped
