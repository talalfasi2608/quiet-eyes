"""
Event Scanner — holidays, local events, and weather impact analysis.

Tracks Jewish holidays (with correct 2026 Hebrew-calendar dates),
discovers local city events via SerpAPI, and fetches 7-day weather
forecasts from Open-Meteo to predict foot-traffic impact.
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from data.cities import get_city_config

logger = logging.getLogger(__name__)

_instance = None

# =============================================================================
# JEWISH HOLIDAYS 2026 (Hebrew calendar → Gregorian, manually verified)
# =============================================================================

JEWISH_HOLIDAYS = [
    {"name": "טו בשבט", "date": "2026-02-04", "impact": "low", "type": "holiday"},
    {"name": "פורים", "date": "2026-03-05", "impact": "high", "type": "holiday"},
    {"name": "פסח", "date": "2026-04-01", "impact": "very_high", "type": "holiday"},
    {"name": "יום השואה", "date": "2026-04-14", "impact": "medium", "type": "memorial"},
    {"name": "יום הזיכרון", "date": "2026-04-21", "impact": "medium", "type": "memorial"},
    {"name": "יום העצמאות", "date": "2026-04-22", "impact": "high", "type": "national"},
    {"name": "ל\"ג בעומר", "date": "2026-05-07", "impact": "medium", "type": "holiday"},
    {"name": "שבועות", "date": "2026-05-22", "impact": "medium", "type": "holiday"},
    {"name": "ט' באב", "date": "2026-07-22", "impact": "medium", "type": "fast"},
    {"name": "ראש השנה", "date": "2026-09-12", "impact": "very_high", "type": "holiday"},
    {"name": "יום כיפור", "date": "2026-09-21", "impact": "very_high", "type": "holiday"},
    {"name": "סוכות", "date": "2026-09-26", "impact": "high", "type": "holiday"},
    {"name": "שמחת תורה", "date": "2026-10-03", "impact": "high", "type": "holiday"},
    {"name": "חנוכה", "date": "2026-12-05", "impact": "high", "type": "holiday"},
]


class EventScanner:
    """Scans for holidays, local events, and weather to predict business impact."""

    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")

    # ------------------------------------------------------------------
    # Upcoming Jewish holidays
    # ------------------------------------------------------------------

    def get_upcoming_holidays(self, days_ahead: int = 30) -> list[dict]:
        """Return Jewish holidays within the next N days."""
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days_ahead)
        upcoming: list[dict] = []

        for h in JEWISH_HOLIDAYS:
            try:
                hdate = datetime.strptime(h["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if now <= hdate <= cutoff:
                    days_until = (hdate - now).days
                    upcoming.append({
                        **h,
                        "days_until": days_until,
                    })
            except ValueError:
                continue

        return upcoming

    # ------------------------------------------------------------------
    # Local city events (SerpAPI)
    # ------------------------------------------------------------------

    def scan_city_events(self, city: str) -> list[dict]:
        """Search for upcoming local events in a city."""
        if not self.serpapi_key:
            return []

        events: list[dict] = []

        # Google Events engine
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google_events",
                    "q": f"events in {city} Israel",
                    "hl": "iw",
                },
                timeout=15.0,
            )
            data = resp.json()
            for event in data.get("events_results", [])[:10]:
                date_info = event.get("date", {})
                events.append({
                    "name": event.get("title", ""),
                    "date": date_info.get("start_date", ""),
                    "venue": event.get("venue", {}).get("name", ""),
                    "type": "local_event",
                    "city": city,
                    "link": event.get("link", ""),
                })
        except Exception as e:
            logger.debug(f"[EventScanner] Google Events error: {e}")

        # Fallback: regular search for events
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google",
                    "q": f"אירועים {city} 2026",
                    "tbs": "qdr:m",
                    "num": 10,
                    "gl": "il",
                    "hl": "iw",
                },
                timeout=15.0,
            )
            data = resp.json()
            for r in data.get("organic_results", [])[:5]:
                events.append({
                    "name": r.get("title", ""),
                    "date": r.get("date", ""),
                    "venue": "",
                    "type": "web_mention",
                    "city": city,
                    "link": r.get("link", ""),
                })
        except Exception as e:
            logger.debug(f"[EventScanner] Events search error: {e}")

        logger.info(f"[EventScanner] Found {len(events)} events in {city}")
        return events

    # ------------------------------------------------------------------
    # Weather forecast (Open-Meteo — free, no API key)
    # ------------------------------------------------------------------

    def get_weather_forecast(self, city: str) -> dict:
        """
        7-day weather forecast from Open-Meteo.
        Uses city config for lat/lng.
        """
        config = get_city_config(city)
        lat = config.get("lat")
        lng = config.get("lng")

        if not lat or not lng:
            return {"forecast": [], "alert": None}

        try:
            resp = httpx.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
                    "timezone": "Asia/Jerusalem",
                    "forecast_days": 7,
                },
                timeout=10.0,
            )
            data = resp.json()
        except Exception as e:
            logger.error(f"[EventScanner] Weather API error: {e}")
            return {"forecast": [], "alert": None}

        daily = data.get("daily", {})
        times = daily.get("time", [])
        rain_list = daily.get("precipitation_sum", [])
        temp_max_list = daily.get("temperature_2m_max", [])
        temp_min_list = daily.get("temperature_2m_min", [])

        forecast: list[dict] = []
        for i in range(min(7, len(times))):
            rain = rain_list[i] if i < len(rain_list) else 0
            temp_max = temp_max_list[i] if i < len(temp_max_list) else 25
            temp_min = temp_min_list[i] if i < len(temp_min_list) else 15

            will_rain = rain > 2
            if rain > 5:
                impact = "negative"
            elif temp_max > 35:
                impact = "negative"
            elif temp_max > 25:
                impact = "positive"
            else:
                impact = "neutral"

            forecast.append({
                "date": times[i],
                "rain_mm": rain,
                "temp_max": temp_max,
                "temp_min": temp_min,
                "will_rain": will_rain,
                "impact": impact,
            })

        # Generate alert
        rainy_days = [f for f in forecast if f["will_rain"]]
        hot_days = [f for f in forecast if f.get("temp_max", 0) > 35]
        alert = None
        if rainy_days:
            alert = f"⛈️ גשם צפוי ב-{len(rainy_days)} ימים הקרובים — שקול קמפיין דיגיטלי"
        elif hot_days:
            alert = f"🌡️ חם מאוד ב-{len(hot_days)} ימים — צפי לירידה בתנועה רגלית"

        logger.info(f"[EventScanner] Weather: {len(forecast)} days, alert={alert is not None}")
        return {"forecast": forecast, "alert": alert}

    # ------------------------------------------------------------------
    # Full scan for a business
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> dict:
        """Full event + weather scan for a business."""
        try:
            biz = (
                supabase.table("businesses")
                .select("location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return {"error": "Business not found"}
        except Exception as e:
            return {"error": str(e)}

        city = biz.data.get("location", "")

        holidays = self.get_upcoming_holidays(days_ahead=30)
        events = self.scan_city_events(city)
        weather = self.get_weather_forecast(city)

        # Save weather to DB
        for day in weather.get("forecast", []):
            try:
                supabase.table("weather_forecasts").insert({
                    "business_id": business_id,
                    "forecast_date": day["date"],
                    "rain_mm": day["rain_mm"],
                    "temperature": day["temp_max"],
                    "business_impact": day["impact"],
                }).execute()
            except Exception as e:
                logger.debug(f"[EventScanner] Weather DB save error: {e}")

        return {
            "holidays": holidays,
            "events": events,
            "weather": weather,
        }


def get_event_scanner() -> EventScanner:
    global _instance
    if _instance is None:
        _instance = EventScanner()
    return _instance
