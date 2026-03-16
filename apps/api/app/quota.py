"""Quota enforcement — plan limits and usage tracking."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import PlanTier, Subscription, SubscriptionStatus, UsageCounter

# Plan quotas: {plan: {resource: daily/monthly limit}}
# scans_per_day, chat_per_day, exports_per_month, approvals_per_month
PLAN_LIMITS: dict[PlanTier, dict[str, int]] = {
    PlanTier.STARTER: {
        "scans_per_day": 5,
        "chat_per_day": 50,
        "exports_per_month": 3,
        "approvals_per_month": 20,
    },
    PlanTier.PRO: {
        "scans_per_day": 30,
        "chat_per_day": 500,
        "exports_per_month": 20,
        "approvals_per_month": 200,
    },
    PlanTier.PREMIUM: {
        "scans_per_day": 200,
        "chat_per_day": 5000,
        "exports_per_month": 100,
        "approvals_per_month": 2000,
    },
}


def get_org_plan(db: Session, org_id) -> PlanTier:
    """Get the active plan for an org, defaulting to STARTER."""
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.org_id == org_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
        .first()
    )
    if sub:
        return sub.plan
    return PlanTier.STARTER


def get_today_usage(db: Session, org_id) -> UsageCounter:
    """Get or create today's usage counter for the org."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    counter = (
        db.query(UsageCounter)
        .filter(UsageCounter.org_id == org_id, UsageCounter.date == today)
        .first()
    )
    if not counter:
        counter = UsageCounter(org_id=org_id, date=today)
        db.add(counter)
        db.flush()
    return counter


def get_month_usage(db: Session, org_id) -> dict[str, int]:
    """Aggregate this month's usage."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    counters = (
        db.query(UsageCounter)
        .filter(UsageCounter.org_id == org_id, UsageCounter.date >= month_start)
        .all()
    )
    totals = {"exports_count": 0, "approvals_count": 0, "scans_count": 0, "chat_tokens": 0}
    for c in counters:
        totals["exports_count"] += c.exports_count
        totals["approvals_count"] += c.approvals_count
        totals["scans_count"] += c.scans_count
        totals["chat_tokens"] += c.chat_tokens
    return totals


def check_quota(db: Session, org_id, resource: str) -> None:
    """Check if the org has quota remaining for the given resource.

    Raises HTTPException 402 with QUOTA_EXCEEDED code if exceeded.
    resource: "scan" | "chat" | "export" | "approval"
    """
    plan = get_org_plan(db, org_id)
    limits = PLAN_LIMITS[plan]
    counter = get_today_usage(db, org_id)

    if resource == "scan":
        if counter.scans_count >= limits["scans_per_day"]:
            _raise_quota_error("scans", counter.scans_count, limits["scans_per_day"])
    elif resource == "chat":
        if counter.chat_tokens >= limits["chat_per_day"]:
            _raise_quota_error("chat messages", counter.chat_tokens, limits["chat_per_day"])
    elif resource == "export":
        month = get_month_usage(db, org_id)
        if month["exports_count"] >= limits["exports_per_month"]:
            _raise_quota_error("exports", month["exports_count"], limits["exports_per_month"])
    elif resource == "approval":
        month = get_month_usage(db, org_id)
        if month["approvals_count"] >= limits["approvals_per_month"]:
            _raise_quota_error("approvals", month["approvals_count"], limits["approvals_per_month"])


def _raise_quota_error(resource: str, current: int, limit: int) -> None:
    raise HTTPException(
        status_code=402,
        detail={
            "code": "QUOTA_EXCEEDED",
            "detail": f"You have reached your {resource} limit ({current}/{limit}). Please upgrade your plan.",
            "resource": resource,
            "current": current,
            "limit": limit,
            "upgrade_url": "/billing",
        },
    )


def increment_usage(db: Session, org_id, resource: str, amount: int = 1) -> None:
    """Increment usage counter for the given resource."""
    counter = get_today_usage(db, org_id)
    if resource == "scan":
        counter.scans_count += amount
    elif resource == "chat":
        counter.chat_tokens += amount
    elif resource == "export":
        counter.exports_count += amount
    elif resource == "approval":
        counter.approvals_count += amount
    elif resource == "ai_call":
        counter.ai_calls_count += amount
    elif resource == "ingestion":
        counter.ingestion_count += amount
    db.flush()
