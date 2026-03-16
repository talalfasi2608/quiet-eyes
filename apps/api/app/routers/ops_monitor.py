"""Ops monitoring — system health, cost tracking, usage analytics for admins."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.cost_tracker import get_cost_summary, AI_CALL_LIMITS, COST_ESTIMATES
from app.database import get_db
from app.deps import get_current_user
from app.health import get_latency_stats
from app.ingestion.scan_scheduler import get_scan_stats
from app.models import (
    Business,
    CostEvent,
    FailedJob,
    IntegrationEvent,
    IntegrationEventStatus,
    Org,
    PlanTier,
    Source,
    SourceHealth,
    SourceHealthStatus,
    Subscription,
    SubscriptionStatus,
    UsageCounter,
    User,
    UserRole,
)
from app.quota import PLAN_LIMITS, get_month_usage, get_org_plan, get_today_usage

router = APIRouter(tags=["ops-monitor"], prefix="/ops")


def _require_admin(user: User = Depends(get_current_user)) -> User:
    admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if user.role in (UserRole.OWNER, UserRole.ADMIN) or user.email in admin_emails:
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


# ── System Health Dashboard ──


@router.get("/system/health")
def system_health(user: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """Comprehensive system health overview."""
    latency = get_latency_stats()
    scan_stats = get_scan_stats(db)

    # Failed jobs summary
    failed_count = db.query(func.count(FailedJob.id)).filter(FailedJob.status == "FAILED").scalar() or 0
    dead_count = db.query(func.count(FailedJob.id)).filter(FailedJob.status == "DEAD").scalar() or 0

    # Integration failures (last 24h)
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    integration_failures_24h = (
        db.query(func.count(IntegrationEvent.id))
        .filter(
            IntegrationEvent.status == IntegrationEventStatus.FAILED,
            IntegrationEvent.created_at >= day_ago,
        )
        .scalar()
    ) or 0

    # Source health
    degraded_sources = (
        db.query(func.count(SourceHealth.id))
        .filter(SourceHealth.status != SourceHealthStatus.OK)
        .scalar()
    ) or 0

    return {
        "api_latency": latency,
        "job_queue": {
            "failed_jobs": failed_count,
            "dead_jobs": dead_count,
        },
        "integrations": {
            "failures_24h": integration_failures_24h,
        },
        "sources": {
            "degraded_count": degraded_sources,
            **scan_stats,
        },
    }


# ── Cost Monitoring ──


@router.get("/costs/summary")
def cost_summary(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Cost summary for the admin's organization."""
    return get_cost_summary(db, user.org_id, days)


@router.get("/costs/by-org")
def cost_by_org(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Cost breakdown by organization (platform-wide admin view)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            CostEvent.org_id,
            func.count(CostEvent.id).label("event_count"),
            func.sum(CostEvent.estimated_cost_usd).label("total_cost"),
        )
        .filter(CostEvent.created_at >= cutoff)
        .group_by(CostEvent.org_id)
        .order_by(func.sum(CostEvent.estimated_cost_usd).desc())
        .limit(50)
        .all()
    )

    result = []
    for row in rows:
        org = db.get(Org, row.org_id)
        result.append({
            "org_id": str(row.org_id),
            "org_name": org.name if org else "Unknown",
            "event_count": row.event_count,
            "total_cost_usd": round(float(row.total_cost), 4),
        })

    return {"period_days": days, "orgs": result}


