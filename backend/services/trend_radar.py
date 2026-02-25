"""
Trend Radar & Predictions Service for Quiet Eyes.

Uses Claude to generate:
- Industry trends relevant to a business (for Horizon page Trend Radar)
- Upcoming event predictions (holidays, market events, seasonal trends)

All content is generated in Hebrew, tailored to the Israeli market.
"""

import json
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import anthropic

from services.claude_client import chat as claude_chat
from config import get_settings

logger = logging.getLogger(__name__)


# =============================================================================
# PROMPTS
# =============================================================================

TRENDS_PROMPT = """אתה אנליסט שוק ישראלי.
נתח מגמות עכשוויות עבור: {industry} ב{location}.
שם העסק: {business_name}.
{competitors_context}

החזר JSON בלבד ללא ```json``` או כל טקסט אחר.
הפורמט:
{{"trends": [{{"keyword": "מילה", "title": "כותרת", "analysis": "ניתוח קצר", "action": "המלצה", "level": "breakout", "change_pct": 25.0, "sources": ["Google Trends"], "evidence": ["עובדה"], "relevance_score": 0.8, "urgency": "גבוהה"}}]}}

צור {count} מגמות. level: breakout/emerging/stable. urgency: גבוהה/בינונית/נמוכה.
"""

PREDICTIONS_PROMPT = """אתה אנליסט עסקי ישראלי.
תחזה 6 אירועים קרובים עבור: {industry} ב{location}.
שם העסק: {business_name}.
היום: {current_date}. טווח: {days_ahead} ימים (עד {end_date}).

החזר JSON בלבד ללא ```json``` או כל טקסט אחר.
הפורמט:
{{"events": [{{"name_hebrew": "פסח", "name_english": "Passover", "date": "2026-03-14", "days_until": 16, "duration_days": 7, "business_impact": "high", "relevance": "high", "categories": ["חגים"], "matching_categories": ["ספורט"], "description": "תיאור קצר", "recommendations": ["המלצה 1", "המלצה 2"]}}], "insights": ["תובנה 1", "תובנה 2"]}}

כלול רק 6 אירועים ו-3 תובנות. תיאורים קצרים. מיין לפי קרבה.
"""


# =============================================================================
# FALLBACK DATA (when Claude fails)
# =============================================================================

def _get_fallback_trends(industry: str, location: str) -> list[dict]:
    """Return hardcoded Hebrew trends when Claude is unavailable."""
    now_iso = datetime.now(timezone.utc).isoformat()
    base_trends = [
        {
            "keyword": "דיגיטל",
            "title": f"מעבר דיגיטלי ב{industry}",
            "analysis": f"עסקים בתחום {industry} עוברים לנוכחות דיגיטלית מוגברת. לקוחות מצפים להזמנות אונליין ונוכחות ברשתות חברתיות.",
            "action": "פתחו עמוד עסקי בגוגל ואינסטגרם אם עדיין אין לכם",
            "level": "breakout",
            "change_pct": 35.0,
            "sources": ["Google Trends", "דוח דיגיטל ישראל"],
            "evidence": [f"עלייה בחיפושים אונליין עבור {industry}", "גידול בהזמנות דיגיטליות"],
            "relevance_score": 0.9,
            "urgency": "גבוהה",
        },
        {
            "keyword": "חוויית לקוח",
            "title": "שיפור חוויית הלקוח",
            "analysis": f"לקוחות ב{location} מחפשים חוויה אישית ושירות מותאם. ביקורות גוגל משפיעות על 87% מהצרכנים.",
            "action": "בקשו מלקוחות מרוצים לכתוב ביקורת בגוגל",
            "level": "emerging",
            "change_pct": 18.0,
            "sources": ["סקר צרכנות ישראלי", "Google Reviews"],
            "evidence": ["עלייה בחשיבות ביקורות אונליין", "לקוחות בודקים דירוגים לפני רכישה"],
            "relevance_score": 0.85,
            "urgency": "בינונית",
        },
        {
            "keyword": "מקומיות",
            "title": f"העדפת עסקים מקומיים ב{location}",
            "analysis": "צרכנים ישראלים מעדיפים לתמוך בעסקים מקומיים. מגמה שהתחזקה משמעותית.",
            "action": "הדגישו את הקשר המקומי שלכם בשיווק",
            "level": "stable",
            "change_pct": 8.0,
            "sources": ["מחקר שוק", "רשתות חברתיות"],
            "evidence": [f"גידול בתמיכה בעסקים מקומיים ב{location}"],
            "relevance_score": 0.75,
            "urgency": "נמוכה",
        },
        {
            "keyword": "רשתות חברתיות",
            "title": f"שיווק ברשתות חברתיות ל{industry}",
            "analysis": "אינסטגרם וטיקטוק הפכו לערוצי השיווק המרכזיים לעסקים קטנים בישראל.",
            "action": "צרו תוכן וידאו קצר שמציג את העסק שלכם",
            "level": "breakout",
            "change_pct": 45.0,
            "sources": ["Meta Business", "TikTok Trends"],
            "evidence": ["70% מהצרכנים גילו עסק חדש דרך רשתות חברתיות"],
            "relevance_score": 0.88,
            "urgency": "גבוהה",
        },
    ]
    for i, t in enumerate(base_trends):
        t["id"] = f"trend_{uuid.uuid4().hex[:12]}"
        t["created_at"] = now_iso
    return base_trends


