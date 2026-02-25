"""
Cockpit Router — daily briefing + ROI summary + predictions.
"""

import logging
import os
from datetime import datetime, timezone, timedelta
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

    # Time-of-day greeting
    try:
        from zoneinfo import ZoneInfo
        hour = datetime.now(ZoneInfo("Asia/Jerusalem")).hour
    except ImportError:
        hour = datetime.now(timezone.utc).hour + 2  # UTC+2 fallback
    greeting = "בוקר טוב" if hour < 12 else ("צהריים טובים" if hour < 17 else "ערב טוב")

    # Fetch real metrics from DB
    new_leads = 0
    new_competitors = 0
    total_events = 0
    total_competitors = 0
    total_leads = 0
    high_severity_events = 0
    recent_events = []
    action_items = []
    mood = "positive"
    summary = "הכל רגוע היום. אין שינויים משמעותיים בשוק."

    if supabase:
        twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        try:
            # Events in last 24h
            ev_result = (
                supabase.table("intelligence_events")
                .select("id, event_type, title, severity, created_at")
                .eq("business_id", business_id)
                .gte("created_at", twenty_four_hours_ago)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            events_24h = ev_result.data or []
            total_events = len(events_24h)
            high_severity_events = sum(1 for e in events_24h if e.get("severity") == "high")

            recent_events = [
                {"type": e.get("event_type", ""), "title": e.get("title", ""), "severity": e.get("severity", "medium")}
                for e in events_24h[:5]
            ]
        except Exception as e:
            logger.debug(f"Briefing events query: {e}")

        try:
            # Leads in last 24h
            leads_result = (
                supabase.table("leads_discovered")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .gte("created_at", twenty_four_hours_ago)
                .execute()
            )
            new_leads = leads_result.count if hasattr(leads_result, "count") and leads_result.count else len(leads_result.data or [])
        except Exception as e:
            logger.debug(f"Briefing leads query: {e}")

        try:
            # Total leads (last 7 days)
            total_leads_result = (
                supabase.table("leads_discovered")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .gte("created_at", seven_days_ago)
                .execute()
            )
            total_leads = total_leads_result.count if hasattr(total_leads_result, "count") and total_leads_result.count else len(total_leads_result.data or [])
        except Exception:
            pass

        try:
            # Competitors count
            comp_result = (
                supabase.table("competitors")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .execute()
            )
            total_competitors = comp_result.count if hasattr(comp_result, "count") and comp_result.count else len(comp_result.data or [])
        except Exception:
            pass

        try:
            # New competitors (last 24h)
            new_comp_result = (
                supabase.table("competitors")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .gte("created_at", twenty_four_hours_ago)
                .execute()
            )
            new_competitors = new_comp_result.count if hasattr(new_comp_result, "count") and new_comp_result.count else len(new_comp_result.data or [])
        except Exception:
            pass

        # Determine mood
        if high_severity_events > 0:
            mood = "alert"
        elif total_events > 3 or new_leads > 2:
            mood = "neutral"

        # Build summary from memory snapshot if available
        try:
            mem_res = (
                supabase.table("business_memory")
                .select("weekly_summary, main_opportunity, main_threat, trend_direction")
                .eq("business_id", business_id)
                .order("week_start", desc=True)
                .limit(1)
                .execute()
            )
            if mem_res.data and mem_res.data[0].get("weekly_summary"):
                mem = mem_res.data[0]
                summary = mem["weekly_summary"]
                if mem.get("main_opportunity"):
                    action_items.append({
                        "text": f"הזדמנות: {mem['main_opportunity']}",
                        "priority": "high",
                        "type": "opportunity",
                    })
                if mem.get("main_threat"):
                    action_items.append({
                        "text": f"איום: {mem['main_threat']}",
                        "priority": "medium",
                        "type": "threat",
                    })
            elif total_events > 0 or new_leads > 0:
                parts = []
                if new_leads > 0:
                    parts.append(f"{new_leads} לידים חדשים ב-24 שעות האחרונות")
                if total_events > 0:
                    parts.append(f"{total_events} אירועי מודיעין")
                if high_severity_events > 0:
                    parts.append(f"{high_severity_events} אירועים קריטיים דורשים תשומת לב")
                summary = ". ".join(parts) + "."
        except Exception:
            pass

    return {
        "business_name": biz_name,
        "greeting": greeting,
        "mood": mood,
        "summary": summary,
        "metrics": {
            "new_leads": new_leads,
            "new_competitors": new_competitors,
            "total_events": total_events,
            "total_competitors": total_competitors,
            "total_leads": total_leads,
            "high_severity_events": high_severity_events,
        },
        "action_items": action_items,
        "new_competitors": [],
        "recent_events": recent_events,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/prediction/{business_id}")
async def get_prediction(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Get the latest weekly prediction for a business."""
    supabase = _sb(request)
    if not supabase:
        return {"available": False}

    try:
        from services.prediction_engine import get_prediction_engine
        prediction = get_prediction_engine().get_latest_prediction(business_id, supabase)
        if prediction:
            return {"available": True, **prediction}
        return {"available": False}
    except Exception as e:
        logger.debug(f"Prediction fetch error: {e}")
        return {"available": False}


@router.get("/roi-summary/{business_id}")
async def roi_summary(business_id: str, auth_user_id: str = Depends(require_auth)):
    return {
        "total_actions": 0,
        "total_estimated_value": 0,
        "total_confirmed_value": 0,
        "roi_ratio": 0,
        "by_type": {},
    }
