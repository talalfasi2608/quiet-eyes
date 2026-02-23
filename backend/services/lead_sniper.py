"""
Lead Sniper Service for Quiet Eyes.

Discovers potential leads by searching the web for people actively
looking for services in the business's industry and location,
then uses AI to filter and qualify the results.
"""

import os
import re
import json
import uuid
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class DiscoveredLead:
    platform: str
    summary: str
    source_url: str
    original_text: str
    search_query: str
    relevance_score: float = 0.80
    intent_signals: dict = field(default_factory=dict)

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


# =============================================================================
# LEAD SNIPER SERVICE
# =============================================================================

class LeadSniperService:
    """
    Discovers and qualifies leads by searching the web and filtering
    results with AI.
    """

    def __init__(self):
        self.tavily_api_key = os.getenv("TAVILY_API_KEY", "")
        self.openai_client = None
        try:
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY", "")
            if api_key:
                self.openai_client = OpenAI(api_key=api_key)
        except Exception as e:
            logger.warning(f"OpenAI client init failed: {e}")

    # -------------------------------------------------------------------------
    # Search via Tavily
    # -------------------------------------------------------------------------

    def _search_tavily(
        self, query: str, max_results: int = 10, extra_domains: list = None
    ) -> list[dict]:
        """Search using Tavily API and return raw results."""
        if not self.tavily_api_key:
            logger.warning("TAVILY_API_KEY not set, skipping search")
            return []

        try:
            import httpx

            payload = {
                "api_key": self.tavily_api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": "advanced",
                "include_raw_content": False,
            }
            if extra_domains:
                payload["include_domains"] = extra_domains

            resp = httpx.post(
                "https://api.tavily.com/search",
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", [])
        except Exception as e:
            logger.error(f"Tavily search error: {e}")
            return []

    # -------------------------------------------------------------------------
    # Build search queries
    # -------------------------------------------------------------------------

    def _build_search_queries(
        self,
        industry: str,
        location: str,
        business_name: str = "",
        blueprint: dict = None,
    ) -> list[dict]:
        """Build Hebrew search queries for lead discovery."""
        queries = []
        loc = location or ""

        # Default queries based on industry + location
        base_terms = [
            f"מחפש {industry} ב{loc}",
            f"ממליצים על {industry} {loc}",
            f"מי מכיר {industry} טוב ב{loc}",
            f"{industry} {loc} המלצות",
        ]

        # Add blueprint-specific queries
        if blueprint and blueprint.get("competitor_queries"):
            for q_template in blueprint["competitor_queries"]:
                rendered = q_template.replace("{location}", loc)
                base_terms.append(rendered)

        for term in base_terms:
            queries.append({"query": term})

        return queries[:8]  # Cap at 8 queries

    # -------------------------------------------------------------------------
    # AI Filtering with negative_prompts (SPRINT 12 FIX)
    # -------------------------------------------------------------------------

    def _filter_with_ai(
        self,
        results: list[dict],
        industry: str,
        location: str,
        query: str,
        business_name: str = "",
        rlhf_context: str = "",
        score_threshold: float = 0.5,
        intent_phrases: list[str] = None,
        negative_prompts: list[str] = None,
    ) -> list[DiscoveredLead]:
        """
        Use OpenAI to filter results and extract real leads.

        Args:
            results: Raw search results from Tavily
            industry: Business industry key
            location: Business location
            query: The search query that produced these results
            business_name: Name of the business
            rlhf_context: RLHF scoring context prompt injection
            score_threshold: Minimum relevance score to keep a lead
            intent_phrases: Blueprint lead intent phrases for matching
            negative_prompts: CRITICAL industry filters from blueprint
                              (e.g. "EXCLUDE human hair salons" for pet_grooming)
        """
        if not self.openai_client or not results:
            return []

        # Build the results text for AI analysis
        results_text = ""
        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            content = r.get("content", "")[:500]
            url = r.get("url", "")
            results_text += (
                f"\n--- Result {i} ---\n"
                f"Title: {title}\nURL: {url}\nContent: {content}\n"
            )

        # ── Build CRITICAL INDUSTRY FILTERS section ──────────────────────
        negative_prompts_section = ""
        if negative_prompts:
            filters = "\n".join(f"  - {p}" for p in negative_prompts)
            negative_prompts_section = (
                "\n\nCRITICAL INDUSTRY FILTERS — You MUST obey these rules. "
                "Any lead that violates these filters MUST be discarded with score 0:\n"
                f"{filters}\n"
            )

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an Israeli lead-qualification expert. "
                            "Analyze search results and identify results where "
                            "a real human is actively asking for a service or recommendation.\n\n"
                            "RULES:\n"
                            "1. Keep any result that looks like a relevant, active request "
                            "for service from a real person.\n"
                            "2. Do NOT discard results just because a specific date is missing "
                            "-- recent undated posts are fine.\n"
                            "3. EXCLUDE business listings, ads, news articles, and directory pages.\n"
                            "4. INCLUDE forum posts, Facebook group posts, WhatsApp screenshots, "
                            "Reddit posts.\n"
                            "5. For each valid lead, detect the platform from the URL.\n"
                            "6. Return ALL text in Hebrew only. Write the summary in Hebrew.\n"
                            "7. Give a relevance_score from 0.0 to 1.0.\n"
                            "8. Prioritize leads that are geographically close to the "
                            "business location.\n"
                            "9. For each lead, also return 'matched_keywords': a list of "
                            "keywords from the text that signal buying intent.\n"
                            + negative_prompts_section
                            + (f"\n{rlhf_context}\n" if rlhf_context else "")
                            + "\nReturn JSON:\n"
                            '{"leads": [\n'
                            "  {\n"
                            '    "url": "the source URL",\n'
                            '    "original_text": "the relevant snippet from the content",\n'
                            '    "summary": "Hebrew summary of what they need",\n'
                            '    "platform": "facebook|google|instagram|forum|whatsapp|reddit|other",\n'
                            '    "relevance_score": 0.85,\n'
                            '    "matched_keywords": ["..."],\n'
                            '    "intent_category": "looking_for_service|comparing_prices|complaint|recommendation_request"\n'
                            "  }\n"
                            "]}\n\n"
                            'If no valid leads found, return: {"leads": []}'
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Business Name: {business_name}\n"
                            f"Industry: {industry}\n"
                            f"Location: {location}\n"
                            f"Search query used: {query}\n\n"
                            f"Search Results:\n{results_text}"
                        ),
                    },
                ],
            )

            raw = response.choices[0].message.content
            parsed = json.loads(raw)
            leads_data = parsed.get("leads", [])

            leads = []
            for ld in leads_data:
                score = float(ld.get("relevance_score", 0))
                if score < score_threshold:
                    continue

                matched_keywords = ld.get("matched_keywords", [])
                signals = {
                    "matched_keywords": matched_keywords,
                    "query_used": query,
                }
                signals["intent_category"] = ld.get(
                    "intent_category", "recommendation_request"
                )

                if intent_phrases:
                    text_lower = (
                        ld.get("original_text", "") + " " + ld.get("summary", "")
                    ).lower()
                    blueprint_matches = [
                        p for p in intent_phrases if p.lower() in text_lower
                    ]
                    if blueprint_matches:
                        signals["blueprint_matches"] = blueprint_matches

                leads.append(
                    DiscoveredLead(
                        platform=ld.get("platform", "other"),
                        summary=ld.get("summary", ""),
                        source_url=ld.get("url", ""),
                        original_text=ld.get("original_text", "")[:1000],
                        search_query=query,
                        relevance_score=score,
                        intent_signals=signals,
                    )
                )

            return leads

        except Exception as e:
            logger.error(f"AI filter error: {e}")
            return []

    # -------------------------------------------------------------------------
    # De-duplication
    # -------------------------------------------------------------------------

    def _deduplicate(
        self, leads: list[DiscoveredLead], existing_urls: set[str]
    ) -> list[DiscoveredLead]:
        """Remove duplicate leads based on URL."""
        seen: set[str] = set()
        unique = []
        for lead in leads:
            normalized = lead.source_url.strip().rstrip("/").lower()
            if normalized and normalized not in existing_urls and normalized not in seen:
                seen.add(normalized)
                unique.append(lead)
        return unique

    # -------------------------------------------------------------------------
    # Sniping Mission (with negative_prompts extraction — SPRINT 12 FIX)
    # -------------------------------------------------------------------------

    def sniping_mission(self, business_id: str, supabase) -> SnipingReport:
        """
        Execute a full sniping mission for a business.

        1. Fetch business industry + location
        2. Build Hebrew search queries
        3. Search via Tavily
        4. Filter via OpenAI (with negative_prompts for niche separation)
        5. De-duplicate against existing leads
        6. Save new leads to leads_discovered
        """
        report = SnipingReport(business_id=business_id)

        # Step 1: Get business details + blueprint
        try:
            biz = (
                supabase.table("businesses")
                .select(
                    "industry, location, address, business_name, industry_blueprint"
                )
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

        # Parse Industry Blueprint
        blueprint = None
        raw_bp = biz.data.get("industry_blueprint")
        if raw_bp:
            try:
                blueprint = (
                    json.loads(raw_bp) if isinstance(raw_bp, str) else raw_bp
                )
            except Exception:
                pass

        # ── SPRINT 12 FIX: Extract negative_prompts from blueprint ───────
        negative_prompts = None
        if blueprint and blueprint.get("negative_prompts"):
            negative_prompts = blueprint["negative_prompts"]
            logger.info(
                f"Loaded {len(negative_prompts)} negative_prompts for "
                f"business {business_id} ({industry})"
            )

        # Step 1b: Get RLHF context
        rlhf_prompt = ""
        score_threshold = 0.5
        intent_phrases = []
        try:
            from services.rlhf_engine import get_rlhf_engine

            engine = get_rlhf_engine()
            rlhf_ctx = engine.get_scoring_context(business_id)
            rlhf_prompt = rlhf_ctx.to_prompt_injection()
            score_threshold = max(0.3, 0.5 + rlhf_ctx.score_threshold_adjustment)
        except Exception as e:
            logger.debug(f"RLHF context unavailable: {e}")

        # Extract intent phrases from blueprint
        if blueprint and blueprint.get("lead_intent_phrases"):
            intent_phrases = blueprint["lead_intent_phrases"]

        # Step 2: Get existing lead URLs for de-duplication
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
        except Exception as e:
            logger.warning(f"Could not load existing leads: {e}")

        # Step 3: Build queries and search
        queries = self._build_search_queries(
            industry, location, biz_name, blueprint=blueprint
        )
        all_leads: list[DiscoveredLead] = []

        extra_domains = None
        if blueprint and blueprint.get("key_platforms"):
            extra_domains = []
            for platform in blueprint["key_platforms"]:
                domain = (
                    platform.get("domain", "")
                    if isinstance(platform, dict)
                    else str(platform)
                )
                if domain and "." in domain:
                    extra_domains.append(domain)

        for q in queries:
            query_text = q["query"]
            report.queries_executed.append(query_text)

            raw_results = self._search_tavily(
                query_text, extra_domains=extra_domains
            )
            report.total_results_scanned += len(raw_results)

            if raw_results:
                # ── SPRINT 12 FIX: Pass negative_prompts to AI filter ────
                leads = self._filter_with_ai(
                    raw_results,
                    industry,
                    location,
                    query_text,
                    biz_name,
                    rlhf_context=rlhf_prompt,
                    score_threshold=score_threshold,
                    intent_phrases=intent_phrases,
                    negative_prompts=negative_prompts,
                )
                all_leads.extend(leads)

        # Step 4: De-duplicate
        unique_leads = self._deduplicate(all_leads, existing_urls)
        report.leads_found = len(unique_leads)

        # Step 5: Save to database
        saved_count = 0
        for lead in unique_leads:
            try:
                row = lead.to_db_row(business_id)
                supabase.table("leads_discovered").insert(row).execute()
                saved_count += 1
                report.leads.append(
                    {
                        "platform": lead.platform,
                        "summary": lead.summary,
                        "url": lead.source_url,
                        "score": lead.relevance_score,
                    }
                )
            except Exception as e:
                report.errors.append(f"Save error: {e}")

        report.leads_saved = saved_count
        logger.info(
            f"Sniping mission complete for {business_id}: "
            f"scanned={report.total_results_scanned}, "
            f"found={report.leads_found}, saved={report.leads_saved}"
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
