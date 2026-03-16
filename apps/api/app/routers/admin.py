"""Admin console — platform health, jobs, usage summary."""

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import (
    Action,
    Approval,
    ApprovalStatus,
    Business,
    Export,
    ExportStatus,
    Lead,
    Mention,
    Org,
    Source,
    SourceHealth,
    Subscription,
    SubscriptionStatus,
    User,
    UserRole,
)
from app.schemas import AdminJobStatusOut, AdminUsageSummaryOut, SourceHealthOut

router = APIRouter(tags=["admin"], prefix="/admin")


def _require_admin(user: User = Depends(get_current_user)) -> User:
    """Check if the user is an admin via role or env allowlist."""
    admin_emails = [
        e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()
    ]
    if user.role == UserRole.ADMIN or user.email in admin_emails:
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


# ── Source Health ──


@router.get("/sources/health", response_model=list[SourceHealthOut])
def get_source_health(
    db: Session = Depends(get_db),
    user: User = Depends(_require_admin),
):
    healths = db.query(SourceHealth).all()

    result = []
    for h in healths:
        source = db.get(Source, h.source_id)
        result.append(SourceHealthOut(
            id=h.id,
            source_id=h.source_id,
            source_name=source.name if source else None,
            source_type=source.type.value if source else None,
            last_run_at=h.last_run_at,
            status=h.status,
            last_error=h.last_error,
            created_at=h.created_at,
        ))

    # If no health records, show all sources with OK status
    if not result:
        sources = db.query(Source).all()
        for s in sources:
            result.append(SourceHealthOut(
                id=s.id,
                source_id=s.id,
                source_name=s.name,
                source_type=s.type.value,
                last_run_at=None,
                status="OK",
                last_error=None,
                created_at=s.created_at,
            ))

    return result


# ── Job Status (stub) ──


@router.get("/jobs/status", response_model=AdminJobStatusOut)
def get_job_status(
    db: Session = Depends(get_db),
    user: User = Depends(_require_admin),
):
    # Stub: count pending approvals and exports as "jobs"
    pending_approvals = (
        db.query(func.count(Approval.id))
        .filter(Approval.status == ApprovalStatus.PENDING)
        .scalar()
    ) or 0

    pending_exports = (
        db.query(func.count(Export.id))
        .filter(Export.status == ExportStatus.PENDING)
        .scalar()
    ) or 0

    # Try to get Celery queue stats if available
    celery_active = 0
    celery_scheduled = 0
    celery_reserved = 0
    try:
        from celery import Celery
        celery_app = Celery(broker=settings.REDIS_URL)
        inspect = celery_app.control.inspect(timeout=1)
        active = inspect.active() or {}
        scheduled = inspect.scheduled() or {}
        reserved = inspect.reserved() or {}
        celery_active = sum(len(v) for v in active.values())
        celery_scheduled = sum(len(v) for v in scheduled.values())
        celery_reserved = sum(len(v) for v in reserved.values())
    except Exception:
        pass  # Celery not available

    return AdminJobStatusOut(
        celery_active=celery_active,
        celery_scheduled=celery_scheduled,
        celery_reserved=celery_reserved,
        pending_approvals=pending_approvals,
        pending_exports=pending_exports,
    )


# ── Usage Summary ──


@router.get("/usage/summary", response_model=AdminUsageSummaryOut)
def get_usage_summary(
    db: Session = Depends(get_db),
    user: User = Depends(_require_admin),
):
    return AdminUsageSummaryOut(
        total_orgs=db.query(func.count(Org.id)).scalar() or 0,
        total_users=db.query(func.count(User.id)).scalar() or 0,
        total_businesses=db.query(func.count(Business.id)).scalar() or 0,
        total_mentions=db.query(func.count(Mention.id)).scalar() or 0,
        total_leads=db.query(func.count(Lead.id)).scalar() or 0,
        total_actions=db.query(func.count(Action.id)).scalar() or 0,
        total_approvals=db.query(func.count(Approval.id)).scalar() or 0,
        active_subscriptions=(
            db.query(func.count(Subscription.id))
            .filter(Subscription.status == SubscriptionStatus.ACTIVE)
            .scalar()
        ) or 0,
    )
