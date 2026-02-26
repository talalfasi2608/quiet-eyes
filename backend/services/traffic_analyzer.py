"""
Traffic Analyzer — Google Popular Times & foot traffic comparison.

Uses the populartimes library (wraps Google Places) to get busy-hours data
for a business and its competitors, then generates comparative insights.
"""

import os
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_instance = None


class TrafficAnalyzer:
    """Analyzes foot traffic patterns via Google Popular Times data."""

    def __init__(self):
        self.google_key = (
            os.getenv("GOOGLE_PLACES_API_KEY")
            or os.getenv("GOOGLE_API_KEY", "")
        )

    # ------------------------------------------------------------------
    # Core: get popular times for a single place
    # ------------------------------------------------------------------

    def get_popular_times(self, place_id: str) -> dict:
        """
        Get popular-times (busy hours) data for a Google Place.

        Uses the populartimes library which reverse-engineers the data
        from the Google Places web interface.  Falls back to a basic
        Place Details call if the library is unavailable.
        """
        if not self.google_key or not place_id:
            return {}

        # Try populartimes library first (richer data)
        try:
            import populartimes
            data = populartimes.get_id(self.google_key, place_id)
            if not data:
                return self._fallback_place_details(place_id)

            busy_hours: dict[str, dict] = {}
            for day_data in data.get("populartimes", []):
                day = day_data["name"]
                hours = day_data["data"]  # list of 24 values 0-100
                peak_idx = hours.index(max(hours)) if hours else 12
                busy_hours[day] = {
                    "peak_hour": peak_idx,
                    "peak_value": max(hours) if hours else 0,
                    "hourly_data": hours,
                }

            return {
                "place_id": place_id,
                "name": data.get("name", ""),
                "busy_hours": busy_hours,
                "current_popularity": data.get("current_popularity", 0),
                "time_spent": data.get("time_spent", []),
            }

        except ImportError:
            logger.debug("[TrafficAnalyzer] populartimes not installed, using fallback")
            return self._fallback_place_details(place_id)
        except Exception as e:
            logger.error(f"[TrafficAnalyzer] populartimes error: {e}")
            return self._fallback_place_details(place_id)

    def _fallback_place_details(self, place_id: str) -> dict:
        """Minimal traffic info from Google Place Details."""
        try:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "name,opening_hours,rating,user_ratings_total,business_status,price_level",
                    "key": self.google_key,
                    "language": "he",
                },
                timeout=10.0,
            )
            result = resp.json().get("result", {})
            return {
                "place_id": place_id,
                "name": result.get("name", ""),
                "rating": result.get("rating"),
                "reviews_count": result.get("user_ratings_total"),
                "business_status": result.get("business_status"),
                "price_level": result.get("price_level"),
                "busy_hours": {},
            }
        except Exception as e:
            logger.error(f"[TrafficAnalyzer] fallback place details error: {e}")
            return {"place_id": place_id, "busy_hours": {}}

    # ------------------------------------------------------------------
    # Compare traffic: my business vs competitors
    # ------------------------------------------------------------------

    def compare_traffic(
        self,
        my_place_id: str,
        competitor_place_ids: list[str],
    ) -> dict:
        """
        Compare foot traffic between the user's business and up to 5
        competitors.  Returns traffic data + opportunity insights.
        """
        my_traffic = self.get_popular_times(my_place_id) if my_place_id else {}
        comp_traffic = []

        for pid in competitor_place_ids[:5]:
            t = self.get_popular_times(pid)
            if t:
                comp_traffic.append(t)

        # Find when competitors are LEAST busy (= opportunity windows)
        insights: list[dict] = []
        for comp in comp_traffic:
            comp_name = comp.get("name", "מתחרה")
            for day, data in comp.get("busy_hours", {}).items():
                peak_val = data.get("peak_value", 50)
                if peak_val < 30:
                    insights.append({
                        "competitor": comp_name,
                        "day": day,
                        "insight": f"המתחרה {comp_name} פחות עמוס ב{day}",
                        "opportunity": "הגבר פרסום ביום זה",
                    })

        return {
            "my_traffic": my_traffic,
            "competitor_traffic": comp_traffic,
            "insights": insights,
        }

    # ------------------------------------------------------------------
    # Run for a business (DB integration)
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> dict:
        """
        Full traffic scan for a business: own place + competitors.
        Saves results to traffic_data table.
        """
        try:
            biz = (
                supabase.table("businesses")
                .select("business_name, google_place_id, latitude, longitude")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return {"error": "Business not found"}
        except Exception as e:
            return {"error": str(e)}

        my_place_id = biz.data.get("google_place_id", "")

        # Get competitor place_ids
        comp_place_ids: list[str] = []
        try:
            comps = (
                supabase.table("competitors")
                .select("place_id")
                .eq("business_id", business_id)
                .limit(5)
                .execute()
            )
            comp_place_ids = [
                c["place_id"] for c in (comps.data or []) if c.get("place_id")
            ]
        except Exception:
            pass

        result = self.compare_traffic(my_place_id, comp_place_ids)

        # Persist to traffic_data table
        try:
            supabase.table("traffic_data").insert({
                "business_id": business_id,
                "place_id": my_place_id,
                "busy_hours": json.dumps(
                    result.get("my_traffic", {}).get("busy_hours", {}),
                    ensure_ascii=False,
                ),
                "competitor_comparison": json.dumps(
                    {
                        "competitors": [
                            {"name": c.get("name"), "busy_hours": c.get("busy_hours", {})}
                            for c in result.get("competitor_traffic", [])
                        ],
                        "insights": result.get("insights", []),
                    },
                    ensure_ascii=False,
                ),
            }).execute()
        except Exception as e:
            logger.debug(f"[TrafficAnalyzer] DB save error: {e}")

        logger.info(
            f"[TrafficAnalyzer] Scanned {business_id}: "
            f"{len(comp_place_ids)} competitors, {len(result.get('insights', []))} insights"
        )
        return result


def get_traffic_analyzer() -> TrafficAnalyzer:
    global _instance
    if _instance is None:
        _instance = TrafficAnalyzer()
    return _instance
