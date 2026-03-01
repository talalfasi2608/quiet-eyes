"""
Tavily API Client — Web search for trends, news, and market intelligence.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)


def _get_key() -> str:
    key = os.getenv("TAVILY_API_KEY", "")
    if not key:
        raise ValueError("TAVILY_API_KEY not set")
    return key


def search(query: str, max_results: int = 5) -> dict:
    """
    Search the web via Tavily.
    Returns { answer: str, results: list[dict] }.
    """
    key = _get_key()
    try:
        resp = httpx.post(
            "https://api.tavily.com/search",
            json={
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_answer": True,
                "include_raw_content": False,
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            timeout=15,
        )
        data = resp.json()
        return {
            "answer": data.get("answer", ""),
            "results": data.get("results", []),
        }
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return {"answer": "", "results": []}


def search_trends(business_type: str, city: str) -> list[dict]:
    """Search for business trends in Israel relevant to a business type."""
    queries = [
        f"{business_type} מגמות 2025 ישראל",
        f"{business_type} חדש פופולרי ישראל",
        f"טרנד {business_type} {city}",
    ]
    all_results = []
    for q in queries:
        result = search(q, max_results=3)
        all_results.extend(result.get("results", []))
    return all_results
