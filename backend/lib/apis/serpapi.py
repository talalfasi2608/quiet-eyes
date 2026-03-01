"""
SerpAPI Client — Google Trends + Google Search for market intelligence.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)


def _get_key() -> str:
    key = os.getenv("SERPAPI_KEY") or os.getenv("SERPAPI_API_KEY", "")
    if not key:
        raise ValueError("SERPAPI_KEY not set")
    return key


def google_search(query: str, num: int = 10, location: str = "Israel") -> list[dict]:
    """Run a Google search via SerpAPI. Returns organic results."""
    key = _get_key()
    try:
        resp = httpx.get(
            "https://serpapi.com/search.json",
            params={
                "q": query,
                "location": location,
                "hl": "he",
                "gl": "il",
                "num": num,
                "api_key": key,
            },
            timeout=15,
        )
        data = resp.json()
        return data.get("organic_results", [])
    except Exception as e:
        logger.error(f"SerpAPI Google search failed: {e}")
        return []


def google_trends(keyword: str, geo: str = "IL") -> dict:
    """Get Google Trends data for a keyword in Israel."""
    key = _get_key()
    try:
        resp = httpx.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_trends",
                "q": keyword,
                "geo": geo,
                "data_type": "TIMESERIES",
                "api_key": key,
            },
            timeout=15,
        )
        data = resp.json()
        return {
            "interest_over_time": data.get("interest_over_time", {}),
            "related_queries": data.get("related_queries", {}),
        }
    except Exception as e:
        logger.error(f"SerpAPI Google Trends failed: {e}")
        return {}


def google_maps_reviews(place_id: str, num_reviews: int = 10) -> list[dict]:
    """Fetch Google Maps reviews for a place."""
    key = _get_key()
    try:
        resp = httpx.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_maps_reviews",
                "place_id": place_id,
                "hl": "he",
                "num": num_reviews,
                "api_key": key,
            },
            timeout=15,
        )
        data = resp.json()
        return data.get("reviews", [])
    except Exception as e:
        logger.error(f"SerpAPI reviews failed: {e}")
        return []
