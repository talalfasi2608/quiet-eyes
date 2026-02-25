"""
Intelligence Router — events feed, unread counts, scanning, history.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["Intelligence"])


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


def _verify_business_owner(supabase, business_id: str, auth_user_id: str):
    """Verify the authenticated user owns this business. Raises 403 if not."""
    try:
        result = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
        if result.data and result.data[0].get("user_id") == auth_user_id:
            return
    except Exception:
        pass
    raise HTTPException(status_code=403, detail="Access denied")


def _get_user_business(sb, user_id: str):
    """Look up the first business belonging to a user. Returns dict or None."""
    try:
        result = sb.table("businesses").select("id").eq("user_id", user_id).limit(1).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.error(f"_get_user_business error: {e}")
    return None


def _resolve_business_id(sb, path_id: str, auth_user_id: str) -> str | None:
    """
    Resolve a path parameter that could be either a user_id or business_id.
    Verifies the authenticated user owns the business.
    Returns the business_id or None.
    Falls back to service-role client when JWT-scoped client is blocked by RLS.
    """
    # Case 1: path_id IS the auth user_id → look up their business
    if path_id == auth_user_id:
        biz = _get_user_business(sb, auth_user_id)
        if biz:
            return biz["id"]
        # Fallback: service-role client
        svc = _get_service_client()
        if svc:
            biz = _get_user_business(svc, auth_user_id)
            if biz:
                return biz["id"]
        return None

    # Case 2: path_id might be a business_id → verify ownership
    try:
        result = (
            sb.table("businesses")
            .select("id, user_id")
            .eq("id", path_id)
            .limit(1)
            .execute()
        )
        if result.data and result.data[0].get("user_id") == auth_user_id:
            return result.data[0]["id"]
    except Exception as e:
        logger.error(f"_resolve_business_id error: {e}")
    # Fallback: service-role client
    svc = _get_service_client()
    if svc:
        try:
            result = svc.table("businesses").select("id, user_id").eq("id", path_id).limit(1).execute()
            if result.data and result.data[0].get("user_id") == auth_user_id:
                return result.data[0]["id"]
        except Exception:
            pass

    return None


def _map_severity_to_priority(severity: str) -> str:
    """Map event severity to frontend priority."""
    if severity in ("high", "critical"):
        return "high"
    if severity == "medium":
        return "medium"
    return "low"


def _categorize_event_type(event_type: str) -> str:
    """Map event_type to frontend category bucket."""
    mapping = {
        "lead_found": "opportunities",
        "price_alert": "price_alerts",
        "competitor_change": "ad_insights",
        "facebook_intent": "opportunities",
        "new_competitor_alert": "ad_insights",
        "real_estate_alert": "ad_insights",
        "industry_news": "opportunities",
        "trend": "opportunities",
    }
    return mapping.get(event_type, "opportunities")


def _event_to_intel_item(ev: dict) -> dict:
    """Convert a raw intelligence_events row into an IntelItem for the frontend."""
    return {
        "id": ev.get("id"),
        "title": ev.get("title", ""),
        "description": ev.get("description"),
        "source": ev.get("source"),
        "priority": _map_severity_to_priority(ev.get("severity", "low")),
        "competitor_name": None,
        "action_label": None,
        "timestamp": ev.get("created_at"),
        "metadata": ev.get("metadata"),
        "is_fresh": not ev.get("is_read", False),
    }


@router.get("/{business_id}/events")
async def get_events(business_id: str, request: Request, auth_user_id: str = Depends(require_auth), limit: int = Query(default=8)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"events": []}

        _verify_business_owner(sb, business_id, auth_user_id)

        result = (
            sb.table("intelligence_events")
            .select("*")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return {"events": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_events error: {e}")
        return {"events": []}


@router.get("/{business_id}/events/unread-count")
async def unread_count(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"unread_count": 0}

        _verify_business_owner(sb, business_id, auth_user_id)

        result = (
            sb.table("intelligence_events")
            .select("id", count="exact")
            .eq("business_id", business_id)
            .eq("is_read", False)
            .execute()
        )

        count = len(result.data) if result.data else 0
        return {"unread_count": count}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"unread_count error: {e}")
        return {"unread_count": 0}


@router.post("/{business_id}/events/mark-all-read")
async def mark_all_read(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"success": False}

        _verify_business_owner(sb, business_id, auth_user_id)

        (
            sb.table("intelligence_events")
            .update({"is_read": True})
            .eq("business_id", business_id)
            .eq("is_read", False)
            .execute()
        )

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"mark_all_read error: {e}")
        return {"success": True}


@router.get("/feed/{user_id}")
async def intelligence_feed(user_id: str, request: Request, auth_user_id: str = Depends(require_auth), limit: int = Query(default=30)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return _empty_feed()

        business_id = _resolve_business_id(sb, user_id, auth_user_id)
        if not business_id:
            raise HTTPException(status_code=403, detail="Access denied")

        result = (
            sb.table("intelligence_events")
            .select("*")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        events = result.data or []

        # Categorize into buckets
        opportunities = []
        price_alerts = []
        ad_insights = []

        for ev in events:
            item = _event_to_intel_item(ev)
            category = _categorize_event_type(ev.get("event_type", ""))

            if category == "price_alerts":
                price_alerts.append(item)
            elif category == "ad_insights":
                ad_insights.append(item)
            else:
                opportunities.append(item)

        return {
            "opportunities": opportunities,
            "price_alerts": price_alerts,
            "ad_insights": ad_insights,
            "total_count": len(events),
            "cached": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"intelligence_feed error: {e}")
        return _empty_feed()


def _empty_feed() -> dict:
    return {
        "opportunities": [],
        "price_alerts": [],
        "ad_insights": [],
        "total_count": 0,
        "cached": False,
    }


@router.post("/scan/{user_id}")
async def trigger_scan(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    if sb:
        business_id = _resolve_business_id(sb, user_id, auth_user_id)
        if not business_id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Create a "scan completed" event so the frontend sees activity
        try:
            sb.table("intelligence_events").insert({
                "business_id": business_id,
                "event_type": "scan_completed",
                "title": "סריקת מודיעין הושלמה",
                "description": "הסריקה הסתיימה. תוצאות חדשות יופיעו כאן.",
                "severity": "low",
                "source": "system",
                "is_read": False,
            }).execute()
        except Exception as e:
            logger.debug(f"trigger_scan event insert: {e}")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"success": True, "message": "Scan triggered"}


@router.get("/history/business/{user_id}")
async def intelligence_history(user_id: str, request: Request, auth_user_id: str = Depends(require_auth), days: int = Query(default=30)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"competitors": [], "timeline": []}

        business_id = _resolve_business_id(sb, user_id, auth_user_id)
        if not business_id:
            raise HTTPException(status_code=403, detail="Access denied")
        from_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        # Fetch competitors
        comp_result = (
            sb.table("competitors")
            .select("*")
            .eq("business_id", business_id)
            .execute()
        )

        # Fetch timeline events
        events_result = (
            sb.table("intelligence_events")
            .select("*")
            .eq("business_id", business_id)
            .gte("created_at", from_date)
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "competitors": comp_result.data or [],
            "timeline": events_result.data or [],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"intelligence_history error: {e}")
        return {"competitors": [], "timeline": []}


@router.post("/track/{user_id}")
async def track_intelligence(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"success": True}
