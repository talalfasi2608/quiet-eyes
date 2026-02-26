"""
Social Scanner — multi-platform Israeli social media scanning.

Scans Facebook, Instagram, TikTok, Twitter/X, and LinkedIn via SerpAPI
to find leads, mentions, and competitor intelligence across all major
social platforms.
"""

import os
import json
import logging
from typing import Optional
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

_instance = None

# Hebrew hashtag map by business type
HASHTAG_MAP: dict[str, list[str]] = {
    "מסעדה": ["#מסעדות", "#אוכל", "#foodie", "#מסעדהישראלית"],
    "מסעדות": ["#מסעדות", "#אוכל", "#foodie"],
    "כושר": ["#חדרכושר", "#כושר", "#fitness", "#אימון"],
    "יופי": ["#מספרה", "#ביוטי", "#עיצובשיער", "#טיפוח"],
    "ספורט": ["#ספורט", "#ציודספורט", "#כושר"],
    "קפה": ["#קפה", "#בתיקפה", "#coffee", "#קפהישראלי"],
    "מספרה": ["#מספרה", "#עיצובשיער", "#תספורת"],
    "עורך דין": ["#עורךדין", "#משפטים", "#ייעוץמשפטי"],
    "רופא": ["#רפואה", "#בריאות", "#רופא"],
    "מאפייה": ["#מאפייה", "#לחם", "#אפייה", "#מאפים"],
}


@dataclass
class SocialResult:
    """A single social media finding."""
    platform: str
    title: str
    content: str
    url: str
    hashtags: list[str] = field(default_factory=list)
    is_lead: bool = False
    is_mention: bool = False