def _get_fallback_predictions(industry: str, location: str) -> list[dict]:
    """Return hardcoded Hebrew predictions when Claude is unavailable."""
    now = datetime.now(timezone.utc)

    # Build events relative to current date
    events = []
    israeli_events = [
        ("פסח", "Passover", 3, 14, 7, "high", "high", ["חגים"], "חג הפסח — תקופת חופשה ומכירות עונתיות."),
        ("יום העצמאות", "Independence Day", 4, 23, 1, "medium", "medium", ["חגים", "אירועים"], "יום העצמאות — אירועים וחגיגות ברחבי הארץ."),
        ("עונת הקיץ", "Summer Season", 6, 1, 90, "high", "high", ["עונתי"], "תחילת עונת הקיץ — שינוי בהרגלי צריכה ופנאי."),
        ("חזרה לשגרה", "Back to School", 9, 1, 14, "high", "medium", ["עונתי", "חינוך"], "חזרה ללימודים — ביקוש גובר למוצרים ושירותים."),
        ("ראש השנה", "Rosh Hashanah", 9, 22, 2, "high", "high", ["חגים"], "ראש השנה — תקופת חגים וצריכה מוגברת."),
        ("סוכות", "Sukkot", 10, 6, 7, "medium", "medium", ["חגים"], "סוכות — חופשה ופעילויות חוץ."),
        ("חנוכה", "Hanukkah", 12, 14, 8, "high", "high", ["חגים", "מכירות"], "חנוכה — מתנות, מכירות, ואירועי חורף."),
        ("Black Friday", "Black Friday", 11, 28, 3, "high", "medium", ["מכירות"], "בלאק פריידיי — מבצעים גדולים וביקוש שיא."),
    ]

    for name_he, name_en, month, day, duration, impact, relevance, cats, desc in israeli_events:
        try:
            event_date = datetime(now.year, month, day, tzinfo=timezone.utc)
            if event_date < now:
                event_date = datetime(now.year + 1, month, day, tzinfo=timezone.utc)
            days_until = (event_date - now).days
            if days_until > 365:
                continue
            events.append({
                "name_hebrew": name_he,
                "name_english": name_en,
                "date": event_date.strftime("%Y-%m-%d"),
                "days_until": max(1, days_until),
                "duration_days": duration,
                "business_impact": impact,
                "relevance": relevance,
                "categories": cats,
                "matching_categories": [industry] if industry else [],
                "description": desc,
                "recommendations": [
                    f"התכוננו עם מבצעים מיוחדים ל{name_he}",
                    f"עדכנו את הנוכחות הדיגיטלית לקראת {name_he}",
                ],
            })
        except (ValueError, OverflowError):
            continue

    events.sort(key=lambda e: e["days_until"])

    insights = [
        f"התקופה הקרובה כוללת מספר חגים ישראליים — הכינו מבצעים מראש.",
        f"עסקי {industry} ב{location} יכולים להרוויח מאירועים עונתיים עם תכנון מוקדם.",
        "מומלץ לתכנן קמפיינים שיווקיים 2-3 שבועות לפני כל אירוע.",
    ]

    return events, insights


# =============================================================================
# BUSINESS LOOKUP HELPERS
# =============================================================================

