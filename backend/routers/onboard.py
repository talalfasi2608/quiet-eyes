"""
Onboarding Router.

Handles new-business creation during the onboarding wizard flow.
- POST /onboard/wizard  — create (or upsert) a business record
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboard", tags=["Onboarding"])


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _get_service_role_client():
    """Get a Supabase client with service-role key to bypass RLS for onboarding."""
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return _get_supabase()


def _get_authenticated_client(request):
    from routers._auth_helper import get_supabase_client
    return get_supabase_client(request)


def _geocode_address(address: str) -> tuple:
    """Geocode an address using Google Maps Geocoding API. Returns (lat, lng) or (None, None)."""
    import os
    import httpx
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key or not address:
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


class AnalyzeSiteRequest(BaseModel):
    url: str
    business_id: str
    provided_address: Optional[str] = None


@router.post("/analyze-site")
async def analyze_site(payload: AnalyzeSiteRequest, auth_user_id: str = Depends(require_auth)):
    """
    Scrape a business website and return an AI-generated analysis.
    Returns top_services, unique_selling_point, price_positioning, etc.
    """
    import httpx

    try:
        anthropic_key = None
        try:
            from config import get_settings
            anthropic_key = get_settings().anthropic_api_key
        except Exception:
            pass

        if not anthropic_key:
            raise HTTPException(status_code=503, detail="AI service unavailable")

        from services.claude_client import analyze as claude_analyze

        # Fetch website content
        site_text = ""
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
                resp = await http.get(payload.url, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; Quieteyes/1.0)"
                })
                if resp.status_code == 200:
                    # Strip HTML tags for a rough text extraction
                    import re
                    html = resp.text[:15000]  # limit size
                    site_text = re.sub(r'<[^>]+>', ' ', html)
                    site_text = re.sub(r'\s+', ' ', site_text).strip()[:5000]
        except Exception as e:
            logger.warning(f"Failed to fetch {payload.url}: {e}")
            site_text = f"(Could not fetch website: {payload.url})"

        # AI analysis
        prompt = f"""Analyze this business website content and return a JSON object.
Website URL: {payload.url}
Address: {payload.provided_address or 'unknown'}
Content: {site_text[:3000]}

