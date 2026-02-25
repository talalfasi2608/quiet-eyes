"""
Expert / Growth Advisor Router — weight class + growth plan.
"""

import logging
import os
from fastapi import APIRouter, Depends, Request

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/expert", tags=["Expert"])


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


@router.get("/weight-class/{business_id}")
async def weight_class(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _sb(request)
    biz_name = ""
    industry = ""
    archetype = "Merchant"
    if supabase:
        try:
            r = supabase.table("businesses").select("business_name, industry, archetype").eq("id", business_id).execute()
            if r.data:
                biz_name = r.data[0].get("business_name", "")
                industry = r.data[0].get("industry", "")
                archetype = r.data[0].get("archetype", "Merchant")
        except Exception:
            pass

    return {
        "business_id": business_id,
        "business_name": biz_name,
        "industry": industry,
        "archetype": archetype,
        "weight_class": "rising",
        "description": "העסק שלך בצמיחה — יש פוטנציאל גדול לצמוח בשוק.",
        "growth_potential": "high",
        "metrics": {
            "market_share_estimate": "5-10%",
            "brand_awareness": "medium",
            "digital_presence": "growing",
        },
    }


@router.get("/growth-plan/{business_id}")
async def growth_plan(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _sb(request)
    biz_name = ""
    industry = ""
    if supabase:
        try:
            r = supabase.table("businesses").select("business_name, industry").eq("id", business_id).execute()
            if r.data:
                biz_name = r.data[0].get("business_name", "")
                industry = r.data[0].get("industry", "")
        except Exception:
            pass

    return {
        "business_id": business_id,
        "business_name": biz_name,
        "weight_class": "rising",
        "industry": industry,
        "archetype": "Merchant",
        "growth_steps": [
            {"step": 1, "title": "חזק את הנוכחות הדיגיטלית", "description": "שפר את הפרופיל בגוגל, הוסף תמונות ועדכן שעות פעילות.", "status": "pending"},
            {"step": 2, "title": "השק קמפיין ביקורות", "description": "בקש מלקוחות מרוצים להשאיר ביקורת בגוגל.", "status": "pending"},
            {"step": 3, "title": "נתח את המתחרים", "description": "הפעל סריקת מתחרים כדי לזהות חולשות שאפשר לנצל.", "status": "pending"},
        ],
        "strategy_summary": "התמקד בבניית מוניטין דיגיטלי וניצול חולשות מתחרים.",
        "priority_focus": "digital_presence",
    }
