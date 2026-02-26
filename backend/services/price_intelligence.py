"""
Price Intelligence — competitor price tracking and analysis.

Discovers competitor pricing via Google Places price_level, web mentions
of prices (₪ amounts), and generates AI-powered pricing insights.
"""

import os
import re
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_instance = None

# Regex patterns for Israeli price mentions
PRICE_PATTERNS = [
    r"₪\s?[\d,]+",            # ₪120 or ₪ 120
    r"[\d,]+\s?₪",            # 120₪ or 120 ₪
    r"[\d,]+\s?שקל",          # 120 שקל
    r"[\d,]+\s?ש\"ח",         # 120 ש"ח
    r"[\d,]+\s?שקלים",        # 120 שקלים
    r"מחיר[:\s]+[\d,]+",      # מחיר: 120
]

PRICE_LEVEL_LABELS = ["חינם", "זול", "בינוני", "יקר", "יקר מאוד"]


class PriceIntelligence:
    """Tracks and analyzes competitor pricing."""

    def __init__(self):
        self.google_key = (
            os.getenv("GOOGLE_PLACES_API_KEY")
            or os.getenv("GOOGLE_API_KEY", "")
        )
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")
        self.has_claude = bool(os.getenv("ANTHROPIC_API_KEY", ""))

    def _serp_search(self, query: str, num: int = 10) -> list[dict]:
        if not self.serpapi_key:
            return []
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google",
                    "q": query,
                    "tbs": "qdr:3m",  # last 3 months for price data
                    "num": num,
                    "gl": "il",
                    "hl": "iw",
                },
                timeout=15.0,
            )
            return resp.json().get("organic_results", [])
        except Exception as e:
            logger.debug(f"[PriceIntel] SerpAPI error: {e}")
            return []

    def _extract_prices(self, text: str) -> list[str]:
        """Extract price mentions from text using regex patterns."""
        mentions: list[str] = []
        for pattern in PRICE_PATTERNS:
            mentions.extend(re.findall(pattern, text))
        return mentions

    # ------------------------------------------------------------------
    # Google Places price level
    # ------------------------------------------------------------------

    def get_place_price_level(self, place_id: str) -> Optional[dict]:
        """Get price_level from Google Place Details."""
        if not self.google_key or not place_id:
            return None
        try:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "name,price_level,opening_hours",
                    "key": self.google_key,
                    "language": "he",
                },
                timeout=10.0,
            )
            result = resp.json().get("result", {})
            level = result.get("price_level")
            if level is not None:
                return {
                    "source": "google",
                    "price_level": level,
                    "label": PRICE_LEVEL_LABELS[min(level, 4)],
                }
        except Exception as e:
            logger.debug(f"[PriceIntel] Place details error: {e}")
        return None

    # ------------------------------------------------------------------
    # Web price mentions search
    # ------------------------------------------------------------------

    def search_price_mentions(self, competitor_name: str, city: str) -> list[dict]:
        """Search the web for price mentions of a competitor."""
        query = f'"{competitor_name}" {city} מחיר OR מחירון OR עלות OR ₪'
        results = self._serp_search(query, num=5)

        price_data: list[dict] = []
        for r in results:
            snippet = r.get("snippet", "")
            mentions = self._extract_prices(snippet)
            if mentions:
                price_data.append({
                    "source": "web",
                    "url": r.get("link", ""),
                    "mentions": mentions,
                    "context": snippet[:200],
                })
        return price_data

    # ------------------------------------------------------------------
    # Full competitor price scan
    # ------------------------------------------------------------------

    def scan_competitor_prices(
        self, business_type: str, city: str, competitors: list[dict]
    ) -> dict:
        """
        Scan pricing for all competitors.
        Each competitor dict should have: name, place_id (optional).
        """
        price_data: list[dict] = []

        for comp in competitors[:10]:
            comp_name = comp.get("name", "")
            place_id = comp.get("place_id", "")
            prices: list[dict] = []

            # 1. Google Places price level
            if place_id:
                google_price = self.get_place_price_level(place_id)
                if google_price:
                    prices.append(google_price)

            # 2. Web price mentions
            web_prices = self.search_price_mentions(comp_name, city)
            prices.extend(web_prices)

            if prices:
                price_data.append({
                    "competitor": comp_name,
                    "prices": prices,
                })

        # Generate AI insight
        insight = ""
        if price_data and self.has_claude:
            try:
                from services.claude_client import analyze
                prompt = (
                    f"נתוני מחירים של מתחרים ב{city} בתחום {business_type}:\n"
                    f"{json.dumps(price_data, ensure_ascii=False)}\n\n"
                    "נתח את המחירים והחזר JSON בלבד:\n"
                    '{"summary": "סיכום קצר בעברית", '
                    '"price_position": "זול|בינוני|יקר", '
                    '"recommendation": "המלצה קצרה"}'
                )
                insight = analyze(prompt, max_tokens=300, temperature=0.3)
            except Exception as e:
                logger.debug(f"[PriceIntel] Claude error: {e}")

        logger.info(
            f"[PriceIntel] Scanned {len(competitors)} competitors, "
            f"{len(price_data)} with price data"
        )
        return {"price_data": price_data, "insight": insight}

    # ------------------------------------------------------------------
    # DB-integrated scan
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> dict:
        """Full price intelligence scan for a business."""
        try:
            biz = (
                supabase.table("businesses")
                .select("industry, location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return {"error": "Business not found"}
        except Exception as e:
            return {"error": str(e)}

        industry = biz.data.get("industry", "")
        city = biz.data.get("location", "")

        # Get competitors
        competitors: list[dict] = []
        try:
            comps = (
                supabase.table("competitors")
                .select("name, place_id")
                .eq("business_id", business_id)
                .limit(10)
                .execute()
            )
            competitors = comps.data or []
        except Exception:
            pass

        result = self.scan_competitor_prices(industry, city, competitors)

        # Save to price_intelligence table
        for pd in result.get("price_data", []):
            try:
                supabase.table("price_intelligence").insert({
                    "business_id": business_id,
                    "competitor_name": pd.get("competitor", ""),
                    "price_level": next(
                        (p["price_level"] for p in pd["prices"] if "price_level" in p),
                        None,
                    ),
                    "price_mentions": json.dumps(pd["prices"], ensure_ascii=False),
                    "ai_insight": result.get("insight", ""),
                }).execute()
            except Exception as e:
                logger.debug(f"[PriceIntel] DB save error: {e}")

        return result


def get_price_intelligence() -> PriceIntelligence:
    global _instance
    if _instance is None:
        _instance = PriceIntelligence()
    return _instance
