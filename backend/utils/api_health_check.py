"""
Comprehensive API health check system.

Tests 9 external APIs in parallel and returns their status.
Each check returns a dict with: name, status, response_time_ms, error, details.
"""

import asyncio
import os
import time

import httpx


# ---------------------------------------------------------------------------
# 1. Supabase
# ---------------------------------------------------------------------------
async def check_supabase() -> dict:
    name = "Supabase"
    start = time.time()
    try:
        from config import supabase

        if supabase is None:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "Supabase client is None",
            }

        result = await asyncio.to_thread(
            lambda: supabase.table("businesses").select("id").limit(1).execute()
        )

        return {
            "name": name,
            "status": "ok",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": None,
            "details": "Connected",
        }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 2. Anthropic Claude
# ---------------------------------------------------------------------------
async def check_anthropic() -> dict:
    name = "Anthropic Claude"
    start = time.time()
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "ANTHROPIC_API_KEY not set",
            }

        from services.claude_client import analyze

        result = await asyncio.to_thread(analyze, "Say OK", max_tokens=10)

        return {
            "name": name,
            "status": "ok",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": None,
            "details": f"Response received: {str(result)[:80]}",
        }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 3. Tavily
# ---------------------------------------------------------------------------
async def check_tavily() -> dict:
    name = "Tavily"
    start = time.time()
    try:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "TAVILY_API_KEY not set",
            }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": "restaurant tel aviv",
                    "max_results": 1,
                    "search_depth": "basic",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])

        return {
            "name": name,
            "status": "ok",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": None,
            "details": f"{len(results)} results",
        }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 4. Apify
# ---------------------------------------------------------------------------
async def check_apify() -> dict:
    name = "Apify"
    start = time.time()
    try:
        token = os.getenv("APIFY_API_KEY") or os.getenv("APIFY_TOKEN")
        if not token:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "APIFY_API_KEY / APIFY_TOKEN not set",
            }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.apify.com/v2/acts?token={token}&limit=1"
            )
            resp.raise_for_status()

        return {
            "name": name,
            "status": "ok",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": None,
            "details": "Authenticated successfully",
        }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 5. SerpAPI
# ---------------------------------------------------------------------------
async def check_serpapi() -> dict:
    name = "SerpAPI"
    start = time.time()
    try:
        api_key = os.getenv("SERPAPI_KEY") or os.getenv("SERPAPI_API_KEY")
        if not api_key:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "SERPAPI_KEY / SERPAPI_API_KEY not set",
            }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://serpapi.com/account.json?api_key={api_key}"
            )
            resp.raise_for_status()
            data = resp.json()

        return {
            "name": name,
            "status": "ok",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": None,
            "details": f"Account: {data.get('plan_name', 'unknown')} — "
                       f"Searches this month: {data.get('this_month_usage', 'N/A')}",
        }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 6. Google Places
# ---------------------------------------------------------------------------
async def check_google_places() -> dict:
    name = "Google Places"
    start = time.time()
    try:
        api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "GOOGLE_PLACES_API_KEY / GOOGLE_API_KEY not set",
            }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": "32.0853,34.7818",
                    "radius": 500,
                    "type": "restaurant",
                    "key": api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") == "OK":
            return {
                "name": name,
                "status": "ok",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": f"Found {len(data.get('results', []))} places",
            }
        else:
            return {
                "name": name,
                "status": "error",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": f"Google API status: {data.get('status')}",
                "details": data.get("error_message"),
            }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 7. Google Maps / Geocoding
# ---------------------------------------------------------------------------
async def check_google_maps() -> dict:
    name = "Google Maps / Geocoding"
    start = time.time()
    try:
        api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "GOOGLE_PLACES_API_KEY / GOOGLE_API_KEY not set",
            }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": "Tel Aviv Israel",
                    "key": api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("results"):
            return {
                "name": name,
                "status": "ok",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": f"Geocoded: {data['results'][0].get('formatted_address', '')}",
            }
        else:
            return {
                "name": name,
                "status": "error",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": f"Google Geocoding status: {data.get('status')}",
                "details": data.get("error_message"),
            }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 8. Twilio WhatsApp
# ---------------------------------------------------------------------------
async def check_twilio() -> dict:
    name = "Twilio WhatsApp"
    start = time.time()
    try:
        sid = os.getenv("TWILIO_ACCOUNT_SID")
        token = os.getenv("TWILIO_AUTH_TOKEN")
        if not sid or not token:
            return {
                "name": name,
                "status": "not_configured",
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set",
            }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json",
                auth=(sid, token),
            )
            resp.raise_for_status()
            data = resp.json()

        return {
            "name": name,
            "status": "ok",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": None,
            "details": f"Account: {data.get('friendly_name', 'N/A')}",
        }
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": None,
        }


# ---------------------------------------------------------------------------
# 9. HubSpot (OPTIONAL — does not count as failure)
# ---------------------------------------------------------------------------
async def check_hubspot() -> dict:
    name = "HubSpot"
    start = time.time()
    try:
        token = os.getenv("HUBSPOT_API_KEY") or os.getenv("HUBSPOT_ACCESS_TOKEN")
        if not token:
            return {
                "name": name,
                "status": "not_configured",
                "optional": True,
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "אופציונלי — HUBSPOT_ACCESS_TOKEN לא מוגדר",
            }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
                headers={"Authorization": f"Bearer {token}"},
            )

        if resp.status_code == 200:
            return {
                "name": name,
                "status": "ok",
                "optional": True,
                "response_time_ms": round((time.time() - start) * 1000),
                "error": None,
                "details": "Authenticated successfully",
            }
        elif resp.status_code == 401:
            return {
                "name": name,
                "status": "not_configured",
                "optional": True,
                "response_time_ms": round((time.time() - start) * 1000),
                "error": "Invalid token",
                "details": "אופציונלי — טוקן לא תקין",
            }
        else:
            return {
                "name": name,
                "status": "not_configured",
                "optional": True,
                "response_time_ms": round((time.time() - start) * 1000),
                "error": f"HTTP {resp.status_code}",
                "details": "אופציונלי — שגיאת חיבור",
            }
    except Exception as e:
        return {
            "name": name,
            "status": "not_configured",
            "optional": True,
            "response_time_ms": round((time.time() - start) * 1000),
            "error": str(e),
            "details": "אופציונלי — שגיאת חיבור",
        }


# ---------------------------------------------------------------------------
# Main: run all checks in parallel
# ---------------------------------------------------------------------------
async def run_all_checks() -> list[dict]:
    """Run all API health checks in parallel and return results."""
    checks = [
        check_supabase(),
        check_anthropic(),
        check_tavily(),
        check_apify(),
        check_serpapi(),
        check_google_places(),
        check_google_maps(),
        check_twilio(),
        check_hubspot(),
    ]
    results = await asyncio.gather(*checks, return_exceptions=True)

    final = []
    for r in results:
        if isinstance(r, Exception):
            final.append({
                "name": "Unknown",
                "status": "error",
                "response_time_ms": 0,
                "error": str(r),
                "details": None,
            })
        else:
            final.append(r)
    return final
