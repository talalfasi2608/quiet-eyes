"""
Intel Scanner API — endpoints for triggering scans and retrieving trend data.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intel-scanner", tags=["Intel Scanner"])


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
        result = (
            supabase.table("businesses")
            .select("user_id")
            .eq("id", business_id)
            .execute()
        )
        if result.data and result.data[0].get("user_id") == auth_user_id:
            return
    except Exception:
        pass
    raise HTTPException(status_code=403, detail="Access denied")


# ─────────────────────────────────────────────────────────────────────────────
# POST /intel-scanner/scan/{business_id} — Trigger full scan
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/scan/{business_id}")
async def trigger_full_scan(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """
    Trigger a full multi-source intelligence scan for a business.
    Runs all 5 sources and saves results to intelligence_events + trend_data.
    """
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=500, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        from services.intel_scanner import get_intel_scanner
        scanner = get_intel_scanner()
        report = scanner.run_full_scan(business_id, sb)

        return {
            "success": True,
            "business_id": report.business_id,
            "total_events": report.total_events,
            "total_trends": report.total_trends,
            "events_by_source": report.events_by_source,
            "errors": report.errors,
        }

    except Exception as e:
        logger.error(f"[IntelScannerAPI] Scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# GET /intel-scanner/trends/{business_id} — Get trend data
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/trends/{business_id}")
async def get_trends(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
    limit: int = Query(default=20, le=100),
):
    """
    Get trend data for a business from the trend_data table.
    Returns the most recent trend data points.
    """
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        return {"trends": []}

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        result = (
            sb.table("trend_data")
            .select("*")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"trends": result.data or []}

    except Exception as e:
        logger.error(f"[IntelScannerAPI] Trends fetch error: {e}")
        return {"trends": []}


# ─────────────────────────────────────────────────────────────────────────────
# GET /intel-scanner/status/{business_id} — Last scan summary
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/status/{business_id}")
async def get_scan_status(
    business_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """
    Get the last scan summary for a business.
    Returns counts of recent events by source and the last scan timestamp.
    """
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        return {"last_scan": None, "event_counts": {}}

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        # Get the most recent intel scanner events
        result = (
            sb.table("intelligence_events")
            .select("source, created_at")
            .eq("business_id", business_id)
            .in_(
                "source",
                [
                    "facebook_groups",
                    "business_registry",
                    "yad2_commercial",
                    "google_trends",
                    "israeli_news",
                ],
            )
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        events = result.data or []
        if not events:
            return {"last_scan": None, "event_counts": {}}

        # Count events by source
        counts: dict[str, int] = {}
        for ev in events:
            src = ev.get("source", "unknown")
            counts[src] = counts.get(src, 0) + 1

        last_scan = events[0].get("created_at") if events else None

        # Get trend data count
        try:
            trend_result = (
                sb.table("trend_data")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .execute()
            )
            trend_count = len(trend_result.data) if trend_result.data else 0
        except Exception:
            trend_count = 0

        return {
            "last_scan": last_scan,
            "event_counts": counts,
            "trend_data_points": trend_count,
        }

    except Exception as e:
        logger.error(f"[IntelScannerAPI] Status error: {e}")
        return {"last_scan": None, "event_counts": {}}