@router.get("/costs/ai-budget")
def ai_budget_status(
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Current AI budget status for the admin's org."""
    plan = get_org_plan(db, user.org_id)
    limit = AI_CALL_LIMITS.get(plan, 50)
    counter = get_today_usage(db, user.org_id)

    return {
        "plan": plan.value,
        "ai_calls_today": counter.ai_calls_count,
        "ai_calls_limit": limit,
        "remaining": max(0, limit - counter.ai_calls_count),
        "pct_used": round(counter.ai_calls_count / limit * 100, 1) if limit else 0,
    }


@router.get("/costs/rate-card")
def cost_rate_card(user: User = Depends(_require_admin)):
    """Display current estimated cost rates for all operations."""
    return {"rates": COST_ESTIMATES, "ai_call_limits_by_plan": {k.value: v for k, v in AI_CALL_LIMITS.items()}}


# ── Usage Analytics ──


@router.get("/usage/trends")
def usage_trends(
    days: int = Query(14, ge=1, le=90),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Daily usage trends for the org."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    counters = (
        db.query(UsageCounter)
        .filter(UsageCounter.org_id == user.org_id, UsageCounter.date >= cutoff)
        .order_by(UsageCounter.date.asc())
        .all()
    )

    trend = []
    for c in counters:
        trend.append({
            "date": c.date.isoformat(),
            "scans": c.scans_count,
            "chat_tokens": c.chat_tokens,
            "exports": c.exports_count,
            "approvals": c.approvals_count,
            "ai_calls": c.ai_calls_count,
            "ingestions": c.ingestion_count,
            "estimated_cost_usd": round(c.estimated_cost_usd, 4),
        })

    return {"period_days": days, "daily": trend}


@router.get("/usage/by-org")
def usage_by_org(
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Usage summary grouped by organization (platform admin view)."""
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rows = (
        db.query(
            UsageCounter.org_id,
            func.sum(UsageCounter.scans_count).label("scans"),
            func.sum(UsageCounter.chat_tokens).label("chat"),
            func.sum(UsageCounter.ai_calls_count).label("ai_calls"),
            func.sum(UsageCounter.estimated_cost_usd).label("cost"),
        )
        .filter(UsageCounter.date >= month_start)
        .group_by(UsageCounter.org_id)
        .order_by(func.sum(UsageCounter.estimated_cost_usd).desc())
        .limit(50)
        .all()
    )

    result = []
    for row in rows:
        org = db.get(Org, row.org_id)
        plan = get_org_plan(db, row.org_id)
        result.append({
            "org_id": str(row.org_id),
            "org_name": org.name if org else "Unknown",
            "plan": plan.value,
            "month_scans": int(row.scans or 0),
            "month_chat": int(row.chat or 0),
            "month_ai_calls": int(row.ai_calls or 0),
            "month_cost_usd": round(float(row.cost or 0), 4),
        })

    return {"month": month_start.strftime("%Y-%m"), "orgs": result}


# ── Quota Observability ──


@router.get("/quota/status")
def quota_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detailed quota status with usage trends and warnings."""
    plan = get_org_plan(db, user.org_id)
    limits = PLAN_LIMITS[plan]
    today = get_today_usage(db, user.org_id)
    month = get_month_usage(db, user.org_id)
    ai_limit = AI_CALL_LIMITS.get(plan, 50)

    # Build per-resource status
    resources = []
    for resource, current, limit, period in [
        ("scans", today.scans_count, limits["scans_per_day"], "daily"),
        ("chat", today.chat_tokens, limits["chat_per_day"], "daily"),
        ("exports", month["exports_count"], limits["exports_per_month"], "monthly"),
        ("approvals", month["approvals_count"], limits["approvals_per_month"], "monthly"),
        ("ai_calls", today.ai_calls_count, ai_limit, "daily"),
    ]:
        pct = round(current / limit * 100, 1) if limit else 0
        status = "ok"
        if pct >= 100:
            status = "exceeded"
        elif pct >= 80:
            status = "warning"
        elif pct >= 60:
            status = "approaching"

        resources.append({
            "resource": resource,
            "current": current,
            "limit": limit,
            "period": period,
            "pct_used": pct,
            "status": status,
        })

    # Find which resources are closest to limit
    warnings = [r for r in resources if r["status"] in ("warning", "exceeded")]

    return {
        "plan": plan.value,
        "resources": resources,
        "warnings": warnings,
        "upgrade_url": "/billing",
    }
