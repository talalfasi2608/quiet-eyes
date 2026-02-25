"""
Lead Sniper Service for Quiet Eyes.

Multi-source lead discovery: searches across Google, Facebook, Israeli forums,
Google Maps reviews (competitor complaints), and general web via Tavily.
Uses AI (Claude) to qualify results and extract real buying intent.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from typing import Optional

import httpx

from services.claude_client import chat as claude_chat

logger = logging.getLogger(__name__)

_MONTH_HEB = {
    1: "ינואר", 2: "פברואר", 3: "מרץ", 4: "אפריל",
    5: "מאי", 6: "יוני", 7: "יולי", 8: "אוגוסט",
    9: "ספטמבר", 10: "אוקטובר", 11: "נובמבר", 12: "דצמבר",
}

HIGH_INTENT_KEYWORDS = [
    "מחפש", "צריך", "רוצה", "איפה אפשר", "מישהו יכול",
    "מישהו מכיר", "המלצה", "ממליצים", "עזרה", "טיפ",
]


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class RawResult:
    """Unified search result from any source."""
    title: str
    content: str
    source_url: str
    source_platform: str
    search_query: str
    published_date: str = ""
    raw_score: float = 0.5
    lead_type: str = ""  # e.g. 'unhappy_competitor_customer'


@dataclass
class DiscoveredLead:
    platform: str
    summary: str
    source_url: str
    original_text: str
    search_query: str
    relevance_score: float = 0.80
    intent_signals: dict = field(default_factory=dict)
    published_date: Optional[str] = None

    def to_db_row(self, business_id: str) -> dict:
        row = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": self.platform,
            "summary": self.summary,
            "source_url": self.source_url,
            "original_text": self.original_text,
            "search_query": self.search_query,
            "relevance_score": self.relevance_score,
            "status": "new",
        }
        if self.intent_signals:
            row["intent_signals"] = json.dumps(self.intent_signals, ensure_ascii=False)
        # published_date column may not exist yet — handled gracefully in save
        return row


@dataclass
class SnipingReport:
    business_id: str
    total_results_scanned: int = 0
    leads_found: int = 0
    leads_saved: int = 0
    queries_executed: list = field(default_factory=list)
    leads: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    source_counts: dict = field(default_factory=dict)


# =============================================================================
# HELPERS
# =============================================================================

def _detect_platform(url: str) -> str:
    u = url.lower()
    if "facebook.com" in u:
        return "facebook"
    if "instagram.com" in u:
        return "instagram"
    if "tiktok.com" in u:
        return "tiktok"
    if "google.com/maps" in u or "maps.google" in u:
        return "google_maps"
    if "tapuz.co.il" in u:
        return "forum"
    if "mako.co.il" in u:
        return "forum"
    if "homeless.co.il" in u:
        return "forum"
    if "forums.co.il" in u:
        return "forum"
    if "reddit.com" in u:
        return "reddit"
    if "twitter.com" in u or "x.com" in u:
        return "twitter"
    if "ynet.co.il" in u or "walla.co.il" in u:
        return "news"
    return "web"


def _is_valid_lead_url(url: str) -> bool:
    if not url or not url.strip():
        return False
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        return False
    fake_patterns = [
        "/invalid-page", "/fake", "/example",
        "ABC123", "12345/posts/67890", "placeholder", "lorem",
    ]
    for pat in fake_patterns:
        if pat in url:
            return False
    return True


def _filter_recent(results: list[RawResult], max_age_days: int = 30) -> list[RawResult]:
    """Hard filter: only keep results published within max_age_days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    fresh = []
    for r in results:
        if not r.published_date:
            fresh.append(r)  # unknown date = keep
            continue
        try:
            pub_date = datetime.fromisoformat(r.published_date.replace("Z", "+00:00"))
            if pub_date >= cutoff:
                fresh.append(r)
            else:
                logger.debug(f"Skipped old result ({r.published_date}): {r.title[:50]}")
        except (ValueError, TypeError):
            fresh.append(r)
    return fresh


def _extract_date_from_serp(result: dict) -> str:
    """Extract published date from SerpAPI result."""
    # SerpAPI sometimes includes date in snippet or rich_snippet
    date_str = result.get("date", "")
    if date_str:
        return date_str
    # Check rich snippet
    rich = result.get("rich_snippet", {})
    if isinstance(rich, dict):
        top = rich.get("top", {})
        if isinstance(top, dict):
            detected = top.get("detected_extensions", {})
            if isinstance(detected, dict) and "date" in detected:
                return detected["date"]
    return ""


