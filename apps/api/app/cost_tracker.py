"""Cost tracking — estimates and records operational costs per org/business."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import CostEvent, PlanTier
from app.quota import get_org_plan, get_today_usage

# Estimated cost per operation (USD)
COST_ESTIMATES = {
    "ai_call": {
        "lead_scoring": 0.003,       # ~1K tokens in/out
        "chat_reply": 0.005,         # ~2K tokens
        "campaign_draft": 0.008,     # ~3K tokens
        "audience_draft": 0.004,     # ~1.5K tokens
        "outbound_draft": 0.005,     # ~2K tokens
        "prediction_run": 0.002,     # ~800 tokens
        "optimization_run": 0.004,   # ~1.5K tokens
    },
    "ingestion": {
        "search_scan": 0.01,         # Tavily API call
        "rss_fetch": 0.001,          # HTTP fetch
        "scrape": 0.005,             # Scraping service
    },
    "export": {
        "csv_export": 0.002,
        "json_export": 0.001,
    },
    "queue": {
        "celery_task": 0.0005,       # Compute cost per task
    },
    "storage": {
        "mention_stored": 0.00001,   # Per row storage estimate
        "export_file": 0.001,        # Per file
    },
}

# AI call limits per plan (daily)
AI_CALL_LIMITS = {
    PlanTier.STARTER: 50,
    PlanTier.PRO: 500,
    PlanTier.PREMIUM: 5000,
}


def record_cost(
    db: Session,
    org_id: uuid.UUID,
    category: str,
    operation: str,
    business_id: uuid.UUID | None = None,
    tokens_used: int | None = None,
    meta: dict | None = None,
) -> CostEvent:
    """Record an estimated cost event and update the daily usage counter."""
    cost = COST_ESTIMATES.get(category, {}).get(operation, 0.001)
    if tokens_used:
        # Override with actual token-based cost if available
        cost = tokens_used * 0.000003  # ~$3 per 1M tokens estimate

    event = CostEvent(
        org_id=org_id,
        business_id=business_id,
        category=category,
        operation=operation,
        estimated_cost_usd=cost,
        tokens_used=tokens_used,
        meta=meta,
    )
    db.add(event)

    # Update daily counter
    counter = get_today_usage(db, org_id)
    counter.estimated_cost_usd += cost
    if category == "ai_call":
        counter.ai_calls_count += 1
    elif category == "ingestion":
        counter.ingestion_count += 1

    db.flush()
    return event


def check_ai_budget(db: Session, org_id: uuid.UUID) -> bool:
    """Check if the org has remaining AI call budget for today. Returns True if within budget."""
    plan = get_org_plan(db, org_id)
    limit = AI_CALL_LIMITS.get(plan, 50)
    counter = get_today_usage(db, org_id)
    return counter.ai_calls_count < limit


def get_cost_summary(db: Session, org_id: uuid.UUID, days: int = 30) -> dict:
    """Get cost summary for an org over the given period."""
    from sqlalchemy import func
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Total cost
    total = (
        db.query(func.coalesce(func.sum(CostEvent.estimated_cost_usd), 0))
        .filter(CostEvent.org_id == org_id, CostEvent.created_at >= cutoff)
        .scalar()
    )

    # Cost by category
    by_category = dict(
        db.query(CostEvent.category, func.sum(CostEvent.estimated_cost_usd))
        .filter(CostEvent.org_id == org_id, CostEvent.created_at >= cutoff)
        .group_by(CostEvent.category)
        .all()
    )

    # Cost by day (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily = (
        db.query(
            func.date_trunc("day", CostEvent.created_at).label("day"),
            func.sum(CostEvent.estimated_cost_usd).label("cost"),
        )
        .filter(CostEvent.org_id == org_id, CostEvent.created_at >= seven_days_ago)
        .group_by("day")
        .order_by("day")
        .all()
    )
    daily_trend = [
        {"date": row.day.isoformat() if row.day else None, "cost": round(float(row.cost), 4)}
        for row in daily
    ]

    # Top operations
    top_ops = (
        db.query(
            CostEvent.operation,
            func.count(CostEvent.id).label("count"),
            func.sum(CostEvent.estimated_cost_usd).label("total_cost"),
        )
        .filter(CostEvent.org_id == org_id, CostEvent.created_at >= cutoff)
        .group_by(CostEvent.operation)
        .order_by(func.sum(CostEvent.estimated_cost_usd).desc())
        .limit(10)
        .all()
    )
    top_operations = [
        {"operation": row.operation, "count": row.count, "total_cost": round(float(row.total_cost), 4)}
        for row in top_ops
    ]

    return {
        "total_cost_usd": round(float(total), 4),
        "by_category": {k: round(float(v), 4) for k, v in by_category.items()},
        "daily_trend": daily_trend,
        "top_operations": top_operations,
        "period_days": days,
    }
