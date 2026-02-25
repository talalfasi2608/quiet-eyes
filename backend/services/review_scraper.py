"""
Review Scraper & Analyzer Service.

Fetches reviews for a business using Tavily search,
then uses Claude to analyze sentiment, themes, and generate insights.

Returns a structured ReviewAnalysis matching the frontend's expected shape.
"""

import os
import json
import logging
from typing import Optional

import httpx

from services.claude_client import chat as claude_chat

logger = logging.getLogger(__name__)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _search_reviews_tavily(business_name: str, location: str) -> list[dict]:
    """Search for reviews of a business using Tavily."""
    if not TAVILY_API_KEY:
        logger.warning("TAVILY_API_KEY not set, skipping review search")
        return []

    # Multi-source queries: Google, Wolt, TripAdvisor, Instagram, Facebook, Rest
    queries = [
        f"{business_name} {location} reviews",
        f"{business_name} {location} ביקורות",
        f"{business_name} site:wolt.com",
        f"{business_name} site:tripadvisor.com reviews",
        f"{business_name} site:instagram.com",
        f"{business_name} {location} חוות דעת לקוחות",
        f"{business_name} rest.co.il OR 10bis.co.il OR wolt.com ביקורות",
    ]

    all_results = []
    seen_urls = set()
    for query in queries:
        try:
            resp = httpx.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "max_results": 5,
                    "search_depth": "basic",
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                for r in data.get("results", []):
                    url = r.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)
                    # Detect source platform from URL
                    source = "google"
                    if "wolt.com" in url:
                        source = "wolt"
                    elif "tripadvisor" in url:
                        source = "tripadvisor"
                    elif "instagram.com" in url:
                        source = "instagram"
                    elif "facebook.com" in url:
                        source = "facebook"
                    elif "rest.co.il" in url:
                        source = "rest"
                    elif "10bis" in url:
                        source = "10bis"
                    all_results.append({
                        "title": r.get("title", ""),
                        "url": url,
                        "content": r.get("content", ""),
                        "source": source,
                    })
            else:
                logger.debug(
                    f"Tavily returned {resp.status_code} for review query"
                )
        except Exception as e:
            logger.debug(f"Tavily review search error: {e}")

    return all_results


def analyze_reviews(business_id: str, supabase_client=None) -> dict:
    """
    Full review analysis pipeline for a business.

    1. Look up business info from DB
    2. Search for reviews via Tavily
    3. Analyze with Claude for sentiment, themes, suggestions
    4. Return structured ReviewAnalysis

    Returns dict matching the frontend ReviewAnalysis interface.
    """
    supabase = supabase_client or _get_service_client() or _get_supabase()
    if not supabase:
        return _error_response("Database unavailable")

    # Get business info
    try:
        biz = (
            supabase.table("businesses")
            .select("business_name, industry, location")
            .eq("id", business_id)
            .single()
            .execute()
        )
        if not biz.data:
            return _error_response("Business not found")
    except Exception as e:
        logger.error(f"Business lookup failed: {e}")
        return _error_response("Business lookup failed")

    business_name = biz.data.get("business_name", "")
    location = biz.data.get("location", "")

    industry = biz.data.get("industry", "")

    # Search for reviews
    raw_results = _search_reviews_tavily(business_name, location)

    if not raw_results:
        # Fallback: synthesize analysis from DB data (competitors, leads, intelligence)
        return _synthesize_from_db(business_id, business_name, industry, location)

    # Analyze with Claude
    result = _analyze_with_ai(business_name, location, raw_results, business_id)

    # If AI analysis found no real reviews/themes, supplement with DB synthesis
    if result.get("reviews_count", 0) == 0 and len(result.get("themes", [])) == 0:
        db_result = _synthesize_from_db(business_id, business_name, industry, location)
        if db_result.get("themes"):
            # Merge: keep any suggestions from Tavily analysis, add DB themes
            result["themes"] = db_result.get("themes", [])
            result["overall_score"] = db_result.get("overall_score", result.get("overall_score", 0))
            result["overall_sentiment"] = db_result.get("overall_sentiment", result.get("overall_sentiment", ""))
            result["sentiment_breakdown"] = db_result.get("sentiment_breakdown", result.get("sentiment_breakdown", {}))
            result["strengths_summary"] = db_result.get("strengths_summary", "")
            result["weaknesses_summary"] = db_result.get("weaknesses_summary", "")
            if not result.get("improvement_suggestions"):
                result["improvement_suggestions"] = db_result.get("improvement_suggestions", [])

    return result


def _get_knowledge_context(business_id: str = None) -> str:
    """Fetch knowledge base context for the business to enhance AI analysis."""
    if not business_id:
        return ""
    try:
        from services.ai_engine import _build_knowledge_context
        return _build_knowledge_context(business_id)
    except Exception:
        return ""