Return ONLY valid JSON with these fields:
{{
  "top_services": ["service1", "service2", "service3"],
  "unique_selling_point": "one sentence in Hebrew",
  "price_positioning": "budget|standard|premium",
  "marketing_weaknesses": ["weakness1 in Hebrew", "weakness2 in Hebrew"],
  "overall_score": 7
}}"""

        raw = claude_analyze(
            prompt=prompt,
            system="Always respond with valid JSON only.",
            temperature=0.3,
            max_tokens=500,
        )

        import json
        raw = raw.strip()
        # Extract JSON from potential markdown code block
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        analysis = json.loads(raw)

        logger.info(f"Site analysis complete for {payload.url}")
        return {"success": True, "analysis": analysis}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analyze-site failed for {payload.url}: {e}")
        raise HTTPException(status_code=500, detail="Site analysis failed")


class OnboardWizardRequest(BaseModel):
    user_id: str
    business_name: str
    address: str
    industry: str
    website_url: Optional[str] = None
    target_audience: Optional[str] = None
    price_tier: Optional[str] = None
    main_competitor: Optional[str] = None
    # Step 1 extras
    exact_address: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Step 2
    business_age: Optional[str] = None
    employee_count: Optional[str] = None
    main_product: Optional[str] = None
    avg_transaction_price: Optional[str] = None
    # Step 3
    ideal_customers: Optional[str] = None
    discovery_channels: Optional[str] = None
    main_challenge: Optional[str] = None
    # Step 4
    competitors_list: Optional[str] = None
    whatsapp_number: Optional[str] = None
    daily_update_time: Optional[str] = None
    # Registration fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    business_type: Optional[str] = None
    activity_radius_km: Optional[float] = None
    notification_whatsapp: Optional[bool] = None
    notification_email: Optional[bool] = None
    notification_weekly_report: Optional[bool] = None
    morning_alert_time: Optional[str] = None
    onboarding_completed: Optional[bool] = None
    onboarding_step: Optional[int] = None
    business_type_custom: Optional[str] = None
    priorities: Optional[str] = None  # JSON array string


@router.post("/wizard")
async def onboard_wizard(payload: OnboardWizardRequest, request: Request, auth_user_id: str = Depends(require_auth)):
    """
    Create or update a business record during onboarding.
    Called by OnboardingWizard.tsx on each step / final submit.
    Uses the user's JWT from Authorization header to pass RLS.
    """
    if payload.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    # Use service-role client for onboarding inserts (new users have no RLS access yet)
    supabase = _get_service_role_client()

    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Check if business already exists for this user
        existing = (
            supabase.table("businesses")
            .select("id")
            .eq("user_id", payload.user_id)
            .execute()
        )

        # Resolve coordinates: use frontend values or geocode the address
        lat = payload.latitude
        lng = payload.longitude
        if not lat or not lng:
            lat, lng = _geocode_address(payload.address)

        record = {
            "user_id": payload.user_id,
            "business_name": payload.business_name,
            "location": payload.address,
            "address": payload.address,
            "industry": payload.industry,
            "user_description": f"{payload.business_name} - {payload.industry}",
            "archetype": "Expert",
            "scope": "local",
            "latitude": lat or 0,
            "longitude": lng or 0,
        }

        # Add all optional fields if provided
        optional_fields = {
            "website": payload.website_url,
            "target_audience": payload.target_audience,
            "price_tier": payload.price_tier,
            "phone": payload.phone,
            "exact_address": payload.exact_address,
            "business_age": payload.business_age,
            "employee_count": payload.employee_count,
            "main_product": payload.main_product,
            "avg_transaction_price": payload.avg_transaction_price,
            "ideal_customers": payload.ideal_customers,
            "discovery_channels": payload.discovery_channels,
            "main_challenge": payload.main_challenge,
            "competitors_list": payload.competitors_list,
            "whatsapp_number": payload.whatsapp_number,
            "daily_update_time": payload.daily_update_time,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "business_type": payload.business_type,
            "activity_radius_km": payload.activity_radius_km,
            "notification_whatsapp": payload.notification_whatsapp,
            "notification_email": payload.notification_email,
            "notification_weekly_report": payload.notification_weekly_report,
            "morning_alert_time": payload.morning_alert_time,
            "onboarding_completed": payload.onboarding_completed,
            "onboarding_step": payload.onboarding_step,
            "business_type_custom": payload.business_type_custom,
            "priorities": payload.priorities,
        }
        for key, value in optional_fields.items():
            if value is not None:
                record[key] = value

        if existing and existing.data and len(existing.data) > 0:
            # Update existing record
            business_id = existing.data[0]["id"]
            supabase.table("businesses").update(record).eq("id", business_id).execute()
            logger.info(f"Updated business {business_id} for user {payload.user_id}")
        else:
            # Insert new record
            business_id = str(uuid.uuid4())
            record["id"] = business_id
            supabase.table("businesses").insert(record).execute()
            logger.info(f"Created business {business_id} for user {payload.user_id}")

        # Instant lead discovery — run synchronous Tavily search before returning
        leads_found = 0
        try:
            from services.lead_sniper import get_lead_sniper
            sniper = get_lead_sniper()
            report = sniper.sniping_mission(business_id, supabase)
            leads_found = report.leads_saved
            logger.info(f"Instant lead discovery for {business_id}: found={report.leads_found}, saved={report.leads_saved}")
        except Exception as e:
            logger.warning(f"Instant lead discovery failed (non-blocking): {e}")

        return {"success": True, "business_id": business_id, "leads_found": leads_found}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Onboard wizard failed for user {payload.user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create business")
