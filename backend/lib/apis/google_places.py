"""
Google Places API Client — Competitor search, place details, geocoding.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

_API_KEY = None


def _get_key() -> str:
    global _API_KEY
    if not _API_KEY:
        _API_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    if not _API_KEY:
        raise ValueError("GOOGLE_PLACES_API_KEY not set")
    return _API_KEY


async def search_nearby(
    business_type: str,
    lat: float,
    lng: float,
    radius_meters: int = 2000,
) -> list[dict]:
    """Find competitors near a lat/lng point."""
    key = _get_key()
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": str(radius_meters),
        "keyword": business_type,
        "language": "he",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.error(f"Google Places nearby error: {data.get('status')} — {data.get('error_message', '')}")
    return data.get("results", [])


async def get_place_details(place_id: str) -> dict | None:
    """Get full details for a place (rating, reviews, phone, website)."""
    key = _get_key()
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,rating,user_ratings_total,formatted_phone_number,website,reviews,geometry",
        "language": "he",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    return data.get("result")


async def geocode(address: str) -> dict | None:
    """Convert address to lat/lng/city. Appends ', ישראל' automatically."""
    key = _get_key()
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": f"{address}, ישראל",
        "language": "he",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    results = data.get("results", [])
    if not results:
        return None
    loc = results[0]["geometry"]["location"]
    components = results[0].get("address_components", [])
    city = ""
    for c in components:
        if "locality" in c.get("types", []):
            city = c.get("long_name", "")
            break
    return {"lat": loc["lat"], "lng": loc["lng"], "city": city}


def search_nearby_sync(
    business_type: str,
    lat: float,
    lng: float,
    radius_meters: int = 2000,
) -> list[dict]:
    """Sync version for use inside agents (non-async context)."""
    key = _get_key()
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": str(radius_meters),
        "keyword": business_type,
        "language": "he",
        "key": key,
    }
    resp = httpx.get(url, params=params, timeout=15)
    data = resp.json()
    return data.get("results", [])


def get_place_details_sync(place_id: str) -> dict | None:
    """Sync version for use inside agents."""
    key = _get_key()
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,rating,user_ratings_total,formatted_phone_number,website,reviews,geometry",
        "language": "he",
        "key": key,
    }
    resp = httpx.get(url, params=params, timeout=15)
    data = resp.json()
    return data.get("result")


def geocode_sync(address: str) -> dict | None:
    """Sync version for use inside agents."""
    key = _get_key()
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": f"{address}, ישראל",
        "language": "he",
        "key": key,
    }
    resp = httpx.get(url, params=params, timeout=10)
    data = resp.json()
    results = data.get("results", [])
    if not results:
        return None
    loc = results[0]["geometry"]["location"]
    components = results[0].get("address_components", [])
    city = ""
    for c in components:
        if "locality" in c.get("types", []):
            city = c.get("long_name", "")
            break
    return {"lat": loc["lat"], "lng": loc["lng"], "city": city}
