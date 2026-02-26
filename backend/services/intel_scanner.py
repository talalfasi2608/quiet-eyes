"""
Intel Scanner Service for Quiet Eyes.

Multi-source intelligence scanner that feeds into intelligence_events and
trend_data tables. Sources: Facebook groups (Apify), business registry
(data.gov.il), Yad2 commercial (SerpAPI), Google Trends (SerpAPI),
Israeli news (SerpAPI).
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class IntelResult:
    """A single intelligence event to insert into intelligence_events."""
    event_type: str
    title: str
    description: str
    severity: str  # low, medium, high
    source: str
    metadata: dict = field(default_factory=dict)


@dataclass
class TrendResult:
    """A single trend data point to insert into trend_data."""
    keyword: str
    interest_score: int
    time_period: str
    related_queries: list = field(default_factory=list)
    source: str = "serpapi_trends"


@dataclass
class ScanReport:
    """Summary of a full scan run."""
    business_id: str
    total_events: int = 0
    total_trends: int = 0
    events_by_source: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)


# =============================================================================
# INTEL SCANNER SERVICE
# =============================================================================

class IntelScannerService:

    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")
        self.apify_key = os.getenv("APIFY_API_KEY", "")

        available = []
        if self.serpapi_key:
            available.append("SerpAPI")
        if self.apify_key:
            available.append("Apify")
        logger.info(f"[IntelScanner] Sources available: {available or ['none']}")

    # -------------------------------------------------------------------------
    # Shared helper: SerpAPI Google search
    # -------------------------------------------------------------------------

    def _serpapi_search(
        self, query: str, num: int = 10, tbs: str = "qdr:m", **extra_params
    ) -> dict:
        """
        Reusable SerpAPI Google search with Israel/Hebrew defaults.
        Returns the raw JSON response dict, or empty dict on failure.
        """
        if not self.serpapi_key:
            return {}
        try:
            params = {
                "api_key": self.serpapi_key,
                "engine": "google",
                "q": query,
                "tbs": tbs,
                "num": num,
                "gl": "il",
                "hl": "iw",
            }
            params.update(extra_params)
            resp = httpx.get(
                "https://serpapi.com/search",
                params=params,
                timeout=30.0,
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.debug(f"[IntelScanner] SerpAPI search error: {e}")
        return {}

    # =========================================================================
    # SOURCE 1: Facebook Groups (Apify)
    # =========================================================================

    def _scan_facebook_groups(
        self, industry: str, city: str
    ) -> list[IntelResult]:
        """
        Scan Facebook groups for buying intent using Apify facebook-groups-scraper.
        Optional — returns empty list if APIFY_API_KEY is not set.
        """
        if not self.apify_key:
            logger.debug("[IntelScanner] Apify key not set, skipping Facebook groups")
            return []

        results: list[IntelResult] = []
        search_term = f"{industry} {city}"

        try:
            from apify_client import ApifyClient
            client = ApifyClient(self.apify_key)

            search_url = (
                f"https://www.facebook.com/groups/search/groups/"
                f"?q={search_term.replace(' ', '%20')}"
            )
            run_input = {
                "startUrls": [{"url": search_url}],
                "resultsLimit": 10,
            }

            run = client.actor("apify/facebook-groups-scraper").call(
                run_input=run_input,
                timeout_secs=120,
            )

            dataset_items = list(
                client.dataset(run["defaultDatasetId"]).iterate_items()
            )

            for item in dataset_items[:10]:
                text = item.get("text", "") or item.get("message", "")
                group_name = item.get("groupName", "קבוצת פייסבוק")
                post_url = item.get("url", "")

                if not text:
                    continue

                # Check for buying-intent keywords
                intent_keywords = [
                    "מחפש", "צריך", "רוצה", "מישהו מכיר",
                    "המלצה", "ממליצים", "עזרה",
                ]
                has_intent = any(kw in text for kw in intent_keywords)
                if not has_intent:
                    continue

                results.append(IntelResult(
                    event_type="facebook_intent",
                    title=f"כוונת רכישה בפייסבוק: {group_name}",
                    description=text[:300],
                    severity="medium",
                    source="facebook_groups",
                    metadata={
                        "group_name": group_name,
                        "post_url": post_url,
                        "search_term": search_term,
                    },
                ))

        except ImportError:
            logger.debug("[IntelScanner] apify-client not installed, skipping Facebook groups")
        except Exception as e:
            logger.error(f"[IntelScanner] Facebook groups scan error: {e}")

        logger.info(f"[IntelScanner] Facebook groups: {len(results)} intent signals found")
        return results

    # =========================================================================
    # SOURCE 2: Business Registry (data.gov.il + SerpAPI fallback)
    # =========================================================================

    def _scan_business_registry(
        self, industry: str, city: str, serp_location: str = "Israel"
    ) -> list[IntelResult]:
        """
        Search for new business registrations via data.gov.il CKAN API.
        Falls back to SerpAPI Google search if CKAN fails.
        """
        results: list[IntelResult] = []

        # Try data.gov.il CKAN API first
        ckan_results = self._try_ckan_search(industry, city)
        if ckan_results:
            return ckan_results

        # Fallback: SerpAPI search for new businesses
        if not self.serpapi_key:
            return []

        queries = [
            f"עסק חדש {industry} {city}",
            f"נפתח {industry} {city}",
            f"רישום עסקים חדשים {industry} {city}",
        ]

        for query in queries:
            data = self._serpapi_search(query, num=5, tbs="qdr:m", location=serp_location)
            for item in data.get("organic_results", [])[:3]:
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                link = item.get("link", "")

                if not title:
                    continue

                results.append(IntelResult(
                    event_type="new_competitor_alert",
                    title=f"מתחרה חדש אפשרי: {title[:80]}",
                    description=snippet[:300] or f"זוהה עסק חדש בתחום {industry} ב{city}",
                    severity="high",
                    source="business_registry",
                    metadata={
                        "original_title": title,
                        "url": link,
                        "search_query": query,
                        "data_source": "serpapi_fallback",
                    },
                ))

        # Deduplicate by title
        seen_titles = set()
        unique = []
        for r in results:
            if r.title not in seen_titles:
                seen_titles.add(r.title)
                unique.append(r)

        logger.info(f"[IntelScanner] Business registry: {len(unique)} new competitor alerts")
        return unique[:5]

    def _try_ckan_search(self, industry: str, city: str) -> list[IntelResult]:
        """Try data.gov.il CKAN API for business registration data."""
        results: list[IntelResult] = []
        try:
            # data.gov.il CKAN package search for business registrations
            resp = httpx.get(
                "https://data.gov.il/api/3/action/datastore_search",
                params={
                    "resource_id": "f004176c-b85f-4542-8901-7b3176f9a054",
                    "q": f"{industry} {city}",
                    "limit": 10,
                },
                timeout=15.0,
            )
            if resp.status_code != 200:
                return []

            data = resp.json()
            if not data.get("success"):
                return []

            records = data.get("result", {}).get("records", [])
            one_month_ago = datetime.now(timezone.utc) - timedelta(days=30)

            for record in records:
                biz_name = (
                    record.get("שם_עסק")
                    or record.get("entity_name")
                    or record.get("שם_חברה")
                    or ""
                )
                reg_date_str = (
                    record.get("תאריך_רישום")
                    or record.get("registration_date")
                    or ""
                )

                if not biz_name:
                    continue

                # Check if registration is recent (within last month)
                is_recent = True
                if reg_date_str:
                    try:
                        reg_date = datetime.fromisoformat(
                            reg_date_str.replace("Z", "+00:00")
                        )
                        if reg_date.tzinfo is None:
                            reg_date = reg_date.replace(tzinfo=timezone.utc)
                        is_recent = reg_date >= one_month_ago
                    except (ValueError, TypeError):
                        pass

                if not is_recent:
                    continue

                results.append(IntelResult(
                    event_type="new_competitor_alert",
                    title=f"עסק חדש נרשם: {biz_name}",
                    description=(
                        f"עסק חדש בתחום {industry} נרשם ב{city}. "
                        f"שם: {biz_name}."
                    ),
                    severity="high",
                    source="business_registry",
                    metadata={
                        "business_name": biz_name,
                        "registration_date": reg_date_str,
                        "data_source": "data_gov_il",
                        "raw_record": {
                            k: str(v) for k, v in record.items()
                        } if record else {},
                    },
                ))

            logger.info(
                f"[IntelScanner] data.gov.il: {len(results)} new registrations"
            )
        except Exception as e:
            logger.debug(f"[IntelScanner] data.gov.il CKAN error: {e}")

        return results[:5]

    # =========================================================================
    # SOURCE 3: Yad2 Commercial Real Estate (SerpAPI)
    # =========================================================================

    def _scan_yad2_commercial(
        self, industry: str, city: str, serp_location: str = "Israel"
    ) -> list[IntelResult]:
        """
        Search for commercial real estate listings on Yad2 that may indicate
        new competitor openings or business closures.
        """
        if not self.serpapi_key:
            return []

        results: list[IntelResult] = []

        queries = [
            f"site:yad2.co.il נכס מסחרי {industry} {city}",
            f"site:yad2.co.il חנות להשכרה {city}",
            f"site:yad2.co.il עסק למכירה {industry} {city}",
        ]

        for query in queries:
            data = self._serpapi_search(query, num=5, tbs="qdr:m", location=serp_location)
            for item in data.get("organic_results", [])[:3]:
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                link = item.get("link", "")

                if not title or "yad2" not in link.lower():
                    continue

                # Determine if this is a closure or new opening
                closure_keywords = ["למכירה", "לסגירה", "מפסיק", "נסגר"]
                is_closure = any(kw in title + snippet for kw in closure_keywords)

                desc = snippet[:300] if snippet else title
                if is_closure:
                    event_title = f"עסק נסגר באזור: {title[:80]}"
                    desc = f"זוהתה מודעת סגירה/מכירה באזור {city}: {desc}"
                else:
                    event_title = f"נכס מסחרי חדש: {title[:80]}"
                    desc = f"נכס מסחרי חדש זמין ב{city}: {desc}"

                results.append(IntelResult(
                    event_type="real_estate_alert",
                    title=event_title,
                    description=desc,
                    severity="medium",
                    source="yad2_commercial",
                    metadata={
                        "original_title": title,
                        "url": link,
                        "is_closure": is_closure,
                        "search_query": query,
                    },
                ))

        # Deduplicate by URL
        seen_urls = set()
        unique = []
        for r in results:
            url = r.metadata.get("url", "")
            if url not in seen_urls:
                seen_urls.add(url)
                unique.append(r)

        logger.info(f"[IntelScanner] Yad2 commercial: {len(unique)} real estate alerts")
        return unique[:5]

    # =========================================================================
    # SOURCE 4: Google Trends (SerpAPI google_trends engine)
    # =========================================================================

    def _scan_google_trends(
        self, industry: str, city: str
    ) -> tuple[list[IntelResult], list[TrendResult]]:
        """
        Fetch Google Trends data for industry keywords via SerpAPI.
        Returns both IntelResult events and TrendResult data points.
        """
        events: list[IntelResult] = []
        trends: list[TrendResult] = []

        if not self.serpapi_key:
            return events, trends

        keywords = [industry, f"{industry} {city}"]

        for keyword in keywords:
            try:
                resp = httpx.get(
                    "https://serpapi.com/search",
                    params={
                        "api_key": self.serpapi_key,
                        "engine": "google_trends",
                        "q": keyword,
                        "geo": "IL",
                        "date": "today 3-m",
                        "hl": "iw",
                    },
                    timeout=30.0,
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()

                # Extract interest over time
                interest_data = data.get("interest_over_time", {})
                timeline = interest_data.get("timeline_data", [])

                if timeline:
                    # Get the most recent data point
                    latest = timeline[-1] if timeline else {}
                    values = latest.get("values", [])
                    score = 0
                    if values:
                        try:
                            score = int(values[0].get("extracted_value", 0))
                        except (ValueError, TypeError, IndexError):
                            pass

                    time_period = latest.get("date", "")

                    trends.append(TrendResult(
                        keyword=keyword,
                        interest_score=score,
                        time_period=time_period,
                        related_queries=[],
                        source="serpapi_trends",
                    ))

                    # Create an event if trend is notable (score >= 50)
                    if score >= 50:
                        events.append(IntelResult(
                            event_type="trend",
                            title=f"טרנד עולה: {keyword}",
                            description=(
                                f"ציון עניין של {score}/100 עבור \"{keyword}\" "
                                f"בגוגל טרנדס (ישראל). תקופה: {time_period}."
                            ),
                            severity="medium",
                            source="google_trends",
                            metadata={
                                "keyword": keyword,
                                "interest_score": score,
                                "time_period": time_period,
                                "geo": "IL",
                            },
                        ))

                # Extract related queries
                related = data.get("related_queries", {})
                rising = related.get("rising", [])
                top = related.get("top", [])

                related_list = []
                for rq in (rising or [])[:5]:
                    q_text = rq.get("query", "")
                    if q_text:
                        related_list.append(q_text)

                # Update the trend result with related queries
                if trends and related_list:
                    trends[-1].related_queries = related_list

                # Create event for rising related queries
                if rising:
                    rising_terms = [
                        rq.get("query", "") for rq in rising[:3] if rq.get("query")
                    ]
                    if rising_terms:
                        events.append(IntelResult(
                            event_type="trend",
                            title=f"חיפושים עולים: {keyword}",
                            description=(
                                f"חיפושים קשורים בעלייה עבור \"{keyword}\": "
                                f"{', '.join(rising_terms)}"
                            ),
                            severity="medium",
                            source="google_trends",
                            metadata={
                                "keyword": keyword,
                                "rising_queries": rising_terms,
                                "top_queries": [
                                    tq.get("query", "") for tq in (top or [])[:5]
                                ],
                            },
                        ))

            except Exception as e:
                logger.debug(f"[IntelScanner] Google Trends error for '{keyword}': {e}")

        logger.info(
            f"[IntelScanner] Google Trends: {len(events)} events, {len(trends)} data points"
        )
        return events, trends

    # =========================================================================
    # SOURCE 5: Israeli News (SerpAPI news search)
    # =========================================================================

    def _scan_israeli_news(
        self, industry: str, city: str, city_config: dict = None
    ) -> list[IntelResult]:
        """
        Search for recent Israeli news about the industry using SerpAPI
        news search (tbm=nws) filtered to Israeli news sites.
        """
        if not self.serpapi_key:
            return []

        results: list[IntelResult] = []

        # News-specific queries
        queries = [
            f"{industry} {city}",
            f"{industry} ישראל חדשות",
        ]

        israeli_news_sites = [
            "ynet.co.il", "mako.co.il", "walla.co.il",
            "globes.co.il", "calcalist.co.il", "themarker.com",
        ]

        # Add city-specific local news sources
        if city_config:
            for local_site in city_config.get("local_news", []):
                if local_site not in israeli_news_sites:
                    israeli_news_sites.append(local_site)

        for query in queries:
            try:
                resp = httpx.get(
                    "https://serpapi.com/search",
                    params={
                        "api_key": self.serpapi_key,
                        "engine": "google",
                        "q": query,
                        "tbm": "nws",
                        "gl": "il",
                        "hl": "iw",
                        "num": 10,
                    },
                    timeout=30.0,
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                news_results = data.get("news_results", [])

                for item in news_results[:5]:
                    title = item.get("title", "")
                    snippet = item.get("snippet", "")
                    link = item.get("link", "")
                    news_source = item.get("source", "")
                    date_str = item.get("date", "")

                    if not title:
                        continue

                    # Prefer results from known Israeli news sites
                    is_israeli = any(
                        site in link.lower() for site in israeli_news_sites
                    )

                    results.append(IntelResult(
                        event_type="industry_news",
                        title=f"חדשות: {title[:80]}",
                        description=snippet[:300] or title,
                        severity="low",
                        source="israeli_news",
                        metadata={
                            "original_title": title,
                            "url": link,
                            "news_source": news_source,
                            "published_date": date_str,
                            "is_israeli_source": is_israeli,
                            "search_query": query,
                        },
                    ))

            except Exception as e:
                logger.debug(f"[IntelScanner] News search error: {e}")

        # Deduplicate by URL
        seen_urls = set()
        unique = []
        for r in results:
            url = r.metadata.get("url", "")
            if url not in seen_urls:
                seen_urls.add(url)
                unique.append(r)

        # Sort: Israeli sources first
        unique.sort(
            key=lambda r: not r.metadata.get("is_israeli_source", False)
        )

        logger.info(f"[IntelScanner] Israeli news: {len(unique)} articles found")
        return unique[:8]

    # =========================================================================
    # ORCHESTRATOR
    # =========================================================================

    def run_full_scan(self, business_id: str, supabase) -> ScanReport:
        """
        Run all 5 intelligence sources and save results.

        1. Fetch business info (industry, location) from DB
        2. Run all 5 sources sequentially
        3. Deduplicate against existing events from last 7 days
        4. Save IntelResult items -> intelligence_events table
        5. Save TrendResult items -> trend_data table
        6. Return ScanReport with counts per source
        """
        report = ScanReport(business_id=business_id)

        # Step 1: Fetch business info
        try:
            biz = (
                supabase.table("businesses")
                .select("industry, location, business_name")
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
        city = biz.data.get("location", "")
        if not industry:
            report.errors.append("Business has no industry set")
            return report

        # Resolve city-specific SERP location
        from data.cities import get_serp_location, get_city_config
        serp_location = get_serp_location(city)
        city_config = get_city_config(city)

        logger.info(
            f"[IntelScanner] Starting full scan for {business_id}: "
            f"industry={industry}, city={city}, serp_location={serp_location}"
        )

        # Step 2: Run all 5 sources sequentially
        all_events: list[IntelResult] = []
        all_trends: list[TrendResult] = []

        # Source 1: Facebook Groups
        try:
            fb_events = self._scan_facebook_groups(industry, city)
            all_events.extend(fb_events)
            report.events_by_source["facebook_groups"] = len(fb_events)
        except Exception as e:
            report.errors.append(f"facebook_groups: {e}")
            report.events_by_source["facebook_groups"] = 0

        # Source 2: Business Registry
        try:
            reg_events = self._scan_business_registry(industry, city, serp_location=serp_location)
            all_events.extend(reg_events)
            report.events_by_source["business_registry"] = len(reg_events)
        except Exception as e:
            report.errors.append(f"business_registry: {e}")
            report.events_by_source["business_registry"] = 0

        # Source 3: Yad2 Commercial
        try:
            yad2_events = self._scan_yad2_commercial(industry, city, serp_location=serp_location)
            all_events.extend(yad2_events)
            report.events_by_source["yad2_commercial"] = len(yad2_events)
        except Exception as e:
            report.errors.append(f"yad2_commercial: {e}")
            report.events_by_source["yad2_commercial"] = 0

        # Source 4: Google Trends
        try:
            trend_events, trend_data = self._scan_google_trends(industry, city)
            all_events.extend(trend_events)
            all_trends.extend(trend_data)
            report.events_by_source["google_trends"] = len(trend_events)
        except Exception as e:
            report.errors.append(f"google_trends: {e}")
            report.events_by_source["google_trends"] = 0

        # Source 5: Israeli News
        try:
            news_events = self._scan_israeli_news(industry, city, city_config=city_config)
            all_events.extend(news_events)
            report.events_by_source["israeli_news"] = len(news_events)
        except Exception as e:
            report.errors.append(f"israeli_news: {e}")
            report.events_by_source["israeli_news"] = 0

        # Step 3: Deduplicate against existing events from last 7 days
        existing_titles = set()
        try:
            seven_days_ago = (
                datetime.now(timezone.utc) - timedelta(days=7)
            ).isoformat()
            existing = (
                supabase.table("intelligence_events")
                .select("title")
                .eq("business_id", business_id)
                .gte("created_at", seven_days_ago)
                .execute()
            )
            existing_titles = {
                ev["title"] for ev in (existing.data or []) if ev.get("title")
            }
        except Exception as e:
            logger.debug(f"[IntelScanner] Dedup query error: {e}")

        new_events = [
            ev for ev in all_events if ev.title not in existing_titles
        ]

        # Step 4: Save events to intelligence_events
        if new_events:
            rows = []
            for ev in new_events:
                row = {
                    "business_id": business_id,
                    "event_type": ev.event_type,
                    "title": ev.title,
                    "description": ev.description,
                    "severity": ev.severity,
                    "source": ev.source,
                    "is_read": False,
                }
                if ev.metadata:
                    row["metadata"] = json.dumps(
                        ev.metadata, ensure_ascii=False, default=str
                    )
                rows.append(row)

            try:
                supabase.table("intelligence_events").insert(rows).execute()
                report.total_events = len(rows)
                logger.info(
                    f"[IntelScanner] Saved {len(rows)} events for {business_id}"
                )
            except Exception as e:
                report.errors.append(f"Event insert error: {e}")
                logger.error(f"[IntelScanner] Event insert error: {e}")

        # Step 5: Save trend data to trend_data
        if all_trends:
            trend_rows = []
            for t in all_trends:
                trend_rows.append({
                    "business_id": business_id,
                    "keyword": t.keyword,
                    "interest_score": t.interest_score,
                    "time_period": t.time_period,
                    "related_queries": json.dumps(
                        t.related_queries, ensure_ascii=False
                    ),
                    "source": t.source,
                })

            try:
                supabase.table("trend_data").insert(trend_rows).execute()
                report.total_trends = len(trend_rows)
                logger.info(
                    f"[IntelScanner] Saved {len(trend_rows)} trend data points "
                    f"for {business_id}"
                )
            except Exception as e:
                report.errors.append(f"Trend insert error: {e}")
                logger.error(f"[IntelScanner] Trend insert error: {e}")

        logger.info(
            f"[IntelScanner] Scan complete for {business_id}: "
            f"{report.total_events} events, {report.total_trends} trends, "
            f"{len(report.errors)} errors"
        )
        return report


# =============================================================================
# SINGLETON
# =============================================================================

_instance: Optional[IntelScannerService] = None


def get_intel_scanner() -> IntelScannerService:
    global _instance
    if _instance is None:
        _instance = IntelScannerService()
    return _instance
