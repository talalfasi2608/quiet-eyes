"""
Google Places adapter — fetches place details and reviews via the Places API.

Uses the Google Places API (New) to:
1. Find the place by name + location
2. Fetch reviews for that place
3. Normalize into MentionResult objects

Each review becomes a mention with high intent signal potential.
"""

import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.ingestion.adapters import MentionResult

logger = logging.getLogger(__name__)

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"


async def _find_place_id(business_name: str, location: str | None) -> str | None:
    """Find a Google place_id by text search."""
    query = business_name
    if location:
        query += f" {location}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                PLACES_TEXT_SEARCH_URL,
                headers={
                    "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
                    "X-Goog-FieldMask": "places.id,places.displayName",
                },
                json={"textQuery": query, "maxResultCount": 1},
            )
            if resp.status_code != 200:
                logger.warning("Places text search failed: %s %s", resp.status_code, resp.text[:200])
                return None
            data = resp.json()
            places = data.get("places", [])
            if places:
                return places[0]["id"]
    except Exception:
        logger.exception("Places text search error for '%s'", query)
    return None


async def _fetch_reviews(place_id: str) -> list[dict]:
    """Fetch reviews for a place_id via Places API (New)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                PLACES_DETAILS_URL.format(place_id=place_id),
                headers={
                    "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
                    "X-Goog-FieldMask": "reviews",
                },
            )
            if resp.status_code != 200:
                logger.warning("Places details failed: %s", resp.status_code)
                return []
            data = resp.json()
            return data.get("reviews", [])
    except Exception:
        logger.exception("Places details error for %s", place_id)
    return []


def _parse_review(review: dict, place_name: str) -> MentionResult:
    """Convert a Google Places review to a MentionResult."""
    author = review.get("authorAttribution", {}).get("displayName", "Anonymous")
    text = review.get("text", {}).get("text", "")
    rating = review.get("rating", 0)
    publish_time = review.get("publishTime")

    pub_dt = None
    if publish_time:
        try:
            pub_dt = datetime.fromisoformat(publish_time.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    rating_label = f"{rating}/5" if rating else ""
    title = f"Google Review for {place_name} — {rating_label} by {author}"

    return MentionResult(
        title=title[:500],
        snippet=text[:2000] if text else f"Rated {rating_label}",
        url=review.get("authorAttribution", {}).get("uri", ""),
        published_at=pub_dt,
        raw_json={
            "source": "google_places",
            "rating": rating,
            "author": author,
            "text": text,
        },
        source_name="Google Places",
    )


async def fetch_google_reviews(
    business_name: str,
    location: str | None,
    competitor_names: list[str] | None = None,
) -> list[MentionResult]:
    """
    Fetch Google reviews for the business and optionally its competitors.
    Returns MentionResult list.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        logger.debug("Google Places API key not set — skipping")
        return []

    results: list[MentionResult] = []

    # Fetch for the business itself
    targets = [(business_name, location)]
    for comp in (competitor_names or [])[:3]:
        targets.append((comp, location))

    for name, loc in targets:
        place_id = await _find_place_id(name, loc)
        if not place_id:
            continue

        reviews = await _fetch_reviews(place_id)
        for review in reviews[:10]:
            results.append(_parse_review(review, name))

    logger.info(
        "Google Places: fetched %d reviews for %d targets",
        len(results),
        len(targets),
    )
    return results
