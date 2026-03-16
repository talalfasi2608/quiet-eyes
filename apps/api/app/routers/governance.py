"""
Enterprise Governance API endpoints.

Endpoints:
- GET/PUT  /org/permissions/{role}       — get/set permissions for a role
- GET      /org/permissions              — list all role-permission mappings
- CRUD     /org/approval-policies        — manage approval policies
- GET      /org/approval-policies/evaluate — evaluate policies for an action
- GET      /admin/failed-jobs            — list failed jobs
- POST     /admin/failed-jobs/{id}/retry — retry a failed job
- POST     /admin/failed-jobs/{id}/resolve — mark a failed job resolved
- GET      /admin/ops/overview           — ops console overview
- GET      /admin/audit/export           — export audit log as JSON
- GET      /admin/approvals/export       — export approvals history as JSON
- GET      /admin/integrations/export    — export integration events as JSON
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import (
    DEFAULT_ROLE_PERMISSIONS,
    get_current_user,
    require_permission,
    require_role,
)
from app.models import (
    Approval,
    ApprovalPolicy,
    ApprovalStatus,
    AuditLog,
    Business,
    Export,
    ExportStatus,
    FailedJob,
    IntegrationEvent,
    IntegrationEventStatus,
    Org,
    Permission,
    RolePermission,
    SourceHealth,
    SourceHealthStatus,
    User,
    UserRole,
)
from app.schemas import (
    ApprovalPolicyCreateRequest,
    ApprovalPolicyOut,
    ApprovalPolicyUpdateRequest,
    AuditLogOut,
    FailedJobOut,
    OpsOverviewOut,
    RolePermissionBulkOut,
    RolePermissionSetRequest,
)

router = APIRouter(tags=["governance"])


# ── Helpers ──


def _require_admin(user: User = Depends(get_current_user)) -> User:
    admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if user.role in (UserRole.OWNER, UserRole.ADMIN) or user.email in admin_emails:
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


# ── Role Permissions ──


@router.get("/org/permissions", response_model=list[RolePermissionBulkOut])
def list_all_permissions(
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """List permissions for all roles (org overrides + defaults)."""
    org_perms = (
        db.query(RolePermission)
        .filter(RolePermission.org_id == user.org_id)
        .all()
    )

    # Build from org overrides
    role_map: dict[str, set[str]] = {}
    for rp in org_perms:
        role_map.setdefault(rp.role, set()).add(rp.permission)

    # Fill in defaults for roles without overrides
    for role in UserRole:
        if role.value not in role_map:
            role_map[role.value] = DEFAULT_ROLE_PERMISSIONS.get(role.value, set())

    return [
        RolePermissionBulkOut(role=role, permissions=sorted(perms))
        for role, perms in sorted(role_map.items())
    ]


@router.get("/org/permissions/{role}", response_model=RolePermissionBulkOut)
def get_role_permissions(
    role: str,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    org_perms = (
        db.query(RolePermission.permission)
        .filter(RolePermission.org_id == user.org_id, RolePermission.role == role)
        .all()
    )
    if org_perms:
        perms = sorted(row[0] for row in org_perms)
    else:
        perms = sorted(DEFAULT_ROLE_PERMISSIONS.get(role, set()))
    return RolePermissionBulkOut(role=role, permissions=perms)


@router.put("/org/permissions", response_model=RolePermissionBulkOut)
def set_role_permissions(
    body: RolePermissionSetRequest,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Replace all permissions for a role in this org."""
    # Validate permissions
    valid_perms = {p.value for p in Permission}
    for p in body.permissions:
        if p not in valid_perms:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")

    # Delete existing
    db.query(RolePermission).filter(
        RolePermission.org_id == user.org_id,
        RolePermission.role == body.role,
    ).delete()

    # Insert new
    for perm in body.permissions:
        db.add(RolePermission(org_id=user.org_id, role=body.role, permission=perm))

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="PERMISSIONS_CHANGED",
        entity_type="role",
        meta={"role": body.role, "permissions": body.permissions},
    ))

    db.commit()
    return RolePermissionBulkOut(role=body.role, permissions=sorted(body.permissions))


# ── Approval Policies ──