def _analyze_with_ai(
    business_name: str, location: str, raw_results: list[dict],
    business_id: str = None,
) -> dict:
    """Use Claude to extract reviews and analyze sentiment/themes."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return _empty_response(business_name)

    knowledge_ctx = _get_knowledge_context(business_id)

    # Combine raw content for analysis
    combined_text = "\n\n---\n\n".join(
        f"Source: {r['url']}\n{r.get('content', '')}"
        for r in raw_results[:10]
    )
    # Truncate to avoid token limits
    if len(combined_text) > 12000:
        combined_text = combined_text[:12000]

    system_prompt = (
        "You are a business review analyst specializing in Israeli businesses. "
        "Analyze the following web search results about a business and extract "
        "real customer reviews and sentiment analysis.\n\n"
        "Return a JSON object with this EXACT structure:\n"
        "{\n"
        '  "reviews": [\n'
        "    {\n"
        '      "author": "Customer name or Anonymous",\n'
        '      "rating": 4.5,\n'
        '      "text": "The full review text",\n'
        '      "relative_publish_time": "2 weeks ago",\n'
        '      "author_photo": ""\n'
        "    }\n"
        "  ],\n"
        '  "themes": [\n'
        "    {\n"
        '      "theme": "Hebrew theme name",\n'
        '      "theme_english": "English theme name",\n'
        '      "sentiment": "positive|negative|neutral",\n'
        '      "frequency": 3,\n'
        '      "examples": ["quote 1", "quote 2"],\n'
        '      "description": "Brief description"\n'
        "    }\n"
        "  ],\n"
        '  "overall_sentiment": "mostly positive / mixed / mostly negative",\n'
        '  "sentiment_breakdown": {"positive": 60, "negative": 20, "neutral": 20},\n'
        '  "overall_score": 78,\n'
        '  "improvement_suggestions": ["suggestion 1 in Hebrew", "suggestion 2"],\n'
        '  "strengths_summary": "Summary of strengths in Hebrew",\n'
        '  "weaknesses_summary": "Summary of weaknesses in Hebrew"\n'
        "}\n\n"
        "IMPORTANT:\n"
        "- Extract REAL reviews from the content, do not fabricate\n"
        "- If no reviews found, return empty arrays\n"
        "- overall_score is 0-100\n"
        "- sentiment_breakdown percentages must sum to 100\n"
        "- Write themes, suggestions, summaries in Hebrew\n"
        "- IMPORTANT: Analyze ALL sources (Google, Wolt, TripAdvisor, Instagram, Facebook, Rest.co.il)\n"
        "- In each review, add a 'source' field indicating the platform (google/wolt/tripadvisor/instagram/etc)\n"
        "Always respond with valid JSON only."
        + (f"\n{knowledge_ctx}" if knowledge_ctx else "")
    )

    user_content = (
        f"Business: {business_name}\n"
        f"Location: {location}\n\n"
        f"Search results:\n{combined_text}"
    )

    try:
        raw_response = claude_chat(
            messages=[{"role": "user", "content": user_content}],
            system=system_prompt,
            temperature=0.2,
            max_tokens=4000,
        )

        # Strip markdown code fences if present
        text = raw_response.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3].strip()

        result = json.loads(text)

        return {
            "success": True,
            "business_name": business_name,
            "reviews_count": len(result.get("reviews", [])),
            "reviews": result.get("reviews", []),
            "themes": result.get("themes", []),
            "overall_sentiment": result.get("overall_sentiment", ""),
            "sentiment_breakdown": result.get(
                "sentiment_breakdown", {"positive": 0, "negative": 0, "neutral": 0}
            ),
            "overall_score": result.get("overall_score", 0),
            "improvement_suggestions": result.get("improvement_suggestions", []),
            "strengths_summary": result.get("strengths_summary", ""),
            "weaknesses_summary": result.get("weaknesses_summary", ""),
        }

    except Exception as e:
        logger.error(f"AI review analysis failed: {e}")
        return _empty_response(business_name)


def _synthesize_from_db(business_id: str, business_name: str, industry: str, location: str) -> dict:
    """
    When Tavily finds no web reviews, synthesize a business health analysis
    from DB data (competitors, leads, intelligence events) using Claude.
    """
    supabase = _get_service_client() or _get_supabase()
    if not supabase:
        return _empty_response(business_name)

    # Gather DB context
    context_parts = [f"עסק: {business_name}", f"תעשייה: {industry}", f"מיקום: {location}"]

    try:
        comps = supabase.table("competitors").select("name, perceived_threat_level, google_rating, google_reviews_count").eq("business_id", business_id).limit(10).execute()
        if comps.data:
            context_parts.append(f"\nמתחרים ({len(comps.data)}):")
            for c in comps.data:
                context_parts.append(f"- {c.get('name','?')}: דירוג {c.get('google_rating','?')}, {c.get('google_reviews_count',0)} ביקורות, איום {c.get('perceived_threat_level','?')}")
    except Exception:
        pass

    try:
        leads = supabase.table("leads_discovered").select("summary, platform, relevance_score").eq("business_id", business_id).limit(10).execute()
        if leads.data:
            context_parts.append(f"\nלידים ({len(leads.data)}):")
            for l in leads.data[:5]:
                context_parts.append(f"- {l.get('summary','?')} ({l.get('platform','?')}, רלוונטיות: {l.get('relevance_score','?')})")
    except Exception:
        pass

    try:
        events = supabase.table("intelligence_events").select("event_type, title, severity").eq("business_id", business_id).order("created_at", desc=True).limit(10).execute()
        if events.data:
            context_parts.append(f"\nאירועי מודיעין ({len(events.data)}):")
            for e in events.data[:5]:
                context_parts.append(f"- [{e.get('severity','?')}] {e.get('title','?')}")
    except Exception:
        pass

    db_context = "\n".join(context_parts)

    if not os.getenv("ANTHROPIC_API_KEY"):
        return _empty_response(business_name)

    knowledge_ctx = _get_knowledge_context(business_id)

    system_prompt = (
        "You are a business health analyst specializing in Israeli businesses. "
        "The business has no online reviews found, but you have internal data. "
        "Analyze the business health based on competitive landscape, leads, and intelligence events.\n\n"
        "Return a JSON object with this EXACT structure:\n"
        "{\n"
        '  "reviews": [],\n'
        '  "themes": [\n'
        "    {\n"
        '      "theme": "Hebrew theme name",\n'
        '      "theme_english": "English theme name",\n'
        '      "sentiment": "positive|negative|neutral",\n'
        '      "frequency": 3,\n'
        '      "examples": ["insight 1", "insight 2"],\n'
        '      "description": "Brief description in Hebrew"\n'
        "    }\n"
        "  ],\n"
        '  "overall_sentiment": "mostly positive / mixed / mostly negative",\n'
        '  "sentiment_breakdown": {"positive": 60, "negative": 20, "neutral": 20},\n'
        '  "overall_score": 72,\n'
        '  "improvement_suggestions": ["suggestion 1 in Hebrew", "suggestion 2"],\n'
        '  "strengths_summary": "Summary of strengths in Hebrew",\n'
        '  "weaknesses_summary": "Summary of weaknesses in Hebrew"\n'
        "}\n\n"
        "IMPORTANT:\n"
        "- Generate 3-5 themes based on the data (competitive position, market presence, lead quality, etc)\n"
        "- overall_score is 0-100 based on competitive standing and business health\n"
        "- sentiment_breakdown percentages must sum to 100\n"
        "- Write everything in Hebrew\n"
        "- Generate 3-5 actionable improvement suggestions\n"
        "- reviews array should be empty (no fabricated reviews)\n"
        "Always respond with valid JSON only."
        + (f"\n{knowledge_ctx}" if knowledge_ctx else "")
    )

    try:
        raw_response = claude_chat(
            messages=[{"role": "user", "content": f"נתח את בריאות העסק:\n\n{db_context}"}],
            system=system_prompt,
            temperature=0.3,
            max_tokens=4000,
        )

        # Strip markdown code fences if present
        text = raw_response.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3].strip()

        result = json.loads(text)

        return {
            "success": True,
            "business_name": business_name,
            "reviews_count": 0,
            "reviews": [],
            "themes": result.get("themes", []),
            "overall_sentiment": result.get("overall_sentiment", ""),
            "sentiment_breakdown": result.get(
                "sentiment_breakdown", {"positive": 0, "negative": 0, "neutral": 0}
            ),
            "overall_score": result.get("overall_score", 0),
            "improvement_suggestions": result.get("improvement_suggestions", []),
            "strengths_summary": result.get("strengths_summary", ""),
            "weaknesses_summary": result.get("weaknesses_summary", ""),
        }

    except Exception as e:
        logger.error(f"AI synthesis failed: {e}")
        return _empty_response(business_name)


def _empty_response(business_name: str) -> dict:
    """Return an empty but valid response when no reviews found."""
    return {
        "success": True,
        "business_name": business_name,
        "reviews_count": 0,
        "reviews": [],
        "themes": [],
        "overall_sentiment": "no data",
        "sentiment_breakdown": {"positive": 0, "negative": 0, "neutral": 0},
        "overall_score": 0,
        "improvement_suggestions": [],
        "strengths_summary": "",
        "weaknesses_summary": "",
    }


def _error_response(message: str) -> dict:
    """Return an error response."""
    return {
        "success": False,
        "business_name": "",
        "reviews_count": 0,
        "reviews": [],
        "themes": [],
        "overall_sentiment": "",
        "sentiment_breakdown": {"positive": 0, "negative": 0, "neutral": 0},
        "overall_score": 0,
        "improvement_suggestions": [],
        "strengths_summary": "",
        "weaknesses_summary": "",
        "error": message,
    }
