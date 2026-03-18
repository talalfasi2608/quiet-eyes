"""
Yelp adapter — fetches business reviews and competitor reviews.

Uses the Yelp Fusion API (via RapidAPI) to:
1. Find the business by name + location
2. Fetch reviews
3. Also fetch reviews for competitors to detect dissatisfaction signals

Dissatisfaction and switching signals are high-value leads.
"""

import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.ingestion.adapters import MentionResult

logger = logging.getLogger(__name__)

YELP_SEARCH_URL = "https://api.yelp.com/v3/businesses/search"
YELP_REVIEWS_URL = "https://api.yelp.com/v3/businesses/{biz_id}/reviews"

# RapidAPI alternative endpoints
RAPIDAPI_YELP_HOST = "yelp-reviews.p.rapidapi.com"
RAPIDAPI_YELP_SEARCH = "https://yelp-reviews.p.rapidapi.com/business-search"
RAPIDAPI_YELP_REVIEWS = "https://yelp-reviews.p.rapidapi.com/business-reviews"


async def _search_yelp_business(name: str, location: str | None) -> str | None:
    """Find Yelp business ID via RapidAPI or Tavily fallback."""
    if settings.RAPIDAPI_KEY:
        return await _rapidapi_search(name, location)
    return None


async def _rapidapi_search(name: str, location: str | None) -> str | None:
    """Search Yelp via RapidAPI."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                RAPIDAPI_YELP_SEARCH,
                params={
                    "query": name,
                    "location": location or "",
                    "limit": 1,
                },
                headers={
                    "x-rapidapi-key": settings.RAPIDAPI_KEY,
                    "x-rapidapi-host": RAPIDAPI_YELP_HOST,
                },
            )
            if resp.status_code != 200:
                logger.warning("RapidAPI Yelp search failed: %s", resp.status_code)
                return None
            data = resp.json()
            businesses = data.get("businesses", [])
            if businesses:
                return businesses[0].get("id")
    except Exception:
        logger.exception("RapidAPI Yelp search error")
    return None


async def _fetch_yelp_reviews(biz_id: str) -> list[dict]:
    """Fetch reviews from Yelp via RapidAPI."""
    if not settings.RAPIDAPI_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                RAPIDAPI_YELP_REVIEWS,
                params={"business_id": biz_id, "num_pages": "1"},
                headers={
                    "x-rapidapi-key": settings.RAPIDAPI_KEY,
                    "x-rapidapi-host": RAPIDAPI_YELP_HOST,
                },
            )
            if resp.status_code != 200:
                logger.warning("RapidAPI Yelp reviews failed: %s", resp.status_code)
                return []
            data = resp.json()
            return data.get("reviews", [])
    except Exception:
        logger.exception("RapidAPI Yelp reviews error")
    return []


async def _tavily_yelp_fallback(business_name: str, location: str | None) -> list[MentionResult]:
    """Use Tavily to search for Yelp reviews when API is not available."""
    if not settings.TAVILY_API_KEY:
        return []

    query = f"site:yelp.com {business_name}"
    if location:
        query += f" {location}"
    query += " review"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": query,
                    "max_results": 5,
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for r in data.get("results", []):
            results.append(MentionResult(
                title=r.get("title", "")[:500],
                snippet=r.get("content", "")[:2000],
                url=r.get("url", "")[:2048],
                published_at=None,
                raw_json={"source": "yelp_tavily", **r},
                source_name="Yelp (via search)",
            ))
        return results
    except Exception:
        logger.exception("Tavily Yelp fallback failed")
    return []


def _parse_yelp_review(review: dict, business_name: str) -> MentionResult:
    """Convert a Yelp API review to MentionResult."""
    user = review.get("user", {})
    author = user.get("name", "Anonymous")
    text = review.get("text", "")
    rating = review.get("rating", 0)
    time_created = review.get("time_created", "")
    url = review.get("url", "")

    pub_dt = None
    if time_created:
        try:
            pub_dt = datetime.fromisoformat(time_created)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            pass

    rating_label = f"{rating}/5" if rating else ""
    title = f"Yelp Review for {business_name} — {rating_label} by {author}"

    return MentionResult(
        title=title[:500],
        snippet=text[:2000] if text else f"Rated {rating_label}",
        url=url[:2048] if url else "",
        published_at=pub_dt,
        raw_json={
            "source": "yelp",
            "rating": rating,
            "author": author,
            "text": text,
        },
        source_name="Yelp",
    )


async def fetch_yelp_reviews(
    business_name: str,
    location: str | None,
    competitor_names: list[str] | None = None,
) -> list[MentionResult]:
    """
    Fetch Yelp reviews for the business and its competitors.
    Falls back to Tavily site:yelp.com search if the Yelp API is unavailable.
    """
    results: list[MentionResult] = []

    targets = [(business_name, True)]
    for comp in (competitor_names or [])[:3]:
        targets.append((comp, False))

    has_rapidapi = bool(settings.RAPIDAPI_KEY)

    for name, is_primary in targets:
        if has_rapidapi:
            biz_id = await _search_yelp_business(name, location)
            if biz_id:
                reviews = await _fetch_yelp_reviews(biz_id)
                for review in reviews[:10]:
                    results.append(_parse_yelp_review(review, name))
                continue

        # Fallback to Tavily
        tavily_results = await _tavily_yelp_fallback(name, location)
        results.extend(tavily_results)

    logger.info("Yelp: fetched %d reviews for %d targets", len(results), len(targets))
    return results
