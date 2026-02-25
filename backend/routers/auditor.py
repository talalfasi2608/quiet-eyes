"""
Auditor Router — Business review scraping and analysis.
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Depends

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auditor", tags=["auditor"])


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


def _verify_business_owner(business_id: str, auth_user_id: str):
    """Verify the authenticated user owns this business. Raises 403 if not."""
    sb = _get_service_client()
    if sb:
        try:
            result = sb.table("businesses").select("user_id").eq("id", business_id).execute()
            if result.data and result.data[0].get("user_id") == auth_user_id:
                return
        except Exception:
            pass
    raise HTTPException(status_code=403, detail="Access denied")


@router.get("/analysis/{business_id}")
async def get_review_analysis(business_id: str, auth_user_id: str = Depends(require_auth)):
    """
    Fetch and analyze reviews for a business.

    Uses Tavily to search for reviews across Google, Facebook, etc.,
    then uses Claude AI to extract sentiment, themes, and suggestions.

    Returns a ReviewAnalysis object matching the frontend interface.
    """
    _verify_business_owner(business_id, auth_user_id)
    try:
        from services.review_scraper import analyze_reviews
        result = analyze_reviews(business_id)
        return result
    except Exception as e:
        logger.error(f"Review analysis error for {business_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
