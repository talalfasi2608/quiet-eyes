"""
Radar Router — competitor sync/discovery via Google Places API.
"""

import logging
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/radar", tags=["Radar"])


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
    """Verify the authenticated user owns this business."""
    try:
        result = (
            supabase.table("businesses")
            .select("user_id")
            .eq("id", business_id)
            .execute()
        )
        rows = result.data if result else []
        if not rows:
            svc = _get_service_client()
            if svc:
                result = svc.table("businesses").select("user_id").eq("id", business_id).execute()
                rows = result.data if result else []
        if not rows:
            raise HTTPException(status_code=404, detail="Business not found")
        if rows[0].get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Business ownership check failed: {e}")
        raise HTTPException(status_code=500, detail="Ownership check failed")


def _geocode_address(address: str) -> tuple:
    """Geocode an address using Google Maps Geocoding API. Returns (lat, lng) or (None, None)."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None, None
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": api_key, "language": "he"},
            )
            data = resp.json()
            if data.get("results"):
                loc = data["results"][0].get("geometry", {}).get("location", {})
                return loc.get("lat"), loc.get("lng")
    except Exception as e:
        logger.error(f"Geocoding error for '{address}': {e}")
    return None, None


def _discover_competitors(business_id: str, supabase) -> int:
    """
    Discover competitors near a business using Google Places Nearby Search.
    Returns count of new competitors saved.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("No Google API key configured for competitor discovery")
        return 0

    # Fetch business info
    biz = supabase.table("businesses").select(
        "business_name, industry, location, address, latitude, longitude"
    ).eq("id", business_id).limit(1).execute()

    if not biz.data:
        return 0

    business = biz.data[0]
    biz_name = business.get("business_name", "")
    industry = business.get("industry", "")
    location = business.get("address") or business.get("location", "")

    # Resolve city config for city-aware radius and district search
    from data.cities import get_city_config
    city_config = get_city_config(business.get("location", "") or location)
    search_radius = city_config["radius_km"] * 1000
    lat = business.get("latitude") or 0
    lng = business.get("longitude") or 0

    # If no coords, geocode the address first
    if not lat or not lng or (lat == 0 and lng == 0):
        lat, lng = _geocode_address(location)
        if lat and lng:
            # Save geocoded coords back to business
            try:
                supabase.table("businesses").update({
                    "latitude": lat, "longitude": lng,
                }).eq("id", business_id).execute()
                logger.info(f"Geocoded business {business_id}: {lat}, {lng}")
            except Exception as e:
                logger.debug(f"Failed to save geocoded coords: {e}")

    if not lat or not lng:
        logger.warning(f"Cannot discover competitors: no coordinates for business {business_id}")
        return 0

    # Map Hebrew industry names to Google Places types
    industry_type_map = {
        "מסעדה": "restaurant", "מסעדות": "restaurant", "קפה": "cafe",
        "ספורט": "store", "חנות ספורט": "store", "חנות": "store",
        "מספרה": "hair_care", "ספא": "spa", "יופי": "beauty_salon",
        "מאפייה": "bakery", "סופר": "supermarket", "מכולת": "grocery_or_supermarket",
        "רופא": "doctor", "שיניים": "dentist", "בריאות": "health",
        "עורך דין": "lawyer", "חינוך": "school", "כושר": "gym",
    }

    # Find best matching type
    place_type = "establishment"
    industry_lower = industry.lower()
    for keyword, gtype in industry_type_map.items():
        if keyword in industry_lower:
            place_type = gtype
            break

    # Search for nearby competitors
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": f"{lat},{lng}",
                    "radius": search_radius,
                    "type": place_type,
                    "keyword": industry,
                    "key": api_key,
                    "language": "he",
                },
            )
            data = resp.json()
    except Exception as e:
        logger.error(f"Google Places search failed: {e}")
        return 0

    if data.get("status") != "OK":
        logger.warning(f"Places API returned status: {data.get('status')}")
        return 0

    results = data.get("results", [])

    # Load existing competitor place_ids for dedup
    existing = supabase.table("competitors").select("place_id, name").eq(
        "business_id", business_id
    ).execute()
    existing_place_ids = {c.get("place_id") for c in (existing.data or []) if c.get("place_id")}
    existing_names = {c.get("name", "").lower().strip() for c in (existing.data or [])}

    saved = 0
    for place in results[:20]:
        name = place.get("name", "")
        place_id = place.get("place_id", "")

        # Skip own business
        if name.lower().strip() == biz_name.lower().strip():
            continue

        # Skip duplicates
        if place_id in existing_place_ids or name.lower().strip() in existing_names:
            continue

        place_loc = place.get("geometry", {}).get("location", {})
        rating = place.get("rating", 0)
        reviews_count = place.get("user_ratings_total", 0)

        # Determine threat level based on rating + review count (capitalized for DB check constraint)
        threat = "Low"
        if rating >= 4.5 and reviews_count >= 50:
            threat = "High"
        elif rating >= 4.0 and reviews_count >= 20:
            threat = "Medium"

        try:
            supabase.table("competitors").insert({
                "business_id": business_id,
                "name": name,
                "place_id": place_id,
                "latitude": place_loc.get("lat"),
                "longitude": place_loc.get("lng"),
                "google_rating": rating,
                "google_reviews_count": reviews_count,
                "perceived_threat_level": threat,
                "address": place.get("vicinity", ""),
                "website": None,
            }).execute()
            saved += 1
            existing_place_ids.add(place_id)
            existing_names.add(name.lower().strip())
        except Exception as e:
            logger.debug(f"Failed to save competitor '{name}': {e}")

    # District-level text search for hyperlocal competitor discovery
    city_name = business.get("location", "") or location
    for district in city_config.get("districts", [])[:3]:
        try:
            with httpx.Client(timeout=15) as client:
                text_resp = client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={
                        "query": f"{industry} {district} {city_name}",
                        "key": api_key,
                        "language": "he",
                    },
                )
                text_data = text_resp.json()
            for place in (text_data.get("results", []) or [])[:10]:
                name = place.get("name", "")
                place_id = place.get("place_id", "")
                if not name or not place_id:
                    continue
                if name.lower().strip() == biz_name.lower().strip():
                    continue
                if place_id in existing_place_ids or name.lower().strip() in existing_names:
                    continue

                place_loc = place.get("geometry", {}).get("location", {})
                rating = place.get("rating", 0)
                reviews_count = place.get("user_ratings_total", 0)
                threat = "Low"
                if rating >= 4.5 and reviews_count >= 50:
                    threat = "High"
                elif rating >= 4.0 and reviews_count >= 20:
                    threat = "Medium"

                try:
                    supabase.table("competitors").insert({
                        "business_id": business_id,
                        "name": name,
                        "place_id": place_id,
                        "latitude": place_loc.get("lat"),
                        "longitude": place_loc.get("lng"),
                        "google_rating": rating,
                        "google_reviews_count": reviews_count,
                        "perceived_threat_level": threat,
                        "address": place.get("formatted_address", ""),
                        "website": None,
                    }).execute()
                    saved += 1
                    existing_place_ids.add(place_id)
                    existing_names.add(name.lower().strip())
                except Exception as e:
                    logger.debug(f"Failed to save district competitor '{name}': {e}")
        except Exception as e:
            logger.debug(f"District text search error for '{district}': {e}")

    logger.info(f"Radar sync for {business_id}: found {len(results)}, saved {saved} new competitors")
    return saved


@router.post("/sync/{business_id}")
async def radar_sync(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Trigger a competitor discovery scan for a business."""
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    new_competitors = _discover_competitors(business_id, sb)

    return {"success": True, "message": "Radar sync completed", "new_competitors": new_competitors}