@router.post("/org/approval-policies", response_model=ApprovalPolicyOut, status_code=201)
def create_approval_policy(
    body: ApprovalPolicyCreateRequest,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    policy = ApprovalPolicy(
        org_id=user.org_id,
        name=body.name,
        description=body.description,
        action_type=body.action_type,
        conditions=body.conditions,
        required_role=body.required_role,
        auto_approve=body.auto_approve,
        priority=body.priority,
    )
    db.add(policy)
    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="APPROVAL_POLICY_CREATED",
        entity_type="approval_policy",
        entity_id=policy.id,
        meta={"name": body.name},
    ))
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/org/approval-policies", response_model=list[ApprovalPolicyOut])
def list_approval_policies(
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(ApprovalPolicy)
        .filter(ApprovalPolicy.org_id == user.org_id)
        .order_by(ApprovalPolicy.priority.desc(), ApprovalPolicy.created_at.desc())
        .all()
    )


@router.patch("/org/approval-policies/{policy_id}", response_model=ApprovalPolicyOut)
def update_approval_policy(
    policy_id: uuid.UUID,
    body: ApprovalPolicyUpdateRequest,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    policy = db.get(ApprovalPolicy, policy_id)
    if not policy or policy.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Policy not found")

    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(policy, field, val)

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="APPROVAL_POLICY_UPDATED",
        entity_type="approval_policy",
        entity_id=policy.id,
    ))
    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/org/approval-policies/{policy_id}", status_code=204)
def delete_approval_policy(
    policy_id: uuid.UUID,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    policy = db.get(ApprovalPolicy, policy_id)
    if not policy or policy.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(policy)
    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="APPROVAL_POLICY_DELETED",
        entity_type="approval_policy",
        entity_id=policy.id,
        meta={"name": policy.name},
    ))
    db.commit()


