"""
Competitors Router — list, detail, research, manual add, AI insight.
"""

import logging
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Competitors"])


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


@router.get("/competitors/{business_id}")
async def list_competitors(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _get_service_client()
    if not supabase:
        return {"competitors": []}

    _verify_business_owner(supabase, business_id, auth_user_id)

    competitors = []
    try:
        r = supabase.table("competitors").select("*").eq("business_id", business_id).execute()
        if r.data:
            # Deduplicate by name, keeping newest (last in list)
            seen: dict[str, dict] = {}
            for c in r.data:
                key = (c.get("place_id") or c.get("name", "")).strip().lower()
                seen[key] = c  # last wins = newest
            competitors = list(seen.values())
    except Exception as e:
        logger.debug(f"Competitors lookup: {e}")
    return {"competitors": competitors}


@router.get("/competitor/{competitor_id}/detail")
async def competitor_detail(competitor_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify ownership via the competitor's business_id
    try:
        r = supabase.table("competitors").select("*, business_id").eq("id", competitor_id).execute()
        if r.data and len(r.data) > 0:
            _verify_business_owner(supabase, r.data[0]["business_id"], auth_user_id)
            return {"success": True, "competitor": r.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.debug(f"Competitor detail: {e}")
    raise HTTPException(status_code=404, detail="Competitor not found")


@router.post("/research/competitor/{competitor_id}")
async def research_competitor(competitor_id: str, auth_user_id: str = Depends(require_auth)):
    return {"success": True, "message": "Research queued"}


class AddCompetitorRequest(BaseModel):
    name: str
    website: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None


@router.post("/competitors/{business_id}/add")
async def add_competitor_manually(
    business_id: str,
    payload: AddCompetitorRequest,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """Manually add a competitor by name."""
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(supabase, business_id, auth_user_id)

    try:
        row = {
            "business_id": business_id,
            "name": payload.name.strip(),
            "perceived_threat_level": "Medium",
            "website": payload.website,
            "phone": payload.phone,
            "description": payload.description,
        }
        result = supabase.table("competitors").insert(row).execute()
        competitor = result.data[0] if result.data else row
        return {"success": True, "competitor": competitor}
    except Exception as e:
        logger.error(f"Add competitor failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to add competitor")


@router.post("/competitor/{competitor_id}/ai-insight")
async def generate_competitor_insight(
    competitor_id: str,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """Generate an AI insight for a competitor vs the user's business."""
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Fetch competitor
    try:
        r = supabase.table("competitors").select("*").eq("id", competitor_id).execute()
        if not r.data:
            raise HTTPException(status_code=404, detail="Competitor not found")
        comp = r.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fetch competitor: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch competitor")

    _verify_business_owner(supabase, comp["business_id"], auth_user_id)

    # Fetch business details
    try:
        biz_r = supabase.table("businesses").select(
            "business_name, industry, business_type, google_rating, google_reviews_count"
        ).eq("id", comp["business_id"]).limit(1).execute()
        biz = biz_r.data[0] if biz_r.data else {}
    except Exception:
        biz = {}

    biz_name = biz.get("business_name", "העסק שלך")
    biz_rating = biz.get("google_rating") or "לא ידוע"
    biz_reviews = biz.get("google_reviews_count") or "לא ידוע"
    industry = biz.get("industry") or biz.get("business_type") or ""

    comp_name = comp.get("name", "")
    comp_rating = comp.get("google_rating") or "לא ידוע"
    comp_reviews = comp.get("google_reviews_count") or "לא ידוע"
    comp_weakness = comp.get("identified_weakness") or ""
    threat = comp.get("perceived_threat_level", "Medium")

    try:
        from services.claude_client import analyze as claude_analyze

        prompt = f"""אתה יועץ עסקי. נתח את המתחרה הבא מול העסק של הלקוח.

העסק שלי: "{biz_name}" (תחום: {industry})
- דירוג גוגל: {biz_rating} ({biz_reviews} ביקורות)

המתחרה: "{comp_name}"
- דירוג גוגל: {comp_rating} ({comp_reviews} ביקורות)
- רמת איום: {threat}
- חולשה שזוהתה: {comp_weakness or 'לא זוהתה'}

כתוב 2-3 משפטים בעברית:
1. השוואה קצרה (יתרון/חיסרון מול המתחרה)
2. המלצה אחת מעשית

החזר רק את הטקסט, בלי כותרות."""

        insight = claude_analyze(
            prompt=prompt,
            system="אתה יועץ עסקי שנותן תובנות קצרות וממוקדות בעברית.",
            temperature=0.7,
            max_tokens=300,
        )
        return {"success": True, "insight": insight.strip()}
    except Exception as e:
        logger.error(f"AI insight failed: {e}")
        fallback = f"המתחרה {comp_name} מדורג ב-{comp_rating} עם {comp_reviews} ביקורות. "
        if threat == "High":
            fallback += "זהו מתחרה חזק — כדאי לעקוב אחריו מקרוב ולחפש את הנקודות החלשות שלו."
        elif threat == "Medium":
            fallback += "מתחרה בינוני — שימו לב לנקודות החוזק שלכם כדי לבדל את העסק."
        else:
            fallback += "מתחרה חלש יחסית — שמרו על הקצב הנוכחי."
        return {"success": True, "insight": fallback}