# =============================================================================
# LEAD SNIPER SERVICE
# =============================================================================

class LeadSniperService:

    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")
        self.tavily_key = os.getenv("TAVILY_API_KEY", "")
        self.google_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY", "")
        self.has_claude = bool(os.getenv("ANTHROPIC_API_KEY", ""))

        available = []
        if self.serpapi_key:
            available.append("SerpAPI")
        if self.tavily_key:
            available.append("Tavily")
        if self.google_key:
            available.append("Google Maps")
        logger.info(f"LeadSniper initialized with sources: {', '.join(available) or 'NONE'}")

    # ─────────────────────────────────────────────────────────────────────────
    # SOURCE 1: SerpAPI — Google Search (Hebrew, last month)
    # ─────────────────────────────────────────────────────────────────────────

    def _search_serpapi(self, query: str, num: int = 10) -> list[RawResult]:
        if not self.serpapi_key:
            return []
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google",
                    "q": query,
                    "tbs": "qdr:m",  # last month
                    "num": num,
                    "gl": "il",
                    "hl": "iw",
                    "location": "Israel",
                },
                timeout=15.0,
            )
            data = resp.json()
            results = []
            for r in data.get("organic_results", []):
                url = r.get("link", "")
                results.append(RawResult(
                    title=r.get("title", ""),
                    content=r.get("snippet", ""),
                    source_url=url,
                    source_platform=_detect_platform(url),
                    search_query=query,
                    published_date=_extract_date_from_serp(r),
                    raw_score=0.7,
                ))
            logger.info(f"SerpAPI google: '{query}' → {len(results)} results")
            return results
        except Exception as e:
            logger.error(f"SerpAPI search error: {e}")
            return []

    # ─────────────────────────────────────────────────────────────────────────
    # SOURCE 2: SerpAPI — Facebook-specific
    # ─────────────────────────────────────────────────────────────────────────

    def _search_facebook(self, business_type: str, city: str) -> list[RawResult]:
        if not self.serpapi_key:
            return []
        queries = [
            f'site:facebook.com מחפש {business_type} {city}',
            f'site:facebook.com המלצה {business_type} {city}',
            f'site:facebook.com צריך {business_type} {city}',
            f'site:facebook.com "{business_type}" "{city}"',
        ]
        all_results = []
        for query in queries:
            try:
                resp = httpx.get(
                    "https://serpapi.com/search",
                    params={
                        "api_key": self.serpapi_key,
                        "engine": "google",
                        "q": query,
                        "tbs": "qdr:m",
                        "num": 10,
                        "gl": "il",
                        "hl": "iw",
                    },
                    timeout=15.0,
                )
                data = resp.json()
                for r in data.get("organic_results", []):
                    all_results.append(RawResult(
                        title=r.get("title", ""),
                        content=r.get("snippet", ""),
                        source_url=r.get("link", ""),
                        source_platform="facebook",
                        search_query=query,
                        published_date=_extract_date_from_serp(r),
                        raw_score=0.85,
                    ))
            except Exception as e:
                logger.error(f"SerpAPI Facebook error: {e}")
        logger.info(f"SerpAPI facebook: {len(all_results)} results from {len(queries)} queries")
        return all_results

    # ─────────────────────────────────────────────────────────────────────────
    # SOURCE 3: SerpAPI — Israeli Forums
    # ─────────────────────────────────────────────────────────────────────────

    def _search_israeli_forums(self, business_type: str, city: str) -> list[RawResult]:
        if not self.serpapi_key:
            return []
        forum_sites = [
            "site:tapuz.co.il",
            "site:mako.co.il/forum",
            "site:forums.co.il",
            "site:homeless.co.il",
        ]
        all_results = []
        for site in forum_sites:
            query = f"{site} {business_type} {city}"
            try:
                resp = httpx.get(
                    "https://serpapi.com/search",
                    params={
                        "api_key": self.serpapi_key,
                        "engine": "google",
                        "q": query,
                        "tbs": "qdr:m",
                        "num": 5,
                        "gl": "il",
                        "hl": "iw",
                    },
                    timeout=15.0,
                )
                data = resp.json()
                for r in data.get("organic_results", []):
                    all_results.append(RawResult(
                        title=r.get("title", ""),
                        content=r.get("snippet", ""),
                        source_url=r.get("link", ""),
                        source_platform="forum",
                        search_query=query,
                        published_date=_extract_date_from_serp(r),
                        raw_score=0.75,
                    ))
            except Exception as e:
                logger.error(f"SerpAPI forum error ({site}): {e}")
        logger.info(f"SerpAPI forums: {len(all_results)} results from {len(forum_sites)} sites")
        return all_results

    # ─────────────────────────────────────────────────────────────────────────
    # SOURCE 4: Google Maps — Competitor negative reviews
    # ─────────────────────────────────────────────────────────────────────────

    def _search_maps_reviews(self, business_id: str, business_type: str, city: str, supabase) -> list[RawResult]:
        if not self.google_key:
            return []
        # Get competitors from DB
        try:
            comp_result = (
                supabase.table("competitors")
                .select("name, place_id, google_rating")
                .eq("business_id", business_id)
                .order("google_rating", desc=False)
                .limit(5)
                .execute()
            )
            competitors = comp_result.data or []
        except Exception as e:
            logger.error(f"Failed to load competitors for maps reviews: {e}")
            return []

        if not competitors:
            return []

        all_results = []
        for comp in competitors:
            place_id = comp.get("place_id", "")
            comp_name = comp.get("name", "")
            if not place_id:
                continue
            try:
                resp = httpx.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={
                        "place_id": place_id,
                        "fields": "reviews",
                        "key": self.google_key,
                        "language": "he",
                    },
                    timeout=10.0,
                )
                data = resp.json()
                reviews = data.get("result", {}).get("reviews", [])
                for review in reviews:
                    rating = review.get("rating", 5)
                    if rating > 3:
                        continue  # Only negative/mediocre reviews
                    text = review.get("text", "")
                    if not text or len(text) < 20:
                        continue
                    # Convert relative_time_description or time to date
                    review_time = review.get("time", 0)
                    pub_date = ""
                    if review_time:
                        pub_date = datetime.fromtimestamp(review_time, tz=timezone.utc).isoformat()
                    all_results.append(RawResult(
                        title=f"ביקורת שלילית על {comp_name}",
                        content=f"לקוח כתב ({rating}★): {text}",
                        source_url=f"https://www.google.com/maps/place/?q=place_id:{place_id}",
                        source_platform="google_maps",
                        search_query=f"reviews:{comp_name}",
                        published_date=pub_date,
                        raw_score=0.9,
                        lead_type="unhappy_competitor_customer",
                    ))
            except Exception as e:
                logger.error(f"Google Maps review error for {comp_name}: {e}")
        logger.info(f"Google Maps reviews: {len(all_results)} negative reviews from {len(competitors)} competitors")
        return all_results

    # ─────────────────────────────────────────────────────────────────────────
    # SOURCE 5: Tavily — General web search
    # ─────────────────────────────────────────────────────────────────────────

    def _search_tavily(self, query: str, max_results: int = 10) -> list[RawResult]:
        if not self.tavily_key:
            return []
        try:
            resp = httpx.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.tavily_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "advanced",
                    "include_raw_content": False,
                    "days": 30,
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for r in data.get("results", []):
                url = r.get("url", "")
                results.append(RawResult(
                    title=r.get("title", ""),
                    content=r.get("content", ""),
                    source_url=url,
                    source_platform=_detect_platform(url),
                    search_query=query,
                    published_date=r.get("published_date", ""),
                    raw_score=0.7,
                ))
            logger.info(f"Tavily: '{query}' → {len(results)} results")
            return results
        except Exception as e:
            logger.error(f"Tavily search error: {e}")
            return []

    # ─────────────────────────────────────────────────────────────────────────
    # SCORING
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _score_results(results: list[RawResult], business_type: str, city: str) -> list[RawResult]:
        location_terms = [city.lower()] if city else []
        location_terms.extend(["קרוב", "באזור", "ליד"])

        for r in results:
            text = (r.title + " " + r.content).lower()
            score = r.raw_score

            # Boost for buying intent keywords
            if any(kw in text for kw in HIGH_INTENT_KEYWORDS):
                score += 0.2

            # Boost for location match
            if any(loc in text for loc in location_terms):
                score += 0.15

            # Boost for unhappy competitor customer
            if r.lead_type == "unhappy_competitor_customer":
                score += 0.25

            # Platform boost
            platform_boost = {
                "facebook": 0.15,
                "google_maps": 0.2,
                "forum": 0.1,
                "instagram": 0.05,
                "reddit": 0.1,
            }
            score += platform_boost.get(r.source_platform, 0)

            r.raw_score = min(score, 1.0)

        return results

    # ─────────────────────────────────────────────────────────────────────────
    # AI FILTERING (Claude)
    # ─────────────────────────────────────────────────────────────────────────

    def _filter_with_ai(
        self,
        results: list[RawResult],
        industry: str,
        location: str,
        business_name: str = "",
        score_threshold: float = 0.5,
        negative_prompts: list[str] = None,
    ) -> list[DiscoveredLead]:
        if not self.has_claude or not results:
            # Fallback: convert raw results directly without AI
            return self._convert_without_ai(results, score_threshold)

        # Build URL→metadata map
        url_meta = {}
        for r in results:
            url_meta[r.source_url] = {
                "published_date": r.published_date,
                "platform": r.source_platform,
                "lead_type": r.lead_type,
                "raw_score": r.raw_score,
            }

        # Build results text for AI
        results_text = ""
        for i, r in enumerate(results[:30], 1):  # Cap at 30 for token limit
            results_text += (
                f"\n--- Result {i} ---\n"
                f"Title: {r.title}\nURL: {r.source_url}\n"
                f"Platform: {r.source_platform}\nDate: {r.published_date or 'unknown'}\n"
                f"Content: {r.content[:400]}\n"
            )

        negative_section = ""
        if negative_prompts:
            filters = "\n".join(f"  - {p}" for p in negative_prompts)
            negative_section = (
                "\n\nCRITICAL FILTERS — discard any lead that violates these:\n"
                f"{filters}\n"
            )

        system_prompt = (
            "אתה מומחה סינון לידים ישראלי. "
            "נתח תוצאות חיפוש וזהה אנשים שמחפשים שירות או מוצר.\n\n"
            "כללים:\n"
            "1. שמור רק תוצאות שמכילות בקשה אמיתית של אדם אמיתי\n"
            "2. הסר מודעות, רשימות עסקים, כתבות חדשות, דפי מדריך\n"
            "3. שמור פוסטים מפורומים, פייסבוק, ביקורות שליליות על מתחרים\n"
            "4. ביקורת שלילית על מתחרה = ליד (הלקוח מחפש חלופה)\n"
            "5. כתוב הכל בעברית\n"
            + negative_section
            + "\nהחזר JSON בלבד:\n"
            '{"leads": [{"url": "...", "original_text": "ציטוט מהתוכן", '
            '"summary": "סיכום בעברית", '
            '"platform": "facebook|forum|google_maps|web|instagram", '
            '"relevance_score": 0.85, '
            '"matched_keywords": ["מחפש","צריך"], '
            '"intent_category": "looking_for_service|comparing_prices|complaint|recommendation_request"'
            "}]}\n"
            'אין לידים? החזר: {"leads": []}'
        )

        user_content = (
            f"עסק: {business_name}\nתחום: {industry}\nמיקום: {location}\n\n"
            f"תוצאות חיפוש:\n{results_text}"
        )

        try:
            raw = claude_chat(
                messages=[{"role": "user", "content": user_content}],
                system=system_prompt,
                temperature=0.1,
                max_tokens=4000,
            )

            raw = (raw or "").strip()
            if "```" in raw:
                parts = raw.split("```")
                for part in parts:
                    clean = part.strip()
                    if clean.startswith("json"):
                        clean = clean[4:].strip()
                    if clean.startswith("{") or clean.startswith("["):
                        raw = clean
                        break

            parsed = json.loads(raw)
            leads_data = parsed.get("leads", [])

            leads = []
            for ld in leads_data:
                score = float(ld.get("relevance_score", 0))
                if score < score_threshold:
                    continue

                source_url = ld.get("url", "")
                if not _is_valid_lead_url(source_url):
                    continue

                meta = url_meta.get(source_url, {})
                signals = {
                    "matched_keywords": ld.get("matched_keywords", []),
                    "intent_category": ld.get("intent_category", "recommendation_request"),
                }
                if meta.get("lead_type"):
                    signals["lead_type"] = meta["lead_type"]

                leads.append(DiscoveredLead(
                    platform=ld.get("platform", meta.get("platform", "web")),
                    summary=ld.get("summary", ""),
                    source_url=source_url,
                    original_text=ld.get("original_text", "")[:1000],
                    search_query="multi-source",
                    relevance_score=score,
                    intent_signals=signals,
                    published_date=meta.get("published_date"),
                ))

            logger.info(f"AI filter: {len(leads)} leads passed (from {len(results)} results)")
            return leads

        except Exception as e:
            logger.error(f"AI filter error: {e}")
            return self._convert_without_ai(results, score_threshold)

    def _convert_without_ai(self, results: list[RawResult], threshold: float) -> list[DiscoveredLead]:
        """Fallback: convert raw results without AI when Claude is unavailable."""
        leads = []
        for r in results:
            if r.raw_score < threshold:
                continue
            if not _is_valid_lead_url(r.source_url):
                continue
            leads.append(DiscoveredLead(
                platform=r.source_platform,
                summary=r.title,
                source_url=r.source_url,
                original_text=r.content[:1000],
                search_query=r.search_query,
                relevance_score=r.raw_score,
                intent_signals={"lead_type": r.lead_type} if r.lead_type else {},
                published_date=r.published_date,
            ))
        return leads

    # ─────────────────────────────────────────────────────────────────────────
    # DEDUPLICATION
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _deduplicate(leads: list[DiscoveredLead], existing_urls: set[str]) -> list[DiscoveredLead]:
        seen: set[str] = set()
        unique = []
        for lead in leads:
            normalized = lead.source_url.strip().rstrip("/").lower()
            if normalized and normalized not in existing_urls and normalized not in seen:
                seen.add(normalized)
                unique.append(lead)
        return unique

    # ─────────────────────────────────────────────────────────────────────────
    # MAIN MISSION
    # ─────────────────────────────────────────────────────────────────────────

    def sniping_mission(self, business_id: str, supabase) -> SnipingReport:
        """
        Execute a full multi-source sniping mission.

        Sources:
        1. SerpAPI Google Search (Hebrew, last month)
        2. SerpAPI Facebook-specific (site:facebook.com)
        3. SerpAPI Israeli Forums (tapuz, mako, homeless, etc.)
        4. Google Maps — negative competitor reviews
        5. Tavily — general web search
        """
        report = SnipingReport(business_id=business_id)

        # ── Step 1: Get business details ───────────────────────────────
        try:
            biz = (
                supabase.table("businesses")
                .select("industry, location, address, business_name, industry_blueprint")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                report.errors.append("Business not found")
                return report
        except Exception as e:
            report.errors.append(f"DB error: {e}")
            return report

        industry = biz.data.get("industry", "")
        raw_location = biz.data.get("location", "") or ""
        raw_address = biz.data.get("address", "") or ""
        if raw_location in ("None", "null", "undefined"):
            raw_location = ""
        if raw_address in ("None", "null", "undefined"):
            raw_address = ""
        location = raw_location or raw_address
        biz_name = biz.data.get("business_name", "")

        # Parse blueprint for negative_prompts
        blueprint = None
        raw_bp = biz.data.get("industry_blueprint")
        if raw_bp:
            try:
                blueprint = json.loads(raw_bp) if isinstance(raw_bp, str) else raw_bp
            except Exception:
                pass

        negative_prompts = None
        if blueprint and blueprint.get("negative_prompts"):
            negative_prompts = blueprint["negative_prompts"]

        # ── Step 2: RLHF context ──────────────────────────────────────
        score_threshold = 0.5
        try:
            feedback = (
                supabase.table("leads_discovered")
                .select("status")
                .eq("business_id", business_id)
                .execute()
            )
            if feedback.data and len(feedback.data) >= 5:
                total = len(feedback.data)
                approved = sum(1 for r in feedback.data if r.get("status") == "sniped")
                approval_rate = approved / total
                score_threshold = max(0.3, min(0.8, 0.5 + (approval_rate - 0.5) * 0.4))
        except Exception:
            pass

        # ── Step 3: Get existing URLs for dedup ────────────────────────
        existing_urls: set[str] = set()
        try:
            existing = (
                supabase.table("leads_discovered")
                .select("source_url")
                .eq("business_id", business_id)
                .execute()
            )
            for row in existing.data or []:
                url = (row.get("source_url") or "").strip().rstrip("/").lower()
                if url:
                    existing_urls.add(url)
        except Exception:
            pass

        # ── Step 4: Search ALL sources ─────────────────────────────────
        now = datetime.now()
        year = now.year
        month_heb = _MONTH_HEB.get(now.month, "")

        all_raw: list[RawResult] = []

        # SOURCE 1: SerpAPI — Google general
        google_queries = [
            f"מחפש {industry} ב{location}",
            f"המלצה על {industry} {location}",
            f"צריך {industry} {location}",
            f"מחפש {industry} באזור {location}",
        ]
        for q in google_queries:
            report.queries_executed.append(q)
            results = self._search_serpapi(q)
            report.source_counts["serpapi_google"] = report.source_counts.get("serpapi_google", 0) + len(results)
            all_raw.extend(results)

        # SOURCE 2: SerpAPI — Facebook
        fb_results = self._search_facebook(industry, location)
        report.source_counts["facebook"] = len(fb_results)
        all_raw.extend(fb_results)

        # SOURCE 3: SerpAPI — Israeli Forums
        forum_results = self._search_israeli_forums(industry, location)
        report.source_counts["forums"] = len(forum_results)
        all_raw.extend(forum_results)

        # SOURCE 4: Google Maps — Competitor negative reviews
        maps_results = self._search_maps_reviews(business_id, industry, location, supabase)
        report.source_counts["google_maps"] = len(maps_results)
        all_raw.extend(maps_results)

        # SOURCE 5: Tavily — General web
        tavily_queries = [
            f"מחפש {industry} {location} {year}",
            f"{industry} {location} {month_heb} {year}",
            f"צריך {industry} {location}",
        ]
        for q in tavily_queries:
            report.queries_executed.append(q)
            results = self._search_tavily(q)
            report.source_counts["tavily"] = report.source_counts.get("tavily", 0) + len(results)
            all_raw.extend(results)

        report.total_results_scanned = len(all_raw)
        logger.info(
            f"Total raw results: {len(all_raw)} — "
            f"Sources: {json.dumps(report.source_counts, ensure_ascii=False)}"
        )

        # ── Step 5: Date filter ────────────────────────────────────────
        all_raw = _filter_recent(all_raw, max_age_days=30)

        # ── Step 6: Score ──────────────────────────────────────────────
        all_raw = self._score_results(all_raw, industry, location)

        # Sort by score descending, take top 40 for AI
        all_raw.sort(key=lambda r: r.raw_score, reverse=True)
        top_candidates = all_raw[:40]

        # ── Step 7: AI Filter ──────────────────────────────────────────
        all_leads = self._filter_with_ai(
            top_candidates,
            industry,
            location,
            biz_name,
            score_threshold=score_threshold,
            negative_prompts=negative_prompts,
        )

        # ── Step 8: Deduplicate ────────────────────────────────────────
        unique_leads = self._deduplicate(all_leads, existing_urls)

        # Sort by score, take top 20
        unique_leads.sort(key=lambda l: l.relevance_score, reverse=True)
        unique_leads = unique_leads[:20]
        report.leads_found = len(unique_leads)

        # ── Step 9: Save to DB ─────────────────────────────────────────
        saved_count = 0
        for lead in unique_leads:
            try:
                row = lead.to_db_row(business_id)
                supabase.table("leads_discovered").insert(row).execute()
                saved_count += 1
                report.leads.append({
                    "platform": lead.platform,
                    "summary": lead.summary,
                    "url": lead.source_url,
                    "score": lead.relevance_score,
                    "published_date": lead.published_date,
                })
            except Exception as e:
                err_str = str(e)
                # If published_date column doesn't exist, retry without it
                if "published_date" in err_str:
                    try:
                        row.pop("published_date", None)
                        supabase.table("leads_discovered").insert(row).execute()
                        saved_count += 1
                        report.leads.append({
                            "platform": lead.platform,
                            "summary": lead.summary,
                            "url": lead.source_url,
                            "score": lead.relevance_score,
                        })
                    except Exception as e2:
                        report.errors.append(f"Save error: {e2}")
                else:
                    report.errors.append(f"Save error: {e}")

        report.leads_saved = saved_count
        logger.info(
            f"Sniping mission complete for {business_id}: "
            f"scanned={report.total_results_scanned}, "
            f"found={report.leads_found}, saved={report.leads_saved}, "
            f"sources={json.dumps(report.source_counts, ensure_ascii=False)}"
        )
        return report


# =============================================================================
# SINGLETON
# =============================================================================

_sniper_instance: Optional[LeadSniperService] = None


def get_lead_sniper() -> LeadSniperService:
    global _sniper_instance
    if _sniper_instance is None:
        _sniper_instance = LeadSniperService()
    return _sniper_instance