@router.get("/org/approval-policies/evaluate")
def evaluate_approval_policies(
    action_type: str = Query(...),
    budget: int | None = Query(None),
    risk_level: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evaluate which approval policies match a proposed action."""
    policies = (
        db.query(ApprovalPolicy)
        .filter(
            ApprovalPolicy.org_id == user.org_id,
            ApprovalPolicy.is_active == True,
        )
        .order_by(ApprovalPolicy.priority.desc())
        .all()
    )

    matching = []
    for p in policies:
        if p.action_type and p.action_type != "*" and p.action_type != action_type:
            continue
        # Check conditions
        conditions = p.conditions or {}
        if "min_budget" in conditions and (budget is None or budget < conditions["min_budget"]):
            continue
        if "risk_level" in conditions and risk_level != conditions["risk_level"]:
            continue
        matching.append({
            "policy_id": str(p.id),
            "name": p.name,
            "required_role": p.required_role,
            "auto_approve": p.auto_approve,
        })

    return {"action_type": action_type, "matching_policies": matching}


# ── Failed Jobs ──


@router.get("/admin/failed-jobs", response_model=list[FailedJobOut])
def list_failed_jobs(
    status: str | None = Query(None),
    job_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(FailedJob)
    if status:
        query = query.filter(FailedJob.status == status)
    if job_type:
        query = query.filter(FailedJob.job_type == job_type)
    return query.order_by(FailedJob.created_at.desc()).limit(limit).all()


@router.post("/admin/failed-jobs/{job_id}/retry", response_model=FailedJobOut)
def retry_failed_job(
    job_id: uuid.UUID,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    job = db.get(FailedJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in ("RESOLVED", "RETRYING"):
        raise HTTPException(status_code=400, detail=f"Job is already {job.status}")
    if job.retry_count >= job.max_retries:
        job.status = "DEAD"
        db.commit()
        db.refresh(job)
        raise HTTPException(status_code=400, detail="Max retries exceeded, job marked DEAD")

    job.status = "RETRYING"
    job.retry_count += 1
    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="FAILED_JOB_RETRIED",
        entity_type="failed_job",
        entity_id=job.id,
        meta={"job_type": job.job_type, "retry_count": job.retry_count},
    ))
    db.commit()
    db.refresh(job)

    # Dispatch retry based on job type
    _dispatch_retry(job)

    return job


@router.post("/admin/failed-jobs/{job_id}/resolve", response_model=FailedJobOut)
def resolve_failed_job(
    job_id: uuid.UUID,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    job = db.get(FailedJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "RESOLVED"
    job.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job


def _dispatch_retry(job: FailedJob):
    """Dispatch a retry based on job type. Best-effort, non-blocking."""
    try:
        if job.job_type == "ingest_business" and job.business_id:
            from app.tasks import ingest_business_task
            ingest_business_task.delay(str(job.business_id))
        elif job.job_type == "ingest_all":
            from app.tasks import ingest_all_task
            ingest_all_task.delay()
        elif job.job_type == "optimize_business" and job.business_id:
            from app.tasks import optimize_all_task
            optimize_all_task.delay()
    except Exception:
        pass  # Celery may not be available


# ── Ops Console v2 ──


@router.get("/admin/ops/overview", response_model=OpsOverviewOut)
def ops_overview(
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
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

    # Failed jobs by status
    failed_status_rows = (
        db.query(FailedJob.status, func.count(FailedJob.id))
        .group_by(FailedJob.status)
        .all()
    )
    failed_by_status = {status: count for status, count in failed_status_rows}
    total_failed_jobs = sum(failed_by_status.values())

    failed_integrations = (
        db.query(func.count(IntegrationEvent.id))
        .filter(IntegrationEvent.status == IntegrationEventStatus.FAILED)
        .scalar()
    ) or 0

    source_health_degraded = (
        db.query(func.count(SourceHealth.id))
        .filter(SourceHealth.status != SourceHealthStatus.OK)
        .scalar()
    ) or 0

    # Approval bottlenecks: businesses with most pending approvals
    bottlenecks = (
        db.query(
            Approval.business_id,
            func.count(Approval.id).label("count"),
        )
        .filter(Approval.status == ApprovalStatus.PENDING)
        .group_by(Approval.business_id)
        .order_by(func.count(Approval.id).desc())
        .limit(5)
        .all()
    )
    bottleneck_list = []
    for biz_id, count in bottlenecks:
        biz = db.get(Business, biz_id)
        bottleneck_list.append({
            "business_id": str(biz_id),
            "business_name": biz.name if biz else "Unknown",
            "pending_count": count,
        })

    # Recent audit events
    recent_audit = (
        db.query(AuditLog)
        .filter(AuditLog.org_id == user.org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )
    recent_audit_list = [
        {
            "id": str(a.id),
            "event_type": a.event_type,
            "entity_type": a.entity_type,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "user_id": str(a.user_id) if a.user_id else None,
        }
        for a in recent_audit
    ]

    return OpsOverviewOut(
        pending_approvals=pending_approvals,
        pending_exports=pending_exports,
        total_failed_jobs=total_failed_jobs,
        failed_by_status=failed_by_status,
        failed_integrations=failed_integrations,
        source_health_degraded=source_health_degraded,
        approval_bottlenecks=bottleneck_list,
        recent_audit_events=recent_audit_list,
    )


# ── Audit Export ──


@router.get("/admin/audit/export")
def export_audit_log(
    days: int = Query(30, ge=1, le=365),
    event_type: str | None = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = (
        db.query(AuditLog)
        .filter(AuditLog.org_id == user.org_id, AuditLog.created_at >= cutoff)
    )
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)

    rows = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    data = [
        {
            "id": str(r.id),
            "user_id": str(r.user_id) if r.user_id else None,
            "event_type": r.event_type,
            "entity_type": r.entity_type,
            "entity_id": str(r.entity_id) if r.entity_id else None,
            "meta": r.meta,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
    return JSONResponse(content={"count": len(data), "records": data})


@router.get("/admin/approvals/export")
def export_approvals(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(1000, ge=1, le=10000),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    # Only export approvals for businesses in the user's org
    org_biz_ids = [
        row[0] for row in db.query(Business.id).filter(Business.org_id == user.org_id).all()
    ]
    rows = (
        db.query(Approval)
        .filter(Approval.business_id.in_(org_biz_ids), Approval.created_at >= cutoff)
        .order_by(Approval.created_at.desc())
        .limit(limit)
        .all()
    )
    data = [
        {
            "id": str(r.id),
            "business_id": str(r.business_id),
            "action_id": str(r.action_id),
            "status": r.status.value,
            "risk": r.risk.value,
            "cost_impact": r.cost_impact,
            "confidence": r.confidence,
            "requires_human": r.requires_human,
            "created_at": r.created_at.isoformat(),
            "decided_at": r.decided_at.isoformat() if r.decided_at else None,
        }
        for r in rows
    ]
    return JSONResponse(content={"count": len(data), "records": data})


@router.get("/admin/integrations/export")
def export_integration_events(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(1000, ge=1, le=10000),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    org_biz_ids = [
        row[0] for row in db.query(Business.id).filter(Business.org_id == user.org_id).all()
    ]
    rows = (
        db.query(IntegrationEvent)
        .filter(IntegrationEvent.business_id.in_(org_biz_ids), IntegrationEvent.created_at >= cutoff)
        .order_by(IntegrationEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    data = [
        {
            "id": str(r.id),
            "business_id": str(r.business_id),
            "integration_id": str(r.integration_id),
            "event_type": r.event_type,
            "status": r.status.value,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat(),
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        }
        for r in rows
    ]
    return JSONResponse(content={"count": len(data), "records": data})
