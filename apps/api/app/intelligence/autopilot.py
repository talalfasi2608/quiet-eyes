"""Autopilot scheduler — prioritization engine + daily digest generation."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AutopilotMode,
    AutopilotSettings,
    CompetitorEvent,
    Digest,
    Lead,
    LeadStatus,
    Review,
    ReviewSentiment,
    RiskLevel,
    Trend,
)

RISK_SCORE = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 15, RiskLevel.HIGH: 35}
RISK_BY_ACTION = {
    ActionType.REPLY_DRAFT: RiskLevel.LOW,
    ActionType.AUDIENCE_DRAFT: RiskLevel.MEDIUM,
    ActionType.CAMPAIGN_DRAFT: RiskLevel.HIGH,
    ActionType.CRM_SYNC: RiskLevel.LOW,
    ActionType.EXPORT: RiskLevel.LOW,
}


def compute_priority_score(
    impact: int, confidence: int, urgency: int, risk: RiskLevel
) -> int:
    """priority_score = impact * confidence * urgency - risk_penalty, scaled 0-100."""
    raw = (impact * confidence * urgency) / 10000
    penalty = RISK_SCORE.get(risk, 0)
    return max(0, min(100, int(raw - penalty)))


def assign_priority_scores(db: Session, business_id) -> int:
    """Compute and assign priority_score for all PENDING approvals of a business."""
    pending = (
        db.query(Approval)
        .filter(
            Approval.business_id == business_id,
            Approval.status == ApprovalStatus.PENDING,
        )
        .all()
    )
    updated = 0
    for approval in pending:
        action = db.get(Action, approval.action_id)
        if not action:
            continue

        impact = approval.cost_impact or 50
        confidence = approval.confidence or 50
        # Urgency: older items are more urgent (max 100)
        age_hours = (datetime.now(timezone.utc) - approval.created_at).total_seconds() / 3600
        urgency = min(100, int(50 + age_hours * 2))

        risk = approval.risk or RiskLevel.LOW
        score = compute_priority_score(impact, confidence, urgency, risk)
        approval.priority_score = score
        updated += 1

    db.flush()
    return updated


def run_autopilot(db: Session, business_id) -> dict:
    """Run the autopilot scheduler for a business.

    1. Scan top opportunities (trends, neg reviews, competitor events)
    2. Create draft actions for high-confidence items
    3. Prioritize all pending approvals
    4. Auto-execute if mode=AUTOPILOT and thresholds met
    5. Generate daily digest
    """
    settings = (
        db.query(AutopilotSettings)
        .filter(AutopilotSettings.business_id == business_id)
        .first()
    )
    if not settings:
        # Create default settings
        settings = AutopilotSettings(business_id=business_id)
        db.add(settings)
        db.flush()

    cutoff = datetime.now(timezone.utc) - timedelta(days=1)
    actions_created = 0
    allowed = settings.allowed_actions or [at.value for at in ActionType]

    # 1. Auto-draft actions from high-confidence opportunities
    # Negative reviews without existing reply drafts
    if ActionType.REPLY_DRAFT.value in allowed:
        neg_reviews = (
            db.query(Review)
            .filter(
                Review.business_id == business_id,
                Review.sentiment == ReviewSentiment.NEG,
                Review.created_at >= cutoff,
            )
            .all()
        )
        for review in neg_reviews:
            # Check if action already exists for this review
            existing = (
                db.query(Action)
                .filter(
                    Action.business_id == business_id,
                    Action.type == ActionType.REPLY_DRAFT,
                )
                .all()
            )
            already_handled = any(
                a.payload and a.payload.get("review_id") == str(review.id)
                for a in existing
            )
            if not already_handled:
                action = Action(
                    business_id=business_id,
                    type=ActionType.REPLY_DRAFT,
                    payload={
                        "review_id": str(review.id),
                        "reply_text": f"Thank you for your feedback. We take all reviews seriously and would like to address your concerns.",
                        "confidence": 75,
                        "source": "autopilot",
                    },
                )
                db.add(action)
                db.flush()
                approval = Approval(
                    business_id=business_id,
                    action_id=action.id,
                    risk=RiskLevel.LOW,
                    confidence=75,
                    cost_impact=0,
                )
                db.add(approval)
                actions_created += 1

    # High spike trends -> audience drafts
    if ActionType.AUDIENCE_DRAFT.value in allowed:
        hot_trends = (
            db.query(Trend)
            .filter(
                Trend.business_id == business_id,
                Trend.created_at >= cutoff,
                Trend.spike_score >= 60,
            )
            .all()
        )
        for trend in hot_trends:
            existing = (
                db.query(Action)
                .filter(
                    Action.business_id == business_id,
                    Action.type == ActionType.AUDIENCE_DRAFT,
                )
                .all()
            )
            already_handled = any(
                a.payload and a.payload.get("trend_id") == str(trend.id)
                for a in existing
            )
            if not already_handled:
                action = Action(
                    business_id=business_id,
                    type=ActionType.AUDIENCE_DRAFT,
                    payload={
                        "audience_name": f"Trend: {trend.topic}",
                        "source": "autopilot",
                        "trend_id": str(trend.id),
                        "confidence": min(100, trend.spike_score),
                    },
                )
                db.add(action)
                db.flush()
                approval = Approval(
                    business_id=business_id,
                    action_id=action.id,
                    risk=RiskLevel.MEDIUM,
                    confidence=min(100, trend.spike_score),
                    cost_impact=0,
                )
                db.add(approval)
                actions_created += 1

    db.flush()

    # 2. Assign priority scores to all pending approvals
    assign_priority_scores(db, business_id)

    # 3. Auto-execute high-confidence, low-risk items in AUTOPILOT mode
    auto_executed = 0
    if settings.mode == AutopilotMode.AUTOPILOT and settings.is_enabled:
        pending = (
            db.query(Approval)
            .filter(
                Approval.business_id == business_id,
                Approval.status == ApprovalStatus.PENDING,
                Approval.confidence >= settings.confidence_threshold,
            )
            .all()
        )
        risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]
        max_risk_idx = risk_order.index(settings.risk_tolerance)
        daily_spent = 0

        for approval in pending:
            risk_idx = risk_order.index(approval.risk) if approval.risk in risk_order else 2
            if risk_idx > max_risk_idx:
                continue
            if settings.daily_budget_cap > 0 and daily_spent + approval.cost_impact > settings.daily_budget_cap:
                continue
            approval.status = ApprovalStatus.EXECUTED
            approval.decided_at = datetime.now(timezone.utc)
            daily_spent += approval.cost_impact
            auto_executed += 1

    db.flush()

    # 4. Generate daily digest
    digest = generate_digest(db, business_id)
    db.commit()

    return {
        "actions_created": actions_created,
        "approvals_auto_executed": auto_executed,
        "digest_created": digest is not None,
    }


def generate_digest(db: Session, business_id) -> Digest | None:
    """Generate a daily digest summarizing activity."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=1)

    # Count recent items
    pending_count = (
        db.query(Approval)
        .filter(
            Approval.business_id == business_id,
            Approval.status == ApprovalStatus.PENDING,
        )
        .count()
    )
    executed_count = (
        db.query(Approval)
        .filter(
            Approval.business_id == business_id,
            Approval.status == ApprovalStatus.EXECUTED,
            Approval.decided_at >= cutoff,
        )
        .count()
    )
    new_leads = (
        db.query(Lead)
        .filter(
            Lead.business_id == business_id,
            Lead.created_at >= cutoff,
            Lead.status == LeadStatus.NEW,
        )
        .count()
    )
    trends_count = (
        db.query(Trend)
        .filter(Trend.business_id == business_id, Trend.created_at >= cutoff)
        .count()
    )
    reviews_count = (
        db.query(Review)
        .filter(Review.business_id == business_id, Review.created_at >= cutoff)
        .count()
    )
    events_count = (
        db.query(CompetitorEvent)
        .filter(CompetitorEvent.business_id == business_id, CompetitorEvent.created_at >= cutoff)
        .count()
    )

    # Top pending by priority
    top_pending = (
        db.query(Approval)
        .filter(
            Approval.business_id == business_id,
            Approval.status == ApprovalStatus.PENDING,
        )
        .order_by(Approval.priority_score.desc())
        .limit(5)
        .all()
    )

    items_data = {
        "pending_approvals": pending_count,
        "executed_today": executed_count,
        "new_leads": new_leads,
        "new_trends": trends_count,
        "new_reviews": reviews_count,
        "competitor_events": events_count,
        "top_pending": [
            {
                "id": str(a.id),
                "priority_score": a.priority_score,
                "confidence": a.confidence,
                "risk": a.risk.value if a.risk else "LOW",
            }
            for a in top_pending
        ],
    }

    parts = []
    if new_leads > 0:
        parts.append(f"{new_leads} new leads")
    if trends_count > 0:
        parts.append(f"{trends_count} trends")
    if reviews_count > 0:
        parts.append(f"{reviews_count} reviews")
    if events_count > 0:
        parts.append(f"{events_count} competitor events")
    if pending_count > 0:
        parts.append(f"{pending_count} pending approvals")
    if executed_count > 0:
        parts.append(f"{executed_count} auto-executed")

    summary = "Daily digest: " + (", ".join(parts) if parts else "No activity")

    digest = Digest(
        business_id=business_id,
        date=now,
        summary=summary,
        items=items_data,
    )
    db.add(digest)
    db.flush()
    return digest