class SocialScanner:
    """Multi-platform Israeli social media scanner."""

    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")

    def _serp_search(self, query: str, num: int = 10) -> list[dict]:
        """Run a SerpAPI Google search and return organic results."""
        if not self.serpapi_key:
            return []
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google",
                    "q": query,
                    "tbs": "qdr:m",
                    "num": num,
                    "gl": "il",
                    "hl": "iw",
                },
                timeout=15.0,
            )
            return resp.json().get("organic_results", [])
        except Exception as e:
            logger.debug(f"[SocialScanner] SerpAPI error: {e}")
            return []

    # ------------------------------------------------------------------
    # Facebook
    # ------------------------------------------------------------------

    def scan_facebook(self, business_type: str, city: str) -> list[SocialResult]:
        """Scan Facebook posts/groups for leads and mentions."""
        queries = [
            f'site:facebook.com "{business_type}" "{city}"',
            f'site:facebook.com/groups "{business_type}" "{city}"',
            f'site:facebook.com מחפש "{business_type}" {city}',
        ]
        results: list[SocialResult] = []
        for q in queries:
            for r in self._serp_search(q):
                snippet = r.get("snippet", "")
                intent_kw = ["מחפש", "צריך", "רוצה", "מישהו מכיר", "המלצה"]
                results.append(SocialResult(
                    platform="facebook",
                    title=r.get("title", ""),
                    content=snippet,
                    url=r.get("link", ""),
                    is_lead=any(kw in snippet for kw in intent_kw),
                ))
        logger.info(f"[SocialScanner] Facebook: {len(results)} results")
        return results

    # ------------------------------------------------------------------
    # Instagram
    # ------------------------------------------------------------------

    def scan_instagram(self, business_type: str, city: str) -> list[SocialResult]:
        """Scan Instagram via Google site: search with Hebrew hashtags."""
        hashtags = HASHTAG_MAP.get(business_type, [f"#{business_type}"])
        hashtags.append(f"#{city}")

        results: list[SocialResult] = []
        for tag in hashtags[:5]:
            for r in self._serp_search(f"site:instagram.com {tag} {city}", num=5):
                results.append(SocialResult(
                    platform="instagram",
                    title=r.get("title", ""),
                    content=r.get("snippet", ""),
                    url=r.get("link", ""),
                    hashtags=hashtags,
                ))
        logger.info(f"[SocialScanner] Instagram: {len(results)} results")
        return results

    # ------------------------------------------------------------------
    # TikTok
    # ------------------------------------------------------------------

    def scan_tiktok(self, business_type: str, city: str) -> list[SocialResult]:
        """Scan TikTok for trending business-related content."""
        queries = [
            f"site:tiktok.com {business_type} {city}",
            f"site:tiktok.com #{business_type}ישראל",
            f"site:tiktok.com מחפש {business_type}",
        ]
        results: list[SocialResult] = []
        for q in queries:
            for r in self._serp_search(q, num=5):
                results.append(SocialResult(
                    platform="tiktok",
                    title=r.get("title", ""),
                    content=r.get("snippet", ""),
                    url=r.get("link", ""),
                ))
        logger.info(f"[SocialScanner] TikTok: {len(results)} results")
        return results

    # ------------------------------------------------------------------
    # Twitter / X
    # ------------------------------------------------------------------

    def scan_twitter(self, business_type: str, city: str) -> list[SocialResult]:
        """Scan Twitter/X for Israeli business mentions."""
        queries = [
            f"site:twitter.com OR site:x.com {business_type} {city}",
        ]
        results: list[SocialResult] = []
        for q in queries:
            for r in self._serp_search(q, num=10):
                results.append(SocialResult(
                    platform="twitter",
                    title=r.get("title", ""),
                    content=r.get("snippet", ""),
                    url=r.get("link", ""),
                ))
        logger.info(f"[SocialScanner] Twitter: {len(results)} results")
        return results

    # ------------------------------------------------------------------
    # LinkedIn — competitor company intelligence
    # ------------------------------------------------------------------

    def scan_linkedin(self, competitor_name: str) -> dict:
        """
        Search LinkedIn for a competitor company.
        Detects hiring signals (= growth threat).
        """
        results = self._serp_search(
            f"site:linkedin.com/company {competitor_name}", num=1
        )
        if not results:
            return {}

        snippet = results[0].get("snippet", "")
        return {
            "name": competitor_name,
            "linkedin_url": results[0].get("link", ""),
            "linkedin_snippet": snippet,
            "is_growing": any(
                kw in snippet for kw in ["מגייס", "hiring", "growing", "employees"]
            ),
        }

    # ------------------------------------------------------------------
    # Full scan — all platforms
    # ------------------------------------------------------------------

    def full_social_scan(
        self, business_type: str, city: str, competitor_names: list[str] = None
    ) -> dict:
        """Run all social platform scanners and return unified results."""
        all_results: dict[str, list] = {}

        all_results["facebook"] = self.scan_facebook(business_type, city)
        all_results["instagram"] = self.scan_instagram(business_type, city)
        all_results["tiktok"] = self.scan_tiktok(business_type, city)
        all_results["twitter"] = self.scan_twitter(business_type, city)

        if competitor_names:
            linkedin_data = []
            for name in competitor_names[:5]:
                li = self.scan_linkedin(name)
                if li:
                    linkedin_data.append(li)
            all_results["linkedin"] = linkedin_data

        total = sum(
            len(v) for v in all_results.values() if isinstance(v, list)
        )
        leads = sum(
            1 for v in all_results.values()
            if isinstance(v, list)
            for item in v
            if isinstance(item, SocialResult) and item.is_lead
        )
        logger.info(
            f"[SocialScanner] Full scan: {total} results, {leads} leads across "
            f"{len(all_results)} platforms"
        )
        return all_results

    # ------------------------------------------------------------------
    # DB-integrated scan
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> dict:
        """Run full social scan for a business using DB info."""
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

        # Get competitor names
        comp_names: list[str] = []
        try:
            comps = (
                supabase.table("competitors")
                .select("name")
                .eq("business_id", business_id)
                .limit(5)
                .execute()
            )
            comp_names = [c["name"] for c in (comps.data or []) if c.get("name")]
        except Exception:
            pass

        return self.full_social_scan(industry, city, comp_names)


def get_social_scanner() -> SocialScanner:
    global _instance
    if _instance is None:
        _instance = SocialScanner()
    return _instance
