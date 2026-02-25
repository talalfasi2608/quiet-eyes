"""
Cockpit Router — daily briefing + ROI summary.
"""

import logging
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cockpit", tags=["Cockpit"])


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


def _sb(request: Request):
    """Get DB client — prefer service-role to bypass RLS, fall back to JWT-scoped."""
    svc = _get_service_client()
    if svc:
        return svc
    try:
        from routers._auth_helper import get_supabase_client
        return get_supabase_client(request)
    except Exception:
        return None


@router.get("/briefing/{business_id}")
async def daily_briefing(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _sb(request)
    biz_name = ""
    if supabase:
        try:
            r = supabase.table("businesses").select("business_name").eq("id", business_id).execute()
            if r.data:
                biz_name = r.data[0].get("business_name", "")
        except Exception:
            pass

    try:
        from zoneinfo import ZoneInfo
        hour = datetime.now(ZoneInfo("Asia/Jerusalem")).hour
    except ImportError:
        hour = datetime.now(timezone.utc).hour + 2  # UTC+2 fallback
    greeting = "בוקר טוב" if hour < 12 else ("צהריים טובים" if hour < 17 else "ערב טוב")

    return {
        "business_name": biz_name,
        "greeting": greeting,
        "mood": "positive",
        "summary": f"הכל רגוע היום. אין שינויים משמעותיים בשוק.",
        "metrics": {
            "new_leads": 0,
            "competitor_changes": 0,
            "market_alerts": 0,
        },
        "action_items": [],
        "new_competitors": [],
        "recent_events": [],
    }


@router.get("/roi-summary/{business_id}")
async def roi_summary(business_id: str, auth_user_id: str = Depends(require_auth)):
    return {
        "total_actions": 0,
        "total_estimated_value": 0,
        "total_confirmed_value": 0,
        "roi_ratio": 0,
        "by_type": {},
    }
