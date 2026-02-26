"""
Reputation Scanner — unified online reputation monitoring.

Scans Google Reviews, Wolt, 10bis, Zap, TripAdvisor, and general web
mentions to build a complete reputation profile and AI-generated score.
"""

import os
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_instance = None

# Platforms to scan (site: prefix for SerpAPI)
PLATFORM_SITES = {
    "wolt": "site:wolt.com",
    "ten_bis": "site:10bis.co.il",
    "zap": "site:zap.co.il",
    "tripadvisor": "site:tripadvisor.co.il OR site:tripadvisor.com",
    "booking": "site:booking.com",
    "rest": "site:rest.co.il",
}


class ReputationScanner:
    """Monitors business reputation across all Israeli platforms."""

    def __init__(self):
        self.google_key = (
            os.getenv("GOOGLE_PLACES_API_KEY")
            or os.getenv("GOOGLE_API_KEY", "")
        )
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")
        self.has_claude = bool(os.getenv("ANTHROPIC_API_KEY", ""))

    def _serp_search(self, query: str, num: int = 5) -> list[dict]:
        if not self.serpapi_key:
            return []
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google",
                    "q": query,
                    "num": num,
                    "gl": "il",
                    "hl": "iw",
                },
                timeout=15.0,
            )
            return resp.json().get("organic_results", [])
        except Exception as e:
            logger.debug(f"[ReputationScanner] SerpAPI error: {e}")
            return []

    # ------------------------------------------------------------------
    # Google Reviews
    # ------------------------------------------------------------------

    def get_google_reviews(self, business_name: str, city: str, place_id: str = "") -> dict:
        """Get Google rating and review highlights."""
        if place_id and self.google_key:
            try:
                resp = httpx.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={
                        "place_id": place_id,
                        "fields": "name,rating,user_ratings_total,reviews",
                        "key": self.google_key,
                        "language": "he",
                        "reviews_sort": "newest",
                    },
                    timeout=10.0,
                )
                result = resp.json().get("result", {})
                reviews = result.get("reviews", [])
                return {
                    "platform": "google",
                    "rating": result.get("rating"),
                    "review_count": result.get("user_ratings_total"),
                    "recent_reviews": [
                        {
                            "rating": r.get("rating"),
                            "text": r.get("text", "")[:200],
                            "time": r.get("relative_time_description", ""),
                        }
                        for r in reviews[:5]
                    ],
                }
            except Exception as e:
                logger.debug(f"[ReputationScanner] Google Reviews error: {e}")

        # Fallback: search for reviews
        results = self._serp_search(f'"{business_name}" {city} ביקורות OR דירוג', num=3)
        return {
            "platform": "google",
            "rating": None,
            "review_count": None,
            "web_mentions": [
                {"title": r.get("title", ""), "snippet": r.get("snippet", "")}
                for r in results
            ],
        }

    # ------------------------------------------------------------------
    # Platform-specific scanning
    # ------------------------------------------------------------------

    def scan_platform(self, platform: str, business_name: str, city: str) -> Optional[dict]:
        """Search a specific platform for the business."""
        site_query = PLATFORM_SITES.get(platform, "")
        if not site_query:
            return None

        results = self._serp_search(f"{site_query} {business_name} {city}", num=3)
        if not results:
            return None

        return {
            "platform": platform,
            "found": True,
            "results": [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("snippet", ""),
                    "url": r.get("link", ""),
                }
                for r in results
            ],
        }

    # ------------------------------------------------------------------
    # General web mentions
    # ------------------------------------------------------------------

    def scan_web_mentions(self, business_name: str, city: str) -> list[dict]:
        """Search for general web mentions of the business."""
        results = self._serp_search(f'"{business_name}" {city}', num=10)
        return [
            {
                "title": r.get("title", ""),
                "snippet": r.get("snippet", ""),
                "url": r.get("link", ""),
            }
            for r in results
        ]

    # ------------------------------------------------------------------
    # Full reputation scan
    # ------------------------------------------------------------------

    def full_reputation_scan(
        self,
        business_name: str,
        city: str,
        place_id: str = "",
    ) -> dict:
        """Run a complete reputation scan across all platforms."""
        reputation: dict = {
            "google": None,
            "platforms": {},
            "mentions": [],
            "ai_score": None,
        }

        # Google Reviews
        reputation["google"] = self.get_google_reviews(business_name, city, place_id)

        # Platform scans
        for platform in PLATFORM_SITES:
            result = self.scan_platform(platform, business_name, city)
            if result:
                reputation["platforms"][platform] = result

        # General web mentions
        reputation["mentions"] = self.scan_web_mentions(business_name, city)

        # AI reputation analysis
        if self.has_claude:
            try:
                from services.claude_client import analyze

                # Build summary for AI (keep token count reasonable)
                google_data = reputation["google"] or {}
                platform_summary = {
                    k: {"found": v.get("found")} for k, v in reputation["platforms"].items()
                }
                mention_count = len(reputation["mentions"])

                prompt = (
                    f"נתח את המוניטין של {business_name} ב{city}:\n"
                    f"- דירוג גוגל: {google_data.get('rating', 'N/A')}\n"
                    f"- מספר ביקורות: {google_data.get('review_count', 'N/A')}\n"
                    f"- פלטפורמות שנמצא בהן: {list(platform_summary.keys())}\n"
                    f"- אזכורים באינטרנט: {mention_count}\n\n"
                    "החזר JSON בלבד:\n"
                    '{"score": 0-100, "strengths": ["..."], '
                    '"weaknesses": ["..."], "recommendation": "המלצה קצרה"}'
                )
                raw = analyze(prompt, max_tokens=400, temperature=0.3)
                # Try to parse JSON
                raw = raw.strip()
                if "```" in raw:
                    parts = raw.split("```")
                    for part in parts:
                        clean = part.strip()
                        if clean.startswith("json"):
                            clean = clean[4:].strip()
                        if clean.startswith("{"):
                            raw = clean
                            break
                reputation["ai_score"] = json.loads(raw)
            except Exception as e:
                logger.debug(f"[ReputationScanner] AI analysis error: {e}")

        platform_count = len(reputation["platforms"])
        logger.info(
            f"[ReputationScanner] {business_name}: "
            f"Google={reputation['google'] is not None}, "
            f"platforms={platform_count}, "
            f"mentions={len(reputation['mentions'])}"
        )
        return reputation

    # ------------------------------------------------------------------
    # DB-integrated scan
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> dict:
        """Full reputation scan for a business."""
        try:
            biz = (
                supabase.table("businesses")
                .select("business_name, location, google_place_id")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return {"error": "Business not found"}
        except Exception as e:
            return {"error": str(e)}

        name = biz.data.get("business_name", "")
        city = biz.data.get("location", "")
        place_id = biz.data.get("google_place_id", "")

        result = self.full_reputation_scan(name, city, place_id)

        # Save to reputation_scores table
        google_data = result.get("google") or {}
        ai_score = result.get("ai_score") or {}
        try:
            supabase.table("reputation_scores").insert({
                "business_id": business_id,
                "platform": "aggregate",
                "score": ai_score.get("score"),
                "review_count": google_data.get("review_count"),
                "data": json.dumps(result, ensure_ascii=False, default=str),
            }).execute()
        except Exception as e:
            logger.debug(f"[ReputationScanner] DB save error: {e}")

        return result


def get_reputation_scanner() -> ReputationScanner:
    global _instance
    if _instance is None:
        _instance = ReputationScanner()
    return _instance
