"""
Trustpilot adapter — fetches reviews via Tavily site search.

Trustpilot doesn't have a free public API, so we use Tavily to search
for Trustpilot reviews for the business and its competitors.

High-intent signals from Trustpilot:
- Low-rating reviews on competitors = switching opportunity
- Positive reviews on the business = social proof
- Complaints = reputation management
"""

import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.ingestion.adapters import MentionResult

logger = logging.getLogger(__name__)


async def _tavily_trustpilot_search(query: str, max_results: int = 5) -> list[dict]:
    """Search Trustpilot via Tavily."""
    if not settings.TAVILY_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": f"site:trustpilot.com {query}",
                    "max_results": max_results,
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            return resp.json().get("results", [])
    except Exception:
        logger.exception("Tavily Trustpilot search failed for: %s", query)
    return []


def _parse_result(result: dict, target_name: str) -> MentionResult:
    """Convert a Tavily/Trustpilot result to MentionResult."""
    title = result.get("title", "")
    content = result.get("content", "")
    url = result.get("url", "")

    # Try to extract rating from title (Trustpilot titles often contain "Rated X.X")
    rating = None
    import re
    rating_match = re.search(r"rated?\s*(\d(?:\.\d)?)\s*/?\s*5", title.lower())
    if rating_match:
        try:
            rating = float(rating_match.group(1))
        except ValueError:
            pass

    return MentionResult(
        title=f"Trustpilot: {title}"[:500] if "trustpilot" not in title.lower() else title[:500],
        snippet=content[:2000],
        url=url[:2048],
        published_at=None,
        raw_json={
            "source": "trustpilot",
            "rating": rating,
            "target_name": target_name,
            "text": content,
        },
        source_name="Trustpilot",
    )


async def fetch_trustpilot_reviews(
    business_name: str,
    location: str | None,
    competitor_names: list[str] | None = None,
) -> list[MentionResult]:
    """
    Fetch Trustpilot reviews for the business and competitors.
    Uses Tavily site:trustpilot.com search.
    """
    if not settings.TAVILY_API_KEY:
        logger.debug("Tavily API key not set — skipping Trustpilot")
        return []

    results: list[MentionResult] = []
    seen_urls: set[str] = set()

    targets = [business_name] + list((competitor_names or [])[:3])

    for name in targets:
        query = f"{name} reviews"
        if location:
            query += f" {location}"

        raw_results = await _tavily_trustpilot_search(query, max_results=3)
        for r in raw_results:
            url = r.get("url", "")
            if url in seen_urls:
                continue
            if "trustpilot.com" not in url.lower():
                continue
            seen_urls.add(url)
            results.append(_parse_result(r, name))

    logger.info("Trustpilot: fetched %d reviews for %d targets", len(results), len(targets))
    return results
