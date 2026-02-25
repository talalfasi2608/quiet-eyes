"""
Dashboard Router.

GET /dashboard/summary/{business_id} — returns full dashboard data.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


@router.get("/summary/{business_id}")
async def dashboard_summary(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Return full dashboard summary for a business."""
    from routers._auth_helper import get_supabase_client
    supabase = _get_service_client() or get_supabase_client(request) or _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify ownership: auth_user_id must own this business
    try:
        owner_check = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
        if not owner_check.data or owner_check.data[0].get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ownership check failed for {business_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify ownership")

    # Fetch business info
    try:
        biz_result = (
            supabase.table("businesses")
            .select("*")
            .eq("id", business_id)
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to fetch business {business_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch business data")

    if not biz_result.data or len(biz_result.data) == 0:
        raise HTTPException(status_code=404, detail="Business not found")

    biz = biz_result.data[0]

    # Fetch competitors
    competitors = []
    try:
        comp_result = (
            supabase.table("competitors")
            .select("*")
            .eq("business_id", business_id)
            .execute()
        )
        if comp_result.data:
            competitors = [
                {
                    "id": c.get("id", ""),
                    "name": c.get("name", ""),
                    "latitude": c.get("latitude"),
                    "longitude": c.get("longitude"),
                    "google_rating": c.get("google_rating", 0),
                    "google_reviews_count": c.get("google_reviews_count", 0),
                    "trust_score": c.get("trust_score", 0),
                    "is_top": c.get("is_top", False) or c.get("perceived_threat_level", "").lower() == "high",
                    "threat_level": c.get("threat_level") or c.get("perceived_threat_level", "medium"),
                    "website": c.get("website"),
                    "phone": c.get("phone"),
                    "price_level": c.get("price_level"),
                    "last_scanned": c.get("last_scanned") or c.get("created_at"),
                }
                for c in comp_result.data
            ]
            # Deduplicate by place_id or name, keeping newest
            seen = {}
            for c in competitors:
                key = c.get("name", "").strip().lower()
                if key not in seen:
                    seen[key] = c
            competitors = list(seen.values())
    except Exception as e:
        logger.debug(f"Competitors lookup: {e}")

    # Fetch strategy feed / leads
    strategy_feed = []
    try:
        feed_result = (
            supabase.table("leads_discovered")
            .select("*")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        if feed_result.data:
            strategy_feed = [
                {
                    "id": f.get("id", ""),
                    "type": f.get("type") or f.get("platform", "lead"),
                    "title": f.get("title") or f.get("summary", ""),
                    "description": f.get("description") or f.get("original_text") or f.get("summary", ""),
                    "source": f.get("source") or f.get("platform", ""),
                    "source_url": f.get("source_url"),
                    "priority": f.get("priority") or ("high" if (f.get("relevance_score") or 0) >= 0.85 else ("medium" if (f.get("relevance_score") or 0) >= 0.7 else "low")),
                    "action_label": f.get("action_label") or "צפה",
                    "timestamp": f.get("created_at", ""),
                    "competitor_name": f.get("competitor_name"),
                }
                for f in feed_result.data
            ]
    except Exception as e:
        logger.debug(f"Strategy feed lookup: {e}")

    # Build market stats
    total_competitors = len(competitors)
    top_competitors = sum(1 for c in competitors if c.get("is_top"))
    high_threat = sum(1 for c in competitors if (c.get("threat_level") or "").lower() == "high")
    ratings = [c["google_rating"] for c in competitors if c.get("google_rating")]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0
    reviews = [c["google_reviews_count"] for c in competitors if c.get("google_reviews_count")]
    avg_reviews = round(sum(reviews) / len(reviews)) if reviews else 0
    total_reviews = sum(reviews)

    your_rating = biz.get("google_rating", 0) or 0
    rating_diff = round(your_rating - avg_rating, 1) if your_rating and avg_rating else None

    # Parse analysis data if stored
    services = biz.get("top_services") or []
    if isinstance(services, str):
        services = [s.strip() for s in services.split(",") if s.strip()]

    weaknesses = biz.get("marketing_weaknesses") or []
    if isinstance(weaknesses, str):
        import json as _json
        try:
            weaknesses = _json.loads(weaknesses)
        except Exception:
            weaknesses = [{"issue": weaknesses, "severity": "medium", "fix": ""}]

    business_info = {
        "id": biz.get("id"),
        "name": biz.get("business_name", ""),
        "name_hebrew": biz.get("business_name", ""),
        "address": biz.get("address") or biz.get("location", ""),
        "industry": biz.get("industry", ""),
        "website": biz.get("website"),
        "latitude": biz.get("latitude"),
        "longitude": biz.get("longitude"),
        "price_tier": biz.get("price_tier", "standard"),
        "services": services,
        "usp": biz.get("unique_selling_point", ""),
        "weaknesses": weaknesses,
        "tone": biz.get("tone", ""),
        "market_health_score": biz.get("pulse_score", 50) or 50,
        "summary": biz.get("summary", ""),
    }

    market_stats = {
        "total_competitors": total_competitors,
        "top_competitors": top_competitors,
        "high_threat_competitors": high_threat,
        "avg_market_rating": avg_rating,
        "your_rating": your_rating,
        "rating_difference": rating_diff,
        "avg_competitor_reviews": avg_reviews,
        "total_competitor_reviews": total_reviews,
        "market_saturation": "high" if total_competitors > 10 else ("medium" if total_competitors > 3 else "low"),
        "competitive_advantage": "above" if (rating_diff and rating_diff > 0) else ("below" if (rating_diff and rating_diff < 0) else "equal"),
    }

    return {
        "business_info": business_info,
        "competitors": competitors,
        "strategy_feed": strategy_feed,
        "market_stats": market_stats,
    }
