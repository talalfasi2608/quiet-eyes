"""
Automations Router — CRUD for automation settings, log, campaigns, and stats.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from routers._auth_helper import require_auth, get_supabase_client
from services.permission_engine import require_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/automations", tags=["Automations"])


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _resolve_business(sb, path_id: str, auth_user_id: str) -> str:
    """Resolve business_id from path param, verifying ownership."""
    from routers._auth_helper import resolve_business_id
    biz_id = resolve_business_id(sb, path_id, auth_user_id)
    if not biz_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return biz_id


# ─── GET automation settings ──────────────────────────────────────────────

@router.get("/settings/{business_id}")
async def get_settings(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
    _perm=Depends(require_feature("auto_review_response")),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    svc = _get_service_client() or sb
    from services.automation_helpers import get_automation_settings
    settings = get_automation_settings(biz_id, svc)

    return {"success": True, "settings": settings}


# ─── PATCH automation settings ────────────────────────────────────────────

@router.patch("/settings/{business_id}")
async def update_settings(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    body = await request.json()
    allowed_keys = {
        "review_responder", "lead_alerts", "competitor_alerts",
        "morning_briefing", "campaign_generator",
    }
    updates = {k: v for k, v in body.items() if k in allowed_keys and isinstance(v, bool)}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    svc = _get_service_client() or sb
    try:
        # Ensure row exists
        from services.automation_helpers import get_automation_settings
        get_automation_settings(biz_id, svc)

        result = (
            svc.table("automation_settings")
            .update(updates)
            .eq("business_id", biz_id)
            .execute()
        )
        return {"success": True, "settings": result.data[0] if result.data else updates}
    except Exception as e:
        logger.error(f"update_settings error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


# ─── GET automation log ───────────────────────────────────────────────────

@router.get("/log/{business_id}")
async def get_log(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
    limit: int = Query(default=50, ge=1, le=200),
    automation_type: str = Query(default=None),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    svc = _get_service_client() or sb
    try:
        query = (
            svc.table("automation_log")
            .select("*")
            .eq("business_id", biz_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if automation_type:
            query = query.eq("automation_type", automation_type)

        result = query.execute()
        return {"success": True, "log": result.data or []}
    except Exception as e:
        logger.error(f"get_log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch log")


# ─── GET campaigns ────────────────────────────────────────────────────────

@router.get("/campaigns/{business_id}")
async def get_campaigns(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
    status: str = Query(default=None),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    svc = _get_service_client() or sb
    try:
        query = (
            svc.table("campaigns")
            .select("*")
            .eq("business_id", biz_id)
            .order("created_at", desc=True)
            .limit(50)
        )
        if status:
            query = query.eq("status", status)

        result = query.execute()
        return {"success": True, "campaigns": result.data or []}
    except Exception as e:
        logger.error(f"get_campaigns error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch campaigns")


# ─── GET single campaign ─────────────────────────────────────────────────

@router.get("/campaigns/{business_id}/{campaign_id}")
async def get_campaign_detail(
    business_id: str,
    campaign_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    svc = _get_service_client() or sb
    try:
        result = (
            svc.table("campaigns")
            .select("*")
            .eq("id", campaign_id)
            .eq("business_id", biz_id)
            .single()
            .execute()
        )
        return {"success": True, "campaign": result.data}
    except Exception as e:
        logger.error(f"get_campaign_detail error: {e}")
        raise HTTPException(status_code=404, detail="Campaign not found")


# ─── PATCH campaign status ────────────────────────────────────────────────

@router.patch("/campaigns/{business_id}/{campaign_id}")
async def update_campaign(
    business_id: str,
    campaign_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    body = await request.json()
    new_status = body.get("status")
    if new_status not in ("draft", "active", "completed", "archived"):
        raise HTTPException(status_code=400, detail="Invalid status")

    svc = _get_service_client() or sb
    try:
        result = (
            svc.table("campaigns")
            .update({"status": new_status})
            .eq("id", campaign_id)
            .eq("business_id", biz_id)
            .execute()
        )
        return {"success": True, "campaign": result.data[0] if result.data else None}
    except Exception as e:
        logger.error(f"update_campaign error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update campaign")


# ─── GET aggregate stats ──────────────────────────────────────────────────

@router.get("/stats/{business_id}")
async def get_stats(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    sb = get_supabase_client(request) or _get_service_client()
    biz_id = _resolve_business(sb, business_id, auth_user_id)

    svc = _get_service_client() or sb
    since_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    since_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    stats = {
        "total_actions_7d": 0,
        "total_actions_30d": 0,
        "by_type_7d": {},
        "campaigns_total": 0,
        "campaigns_active": 0,
    }

    try:
        # 7-day log count
        log_7d = (
            svc.table("automation_log")
            .select("automation_type")
            .eq("business_id", biz_id)
            .gte("created_at", since_7d)
            .execute()
        )
        rows_7d = log_7d.data or []
        stats["total_actions_7d"] = len(rows_7d)

        # Count by type
        type_counts = {}
        for row in rows_7d:
            t = row.get("automation_type", "other")
            type_counts[t] = type_counts.get(t, 0) + 1
        stats["by_type_7d"] = type_counts

        # 30-day log count
        log_30d = (
            svc.table("automation_log")
            .select("id")
            .eq("business_id", biz_id)
            .gte("created_at", since_30d)
            .execute()
        )
        stats["total_actions_30d"] = len(log_30d.data or [])

        # Campaign counts
        campaigns = (
            svc.table("campaigns")
            .select("status")
            .eq("business_id", biz_id)
            .execute()
        )
        camp_rows = campaigns.data or []
        stats["campaigns_total"] = len(camp_rows)
        stats["campaigns_active"] = sum(1 for c in camp_rows if c.get("status") == "active")

    except Exception as e:
        logger.error(f"get_stats error: {e}")

    return {"success": True, "stats": stats}
