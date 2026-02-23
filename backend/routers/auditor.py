"""
Auditor Router — Business review scraping and analysis.
"""

import logging
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auditor", tags=["auditor"])


@router.get("/analysis/{business_id}")
async def get_review_analysis(business_id: str):
    """
    Fetch and analyze reviews for a business.

    Uses Tavily to search for reviews across Google, Facebook, etc.,
    then uses OpenAI to extract sentiment, themes, and suggestions.

    Returns a ReviewAnalysis object matching the frontend interface.
    """
    try:
        from services.review_scraper import analyze_reviews
        result = analyze_reviews(business_id)
        return result
    except Exception as e:
        logger.error(f"Review analysis error for {business_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
