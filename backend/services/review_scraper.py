"""
Review Scraper & Analyzer Service.

Fetches reviews for a business using Tavily search,
then uses OpenAI to analyze sentiment, themes, and generate insights.

Returns a structured ReviewAnalysis matching the frontend's expected shape.
"""

import os
import json
import logging
from typing import Optional

import httpx
from openai import OpenAI

logger = logging.getLogger(__name__)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _search_reviews_tavily(business_name: str, location: str) -> list[dict]:
    """Search for reviews of a business using Tavily."""
    if not TAVILY_API_KEY:
        logger.warning("TAVILY_API_KEY not set, skipping review search")
        return []

    queries = [
        f"{business_name} {location} ביקורות Google",
        f"{business_name} {location} reviews",
        f"{business_name} חוות דעת לקוחות",
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
                    all_results.append({
                        "title": r.get("title", ""),
                        "url": url,
                        "content": r.get("content", ""),
                    })
            else:
                logger.debug(
                    f"Tavily returned {resp.status_code} for review query"
                )
        except Exception as e:
            logger.debug(f"Tavily review search error: {e}")

    return all_results


def analyze_reviews(business_id: str) -> dict:
    """
    Full review analysis pipeline for a business.

    1. Look up business info from DB
    2. Search for reviews via Tavily
    3. Analyze with OpenAI for sentiment, themes, suggestions
    4. Return structured ReviewAnalysis

    Returns dict matching the frontend ReviewAnalysis interface.
    """
    supabase = _get_supabase()
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

    # Search for reviews
    raw_results = _search_reviews_tavily(business_name, location)

    if not raw_results:
        return _empty_response(business_name)

    # Analyze with OpenAI
    return _analyze_with_ai(business_name, location, raw_results)


def _analyze_with_ai(
    business_name: str, location: str, raw_results: list[dict]
) -> dict:
    """Use OpenAI to extract reviews and analyze sentiment/themes."""
    if not OPENAI_API_KEY:
        return _empty_response(business_name)

    client = OpenAI(api_key=OPENAI_API_KEY)

    # Combine raw content for analysis
    combined_text = "\n\n---\n\n".join(
        f"Source: {r['url']}\n{r.get('content', '')}"
        for r in raw_results[:10]
    )
    # Truncate to avoid token limits
    if len(combined_text) > 12000:
        combined_text = combined_text[:12000]

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
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
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Business: {business_name}\n"
                        f"Location: {location}\n\n"
                        f"Search results:\n{combined_text}"
                    ),
                },
            ],
        )

        result = json.loads(response.choices[0].message.content)

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
