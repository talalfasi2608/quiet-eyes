"""
Admin Router — audit log retrieval and super-admin dashboard utilities.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends, Body
from typing import Optional
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

def _is_super_admin(user_id: str) -> bool:
    """Check if user is the super admin."""
    super_uid = os.getenv("SUPER_ADMIN_UID", "")
    if not super_uid:
        return False
    return user_id == super_uid


def _get_service_client():
    """Get service-role client to bypass RLS (admin needs full access)."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _get_supabase():
    """Lazy import — prefer service-role to bypass RLS for admin operations."""
    svc = _get_service_client()
    if svc:
        return svc
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _require_super_admin(user_id: str):
    """Raise 403 if the caller is not the super-admin."""
    if not _is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Super-admin access required")


# =============================================================================
# GET /admin/audit-logs
# =============================================================================

@router.get("/audit-logs")
async def get_audit_logs(
    auth_user_id: str = Depends(require_auth),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: Optional[str] = Query(default=None),
    method: Optional[str] = Query(default=None),
    path_contains: Optional[str] = Query(default=None),
):
    """Paginated audit log retrieval with optional filters."""
    _require_super_admin(auth_user_id)
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        q = supabase.table("audit_logs").select("*").order("created_at", desc=True)

        if user_id:
            q = q.eq("user_id", user_id)
        if method:
            q = q.eq("method", method.upper())
        if path_contains:
            q = q.ilike("path", f"%{path_contains}%")

        result = q.range(offset, offset + limit - 1).execute()
        return {"success": True, "logs": result.data or [], "count": len(result.data or [])}
    except Exception as e:
        logger.error(f"Audit log fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# GET /admin/super-dashboard
# =============================================================================

@router.get("/super-dashboard")
async def super_dashboard(
    auth_user_id: str = Depends(require_auth),
):
    """Global stats for the super-admin dashboard."""
    _require_super_admin(auth_user_id)
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        users = supabase.table("profiles").select("id", count="exact").execute()
        workspaces_res = supabase.table("workspaces").select("id, name, created_at").execute()
        businesses = supabase.table("businesses").select("id", count="exact").execute()
        leads = supabase.table("leads_discovered").select("id", count="exact").execute()
        competitors = supabase.table("competitors").select("id", count="exact").execute()

        # Tier breakdown
        subs = supabase.table("subscriptions").select("tier").execute()
        tier_breakdown: dict[str, int] = {}
        for s in subs.data or []:
            t = s.get("tier", "free")
            tier_breakdown[t] = tier_breakdown.get(t, 0) + 1

        # Credits spent
        credits_res = supabase.table("subscriptions").select("credits_used").execute()
        total_credits = sum(
            (r.get("credits_used") or 0) for r in (credits_res.data or [])
        )

        # API calls in last 24h
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        api_calls = (
            supabase.table("audit_logs")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )

        return {
            "global_stats": {
                "total_users": users.count or 0,
                "total_workspaces": len(workspaces_res.data or []),
                "total_businesses": businesses.count or 0,
                "total_leads": leads.count or 0,
                "total_competitors": competitors.count or 0,
                "total_credits_spent": total_credits,
                "api_calls_24h": api_calls.count or 0,
                "tier_breakdown": tier_breakdown,
            },
            "workspaces": workspaces_res.data or [],
        }
    except Exception as e:
        logger.error(f"Super dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# GET /admin/super-dashboard/workspace/{workspace_id}
# =============================================================================

@router.get("/super-dashboard/workspace/{workspace_id}")
async def workspace_detail(
    workspace_id: int,
    auth_user_id: str = Depends(require_auth),
):
    """Detailed view of a single workspace."""
    _require_super_admin(auth_user_id)
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        ws = (
            supabase.table("workspaces")
            .select("*")
            .eq("id", workspace_id)
            .single()
            .execute()
        )
        members = (
            supabase.table("workspace_members")
            .select("*")
            .eq("workspace_id", workspace_id)
            .execute()
        )
        sub = (
            supabase.table("subscriptions")
            .select("*")
            .eq("workspace_id", workspace_id)
            .maybe_single()
            .execute()
        )
        businesses = (
            supabase.table("businesses")
            .select("id, business_name, industry")
            .eq("workspace_id", workspace_id)
            .execute()
        )

        return {
            "workspace": ws.data,
            "members": members.data or [],
            "subscription": sub.data,
            "businesses": businesses.data or [],
        }
    except Exception as e:
        logger.error(f"Workspace detail error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# GET /admin/super-dashboard/workspaces-table  (SPRINT 12)
# =============================================================================

@router.get("/super-dashboard/workspaces-table")
async def workspaces_table(
    auth_user_id: str = Depends(require_auth),
    sort_by: str = Query(default="name", description="Column to sort by"),
    sort_dir: str = Query(default="asc", description="Sort direction: asc or desc"),
):
    """
    Returns enriched workspace rows for the sortable super-admin table.

    Columns: name, owner_email, tier, api_usage_24h, last_active,
             total_leads, total_competitors, businesses_count
    """
    _require_super_admin(auth_user_id)
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Fetch all workspaces
        ws_res = supabase.table("workspaces").select("*").execute()
        workspaces = ws_res.data or []

        cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        rows = []
        for ws in workspaces:
            ws_id = ws["id"]

            # Owner email — find the 'owner' role member
            members = (
                supabase.table("workspace_members")
                .select("invited_email, user_id, role")
                .eq("workspace_id", ws_id)
                .execute()
            ).data or []
            owner_email = ""
            for m in members:
                if m.get("role") == "owner":
                    owner_email = m.get("invited_email") or m.get("user_id", "")[:12]
                    break

            # Subscription tier
            sub = (
                supabase.table("subscriptions")
                .select("tier")
                .eq("workspace_id", ws_id)
                .maybe_single()
                .execute()
            )
            tier = (sub.data or {}).get("tier", "free")

            # Businesses count
            biz = (
                supabase.table("businesses")
                .select("id", count="exact")
                .eq("workspace_id", ws_id)
                .execute()
            )
            businesses_count = biz.count or 0

            # Total leads across workspace businesses
            biz_ids_res = (
                supabase.table("businesses")
                .select("id")
                .eq("workspace_id", ws_id)
                .execute()
            )
            biz_ids = [b["id"] for b in (biz_ids_res.data or [])]

            total_leads = 0
            total_competitors = 0
            if biz_ids:
                leads_res = (
                    supabase.table("leads_discovered")
                    .select("id", count="exact")
                    .in_("business_id", biz_ids)
                    .execute()
                )
                total_leads = leads_res.count or 0

                comp_res = (
                    supabase.table("competitors")
                    .select("id", count="exact")
                    .in_("business_id", biz_ids)
                    .execute()
                )
                total_competitors = comp_res.count or 0

            # API usage in last 24h (audit logs for this workspace's users)
            member_user_ids = [
                m.get("user_id") for m in members if m.get("user_id")
            ]
            api_usage_24h = 0
            if member_user_ids:
                api_res = (
                    supabase.table("audit_logs")
                    .select("id", count="exact")
                    .in_("user_id", member_user_ids)
                    .gte("created_at", cutoff_24h)
                    .execute()
                )
                api_usage_24h = api_res.count or 0

            # Last active — most recent audit log
            last_active = ws.get("created_at", "")
            if member_user_ids:
                try:
                    latest = (
                        supabase.table("audit_logs")
                        .select("created_at")
                        .in_("user_id", member_user_ids)
                        .order("created_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    if latest.data:
                        last_active = latest.data[0]["created_at"]
                except Exception:
                    pass

            rows.append({
                "id": ws_id,
                "name": ws.get("name", f"Workspace #{ws_id}"),
                "owner_email": owner_email,
                "tier": tier,
                "api_usage_24h": api_usage_24h,
                "last_active": last_active,
                "total_leads": total_leads,
                "total_competitors": total_competitors,
                "businesses_count": businesses_count,
            })

        # Server-side sorting
        reverse = sort_dir.lower() == "desc"
        valid_sort_keys = {
            "name", "owner_email", "tier", "api_usage_24h",
            "last_active", "total_leads", "total_competitors", "businesses_count",
        }
        if sort_by not in valid_sort_keys:
            sort_by = "name"

        rows.sort(key=lambda r: r.get(sort_by, ""), reverse=reverse)

        return {"success": True, "rows": rows, "total": len(rows)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Workspaces table error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# POST /admin/impersonate/{workspace_id}  (PRE-LAUNCH)
# =============================================================================

@router.post("/impersonate/{workspace_id}")
async def impersonate_workspace(
    workspace_id: int,
    auth_user_id: str = Depends(require_auth),
):
    """
    Super-admin impersonation — returns the workspace context
    (workspace_id, role, workspace_name, businesses, subscription)
    as if the admin were a member of that workspace.

    This does NOT create a session or modify any data.
    The frontend uses the returned data to override WorkspaceContext.
    """
    _require_super_admin(auth_user_id)
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Fetch workspace
        ws = (
            supabase.table("workspaces")
            .select("id, name")
            .eq("id", workspace_id)
            .single()
            .execute()
        )
        if not ws.data:
            raise HTTPException(status_code=404, detail="Workspace not found")

        # Fetch subscription
        sub = (
            supabase.table("subscriptions")
            .select("tier, credits_remaining, credits_monthly_limit")
            .eq("workspace_id", workspace_id)
            .maybe_single()
            .execute()
        )

        # Fetch businesses
        businesses = (
            supabase.table("businesses")
            .select("id, business_name, industry")
            .eq("workspace_id", workspace_id)
            .execute()
        )

        # Fetch members
        members = (
            supabase.table("workspace_members")
            .select("invited_email, role, user_id")
            .eq("workspace_id", workspace_id)
            .execute()
        )

        # Log the impersonation event
        try:
            from services.system_logger import get_system_logger
            sys_logger = get_system_logger()
            sys_logger.log(
                "info",
                "admin_impersonate",
                f"Super-admin impersonating workspace {workspace_id}",
                details={
                    "admin_user_id": auth_user_id,
                    "workspace_id": workspace_id,
                    "workspace_name": ws.data.get("name", ""),
                },
            )
        except Exception:
            pass

        return {
            "success": True,
            "impersonation": {
                "workspace_id": str(workspace_id),
                "workspace_name": ws.data.get("name", f"Workspace #{workspace_id}"),
                "role": "owner",  # Super-admin sees everything as owner
                "tier": (sub.data or {}).get("tier", "free"),
                "credits_remaining": (sub.data or {}).get("credits_remaining", 0),
                "credits_monthly_limit": (sub.data or {}).get("credits_monthly_limit", 10),
                "businesses": businesses.data or [],
                "members": members.data or [],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Impersonation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# GET /admin/api-health
# =============================================================================

@router.get("/api-health")
async def api_health(auth_user_id: str = Depends(require_auth)):
    """
    Comprehensive API health check — tests all external service integrations.
    Only accessible by SUPER_ADMIN_UID.
    """
    _require_super_admin(auth_user_id)

    from utils.api_health_check import run_all_checks
    results = await run_all_checks()

    return {
        "success": True,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "apis": results,
        "summary": {
            "total": len(results),
            "ok": sum(1 for r in results if r["status"] == "ok"),
            "error": sum(1 for r in results if r["status"] == "error"),
            "not_configured": sum(1 for r in results if r["status"] == "not_configured"),
        }
    }


# =============================================================================
# GET /admin/data-freshness
# =============================================================================

@router.get("/data-freshness")
async def data_freshness(auth_user_id: str = Depends(require_auth)):
    """
    Returns last-updated timestamps for all key data types across all businesses.
    Helps diagnose data staleness issues.
    """
    _require_super_admin(auth_user_id)
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    now = datetime.now(timezone.utc)
    freshness: dict = {}

    tables = [
        ("leads_discovered", "created_at"),
        ("competitors", "created_at"),
        ("intelligence_events", "created_at"),
        ("scheduled_jobs", "last_run_at"),
    ]

    for table_name, date_col in tables:
        try:
            result = (
                supabase.table(table_name)
                .select(date_col)
                .order(date_col, desc=True)
                .limit(1)
                .execute()
            )
            if result.data and result.data[0].get(date_col):
                last = result.data[0][date_col]
                try:
                    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                    age_hours = (now - last_dt).total_seconds() / 3600
                except Exception:
                    age_hours = -1
                freshness[table_name] = {
                    "last_updated": last,
                    "age_hours": round(age_hours, 1),
                    "stale": age_hours > 24,
                }
            else:
                freshness[table_name] = {
                    "last_updated": None,
                    "age_hours": -1,
                    "stale": True,
                }
        except Exception as e:
            freshness[table_name] = {"error": str(e)}

    # Per-business lead freshness
    try:
        biz_res = supabase.table("businesses").select("id, business_name").execute()
        business_freshness = []
        for biz in (biz_res.data or []):
            bid = biz["id"]
            lead_res = (
                supabase.table("leads_discovered")
                .select("created_at")
                .eq("business_id", bid)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            last_lead = None
            lead_age = -1
            if lead_res.data and lead_res.data[0].get("created_at"):
                last_lead = lead_res.data[0]["created_at"]
                try:
                    last_dt = datetime.fromisoformat(last_lead.replace("Z", "+00:00"))
                    lead_age = round((now - last_dt).total_seconds() / 3600, 1)
                except Exception:
                    pass

            job_res = (
                supabase.table("scheduled_jobs")
                .select("job_type, last_run_at, next_run_at, status")
                .eq("business_id", bid)
                .eq("job_type", "lead_snipe")
                .maybe_single()
                .execute()
            )
            job_info = job_res.data if job_res else None

            business_freshness.append({
                "business_id": bid,
                "business_name": biz.get("business_name", ""),
                "last_lead_at": last_lead,
                "lead_age_hours": lead_age,
                "lead_snipe_job": job_info,
            })
        freshness["per_business"] = business_freshness
    except Exception as e:
        freshness["per_business_error"] = str(e)

    return {"success": True, "checked_at": now.isoformat(), "freshness": freshness}