def _lookup_business(user_id: str, supabase_client) -> Optional[dict]:
    """
    Look up the business record for a given user_id.

    Returns dict with business fields or None if not found.
    """
    try:
        result = (
            supabase_client.table("businesses")
            .select("id, business_name, industry, location, address")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data[0]
    except Exception as e:
        logger.error(f"Failed to look up business for user {user_id}: {e}")
    return None


def _lookup_competitors(business_id: str, supabase_client) -> list[dict]:
    """
    Look up competitors for a given business.

    Returns list of competitor dicts.
    """
    try:
        result = (
            supabase_client.table("competitors")
            .select("name, description, perceived_threat_level")
            .eq("business_id", business_id)
            .limit(10)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to look up competitors for business {business_id}: {e}")
        return []


# =============================================================================
# TREND GENERATION
# =============================================================================

def generate_trends(business_id: str, supabase_client, count: int = 6) -> list[dict]:
    """
    Generate industry trends for a business using Claude.

    Args:
        business_id: The business UUID
        supabase_client: Authenticated Supabase client
        count: Number of trends to generate (5-8 recommended)

    Returns:
        List of trend dicts matching the TrendItem interface.
        Returns empty list on failure.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        logger.warning("Anthropic API key not configured, cannot generate trends")
        return []

    # Look up business info
    try:
        biz_result = (
            supabase_client.table("businesses")
            .select("business_name, industry, location, address")
            .eq("id", business_id)
            .limit(1)
            .execute()
        )
        if not biz_result.data:
            logger.warning(f"Business {business_id} not found")
            return []
        biz = biz_result.data[0]
    except Exception as e:
        logger.error(f"Failed to look up business {business_id}: {e}")
        return []

    business_name = biz.get("business_name", "")
    industry = biz.get("industry", "")
    location = biz.get("location") or biz.get("address") or ""

    # Look up competitors for context
    competitors = _lookup_competitors(business_id, supabase_client)
    competitors_context = ""
    if competitors:
        comp_lines = []
        for c in competitors[:5]:
            name = c.get("name", "")
            desc = c.get("description", "")
            threat = c.get("perceived_threat_level", "")
            comp_lines.append(f"  - {name}: {desc} (רמת איום: {threat})")
        competitors_context = "- מתחרים:\n" + "\n".join(comp_lines)

    # Build prompt
    prompt = TRENDS_PROMPT.format(
        business_name=business_name,
        industry=industry,
        location=location,
        competitors_context=competitors_context,
        count=count,
    )

    # Call Claude
    try:
        system_prompt = "אתה מחזיר JSON בלבד. ללא הסברים, ללא markdown, רק JSON."

        content = claude_chat(
            messages=[{"role": "user", "content": prompt}],
            system=system_prompt,
            temperature=0.7,
            max_tokens=4000,
        )

        # Strip markdown code fences if present
        content = (content or "").strip()
        if "```" in content:
            parts = content.split("```")
            for part in parts:
                clean = part.strip()
                if clean.startswith("json"):
                    clean = clean[4:].strip()
                if clean.startswith("{") or clean.startswith("["):
                    content = clean
                    break

        if not content:
            logger.warning("Claude returned empty trends response, using fallback")
            return _get_fallback_trends(industry, location)

        parsed = json.loads(content)

        # Extract trends array from response
        trends_data = _extract_list(parsed, "trends")

        if not trends_data:
            logger.warning("Claude returned no trends data, using fallback")
            return _get_fallback_trends(industry, location)

        now_iso = datetime.now(timezone.utc).isoformat()

        trends = []
        for item in trends_data[:count]:
            trend = {
                "id": f"trend_{uuid.uuid4().hex[:12]}",
                "keyword": item.get("keyword", ""),
                "title": item.get("title", ""),
                "analysis": item.get("analysis", ""),
                "action": item.get("action", ""),
                "level": _validate_level(item.get("level", "emerging")),
                "change_pct": float(item.get("change_pct", 0)),
                "sources": item.get("sources", []),
                "evidence": item.get("evidence", []),
                "relevance_score": _clamp(float(item.get("relevance_score", 0.5)), 0.0, 1.0),
                "urgency": item.get("urgency", "בינונית"),
                "created_at": now_iso,
            }
            trends.append(trend)

        logger.info(f"Generated {len(trends)} trends for business {business_id}")
        return trends

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse trends response: {e}, using fallback")
        return _get_fallback_trends(industry, location)
    except anthropic.APIError as e:
        logger.error(f"Claude API error during trend generation: {e}, using fallback")
        return _get_fallback_trends(industry, location)
    except Exception as e:
        logger.error(f"Unexpected error generating trends: {e}, using fallback")
        return _get_fallback_trends(industry, location)


# =============================================================================
# PREDICTIONS GENERATION
# =============================================================================

def generate_predictions(business_id: str, supabase_client, days_ahead: int = 90) -> dict:
    """
    Generate upcoming market event predictions for a business using Claude.

    Args:
        business_id: The business UUID
        supabase_client: Authenticated Supabase client
        days_ahead: Number of days to look ahead (default 90)

    Returns:
        Dict matching the PredictionsData interface:
        {
            "events": [...],
            "business_context": {...},
            "insights": [...]
        }
        Returns empty structure on failure.
    """
    settings = get_settings()
    empty_response = {
        "events": [],
        "business_context": {
            "id": business_id,
            "name": "",
            "name_hebrew": "",
            "industry": "",
            "detected_categories": [],
        },
        "insights": [],
    }

    if not settings.anthropic_api_key:
        logger.warning("Anthropic API key not configured, cannot generate predictions")
        return empty_response

    # Look up business info
    try:
        biz_result = (
            supabase_client.table("businesses")
            .select("business_name, industry, location, address")
            .eq("id", business_id)
            .limit(1)
            .execute()
        )
        if not biz_result.data:
            logger.warning(f"Business {business_id} not found")
            return empty_response
        biz = biz_result.data[0]
    except Exception as e:
        logger.error(f"Failed to look up business {business_id}: {e}")
        return empty_response

    business_name = biz.get("business_name", "")
    industry = biz.get("industry", "")
    location = biz.get("location") or biz.get("address") or ""
    detected_categories = []

    # Update empty_response with actual business context for error fallbacks
    empty_response["business_context"] = {
        "id": business_id,
        "name": business_name,
        "name_hebrew": business_name,
        "industry": industry,
        "detected_categories": detected_categories,
    }

    # Calculate dates
    now = datetime.now(timezone.utc)
    current_date = now.strftime("%Y-%m-%d")
    end_date_dt = now + timedelta(days=days_ahead)
    end_date = end_date_dt.strftime("%Y-%m-%d")

    # Build prompt
    prompt = PREDICTIONS_PROMPT.format(
        business_name=business_name,
        industry=industry,
        location=location,
        current_date=current_date,
        days_ahead=days_ahead,
        end_date=end_date,
    )

    # Call Claude
    try:
        system_prompt = "אתה מחזיר JSON בלבד. ללא הסברים, ללא markdown, רק JSON."

        content = claude_chat(
            messages=[{"role": "user", "content": prompt}],
            system=system_prompt,
            temperature=0.6,
            max_tokens=4000,
        )

        # Strip markdown code fences if present
        content = (content or "").strip()
        if "```" in content:
            parts = content.split("```")
            for part in parts:
                clean = part.strip()
                if clean.startswith("json"):
                    clean = clean[4:].strip()
                if clean.startswith("{") or clean.startswith("["):
                    content = clean
                    break

        if not content:
            logger.warning("Claude returned empty predictions response, using fallback")
            fb_events, fb_insights = _get_fallback_predictions(industry, location)
            empty_response["events"] = fb_events
            empty_response["insights"] = fb_insights
            return empty_response

        parsed = json.loads(content)

        # Extract events and insights
        events_data = _extract_list(parsed, "events")
        insights_data = _extract_list(parsed, "insights")

        if not events_data:
            logger.warning("Claude returned no prediction events, using fallback")
            fb_events, fb_insights = _get_fallback_predictions(industry, location)
            empty_response["events"] = fb_events
            empty_response["insights"] = fb_insights
            return empty_response

        # Validate and normalize events
        events = []
        for item in events_data:
            event = {
                "name_hebrew": item.get("name_hebrew", ""),
                "name_english": item.get("name_english", ""),
                "date": item.get("date", ""),
                "days_until": int(item.get("days_until", 0)),
                "duration_days": int(item.get("duration_days", 1)),
                "business_impact": _validate_impact(item.get("business_impact", "medium")),
                "relevance": _validate_impact(item.get("relevance", "medium")),
                "categories": item.get("categories", []),
                "matching_categories": item.get("matching_categories", []),
                "description": item.get("description", ""),
                "recommendations": item.get("recommendations", []),
            }
            events.append(event)

        # Sort by days_until (closest first)
        events.sort(key=lambda e: e["days_until"])

        # Ensure insights are strings
        insights = [str(i) for i in insights_data if i]

        result = {
            "events": events,
            "business_context": {
                "id": business_id,
                "name": business_name,
                "name_hebrew": business_name,
                "industry": industry,
                "detected_categories": detected_categories,
            },
            "insights": insights,
        }

        logger.info(
            f"Generated {len(events)} predictions and {len(insights)} insights "
            f"for business {business_id}"
        )
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse predictions response: {e}, using fallback")
        fb_events, fb_insights = _get_fallback_predictions(industry, location)
        empty_response["events"] = fb_events
        empty_response["insights"] = fb_insights
        return empty_response
    except anthropic.APIError as e:
        logger.error(f"Claude API error during prediction generation: {e}, using fallback")
        fb_events, fb_insights = _get_fallback_predictions(industry, location)
        empty_response["events"] = fb_events
        empty_response["insights"] = fb_insights
        return empty_response
    except Exception as e:
        logger.error(f"Unexpected error generating predictions: {e}, using fallback")
        fb_events, fb_insights = _get_fallback_predictions(industry, location)
        empty_response["events"] = fb_events
        empty_response["insights"] = fb_insights
        return empty_response


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _extract_list(parsed: dict | list, key: str) -> list:
    """
    Extract a list from parsed JSON. Handles various response shapes Claude may return.
    """
    if isinstance(parsed, list):
        return parsed

    if isinstance(parsed, dict):
        # Try the expected key first
        if key in parsed and isinstance(parsed[key], list):
            return parsed[key]
        # Try common wrapper keys
        for fallback_key in ["data", "items", "results"]:
            if fallback_key in parsed and isinstance(parsed[fallback_key], list):
                return parsed[fallback_key]
        # Try first list value found
        for value in parsed.values():
            if isinstance(value, list):
                return value

    return []


def _validate_level(level: str) -> str:
    """Validate trend level, defaulting to 'emerging'."""
    valid = {"breakout", "emerging", "stable"}
    return level if level in valid else "emerging"


def _validate_impact(impact: str) -> str:
    """Validate impact/relevance level, defaulting to 'medium'."""
    valid = {"high", "medium", "low"}
    return impact if impact in valid else "medium"


def _clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp a value between min and max."""
    return max(min_val, min(max_val, value))


# =============================================================================
# CONVENIENCE FUNCTIONS FOR ROUTER
# =============================================================================

def get_trends_for_user(user_id: str, supabase_client) -> list[dict]:
    """
    Look up user's business and generate trends.

    This is the main entry point called from the router.

    Args:
        user_id: The authenticated user's UUID
        supabase_client: Authenticated Supabase client

    Returns:
        List of trend dicts matching TrendItem interface.
        Returns empty list if business not found or on error.
    """
    business = _lookup_business(user_id, supabase_client)
    if not business:
        logger.warning(f"No business found for user {user_id}, cannot generate trends")
        return []

    business_id = business["id"]
    return generate_trends(business_id, supabase_client)


def get_predictions_for_user(user_id: str, supabase_client, days_ahead: int = 90) -> dict:
    """
    Look up user's business and generate predictions.

    This is the main entry point called from the router.

    Args:
        user_id: The authenticated user's UUID
        supabase_client: Authenticated Supabase client
        days_ahead: Number of days to look ahead

    Returns:
        Dict matching PredictionsData interface.
        Returns empty structure if business not found or on error.
    """
    business = _lookup_business(user_id, supabase_client)
    if not business:
        logger.warning(f"No business found for user {user_id}, cannot generate predictions")
        return {
            "events": [],
            "business_context": {
                "id": "",
                "name": "",
                "name_hebrew": "",
                "industry": "",
                "detected_categories": [],
            },
            "insights": [],
        }

    business_id = business["id"]
    return generate_predictions(business_id, supabase_client, days_ahead=days_ahead)
