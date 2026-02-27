"""
Marketing Intelligence Router.

AI-powered marketing recommendations for businesses:
- GET  /marketing-intel/report/{business_id}         — full marketing report
- POST /marketing-intel/report/{business_id}/refresh  — force-refresh report
- POST /marketing-intel/weekly-plan/{business_id}     — generate weekly content plan
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request, Depends

from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/marketing-intel", tags=["Marketing Intelligence"])

# In-memory cache: { business_id: { "report": {...}, "generated_at": datetime } }
_report_cache: dict = {}
_CACHE_TTL_HOURS = 24


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


def _verify_business_owner(supabase, business_id: str, auth_user_id: str):
    """Verify the authenticated user owns this business. Raises 403 if not."""
    try:
        result = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
        if result.data and result.data[0].get("user_id") == auth_user_id:
            return
    except Exception:
        pass
    raise HTTPException(status_code=403, detail="Access denied")


def _fetch_leads_data(sb, business_id: str) -> dict:
    """Fetch leads summary for the business."""
    try:
        result = (
            sb.table("leads")
            .select("source, search_query, created_at")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        leads = result.data or []
        # Extract top search queries / keywords
        queries = [l.get("search_query", "") for l in leads if l.get("search_query")]
        sources = [l.get("source", "") for l in leads if l.get("source")]
        return {
            "total_leads": len(leads),
            "top_queries": queries[:10],
            "sources": list(set(sources))[:5],
        }
    except Exception as e:
        logger.debug(f"Leads fetch for marketing report: {e}")
        return {"total_leads": 0, "top_queries": [], "sources": []}


@router.get("/report/{business_id}")
async def get_marketing_report(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Generate a full marketing intelligence report for a business."""
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    # Check cache
    cached = _report_cache.get(business_id)
    if cached:
        age = datetime.now(timezone.utc) - cached["generated_at"]
        if age < timedelta(hours=_CACHE_TTL_HOURS):
            return {"success": True, "report": cached["report"], "cached": True}

    try:
        # Fetch business info
        biz_result = (
            sb.table("businesses")
            .select("*")
            .eq("id", business_id)
            .execute()
        )
        if not biz_result.data:
            raise HTTPException(status_code=404, detail="Business not found")

        business = biz_result.data[0]

        # Fetch competitors
        comp_result = (
            sb.table("competitors")
            .select("name, industry, location, google_rating, google_reviews_count, website, perceived_threat_level")
            .eq("business_id", business_id)
            .execute()
        )
        competitors = comp_result.data or []

        # Fetch leads data
        leads_data = _fetch_leads_data(sb, business_id)

        # Generate report via Claude
        report = await _generate_marketing_report(business, competitors, leads_data)

        # Cache results
        _report_cache[business_id] = {
            "report": report,
            "generated_at": datetime.now(timezone.utc),
        }

        return {"success": True, "report": report, "cached": False}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Marketing report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate marketing report")


@router.post("/report/{business_id}/refresh")
async def refresh_marketing_report(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Force-refresh the marketing intelligence report (invalidates cache)."""
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    # Clear cache for this business
    _report_cache.pop(business_id, None)

    # Re-generate
    return await get_marketing_report(business_id, request, auth_user_id)


@router.post("/weekly-plan/{business_id}")
async def generate_weekly_plan(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Generate a new weekly content plan."""
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        biz_result = sb.table("businesses").select("*").eq("id", business_id).execute()
        if not biz_result.data:
            raise HTTPException(status_code=404, detail="Business not found")

        business = biz_result.data[0]
        plan = await _generate_weekly_plan(business)
        return {"success": True, "weekly_plan": plan}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Weekly plan generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate weekly plan")


async def _generate_marketing_report(business: dict, competitors: list, leads_data: dict) -> dict:
    """Use Claude to generate a comprehensive marketing intelligence report."""
    try:
        from services.claude_client import chat as claude_chat
    except Exception:
        logger.error("Claude client not available")
        return _empty_report()

    biz_name = business.get("business_name", "Unknown")
    biz_industry = business.get("industry", "General")
    biz_location = business.get("location", "")
    biz_type = business.get("business_type", "")
    biz_desc = business.get("business_description", "")
    target_audience = business.get("target_audience", "")
    ideal_customer = business.get("ideal_customer", "")
    search_keywords = business.get("search_keywords", "")
    radius_km = business.get("activity_radius_km", 5)
    priorities = business.get("priorities", "")

    # Build competitor summary
    comp_summary = ""
    comp_names = []
    if competitors:
        comp_lines = []
        for c in competitors[:5]:
            name = c.get("name", "Unknown")
            comp_names.append(name)
            line = f"- {name}"
            if c.get("google_rating"):
                line += f" (דירוג: {c['google_rating']}, {c.get('google_reviews_count', 0)} ביקורות)"
            if c.get("website"):
                line += f" | אתר: {c['website']}"
            if c.get("perceived_threat_level"):
                line += f" | רמת איום: {c['perceived_threat_level']}"
            comp_lines.append(line)
        comp_summary = "\n".join(comp_lines)

    # Build leads summary
    leads_summary = f"Total leads analyzed: {leads_data['total_leads']}"
    if leads_data["top_queries"]:
        leads_summary += f"\nTop search queries from leads: {', '.join(leads_data['top_queries'][:8])}"
    if leads_data["sources"]:
        leads_summary += f"\nLead sources: {', '.join(leads_data['sources'])}"

    prompt = f"""אתה יועץ שיווק דיגיטלי מומחה לשוק הישראלי.
נתח את הנתונים הבאים ותן המלצות מותאמות אישית.

=== נתוני העסק ===
שם עסק: {biz_name}
ענף: {biz_industry}
סוג עסק: {biz_type}
מיקום: {biz_location}
רדיוס פעילות: {radius_km} ק"מ
תיאור: {biz_desc}
קהל יעד: {target_audience}
לקוח אידיאלי: {ideal_customer}
מילות מפתח: {search_keywords}
עדיפויות: {priorities}

=== מתחרים שנמצאו ({len(competitors)}) ===
{comp_summary if comp_summary else "לא נמצאו מתחרים עדיין"}

=== לידים שנותחו ===
{leads_summary}

=== הנחיות ===
החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):

{{
  "audience_profile": {{
    "age_range": "טווח גילאים, לדוגמה: 28-45",
    "gender": "תיאור מגדר עם אחוז, לדוגמה: נשים (72%)",
    "area": "תיאור אזור ביחס לעסק, לדוגמה: ברדיוס 3 ק״מ מהעסק",
    "networks": "רשתות חברתיות עיקריות, לדוגמה: פייסבוק, אינסטגרם",
    "active_hours": "שעות פעילות מקוונת, לדוגמה: 19:00-22:00",
    "search_terms": ["מילת חיפוש 1", "מילת חיפוש 2", "מילת חיפוש 3"]
  }},
  "channel_recommendations": [
    {{
      "name": "שם הערוץ בעברית (לדוגמה: פייסבוק)",
      "icon": "facebook|instagram|google_ads|seo|whatsapp",
      "stars": 1-5,
      "description": "הסבר למה הערוץ מתאים (3-4 משפטים בעברית)",
      "budget": "תקציב חודשי מומלץ בשקלים",
      "roi": "ROI צפוי כמספר לקוחות חדשים לדוגמה: 3-5 לקוחות חדשים"
    }}
  ],
  "winning_messages": [
    {{
      "text": "טקסט המסר המלא בעברית",
      "usage_tips": ["טיפ שימוש 1 בעברית", "טיפ שימוש 2 בעברית"]
    }}
  ],
  "competitor_table": [
    {{
      "name": "שם המתחרה",
      "active_channels": "ערוצים פעילים, לדוגמה: FB + IG",
      "posting_frequency": "תדירות פרסום, לדוגמה: 5x/שבוע",
      "estimated_success": 1-5
    }}
  ],
  "competitor_insight": "תובנה מרכזית על המתחרים - משפט אחד עם הזדמנות ברורה",
  "weekly_plan": {{
    "sunday": {{ "icon": "facebook|instagram|whatsapp|seo|google_ads", "action": "פוסט פייסבוק", "topic": "נושא מוצע בעברית" }},
    "monday": {{ "icon": "instagram", "action": "סטורי אינסטגרם", "topic": "נושא מוצע בעברית" }},
    "tuesday": {{ "icon": "facebook", "action": "תגובה לקבוצה", "topic": "שם קבוצה מומלצת" }},
    "wednesday": {{ "icon": "facebook", "action": "פוסט פייסבוק", "topic": "נושא מוצע בעברית" }},
    "thursday": {{ "icon": "seo", "action": "שתף תוכן ערך", "topic": "רעיון בעברית" }},
    "friday": {{ "icon": "google_ads", "action": "פרסום ממומן", "topic": "קהל + מסר בעברית" }}
  }}
}}

חשוב:
- צור בדיוק 5 ערוצי שיווק ממוינים לפי כוכבים (הגבוה ביותר ראשון)
- צור בדיוק 3 מסרים שמושכים לידים
- אם יש מתחרים, צור שורה לכל אחד (עד 5). אם אין, החזר מערך ריק.
- כל התוכן חייב להיות בעברית
- היה ספציפי ומעשי, לא גנרי
- התקציבים צריכים להיות ריאליסטיים לעסק קטן-בינוני בישראל
"""

    system_prompt = (
        "אתה יועץ שיווק דיגיטלי ישראלי מומחה לעסקים קטנים ובינוניים. "
        "יש לך ידע עמוק בשוק הישראלי, התנהגות צרכנים ואקוסיסטם הפרסום הדיגיטלי. "
        "תמיד תענה ב-JSON תקני בלבד. כל התוכן בעברית."
    )

    try:
        raw_response = claude_chat(
            messages=[{"role": "user", "content": prompt}],
            system=system_prompt,
            temperature=0.7,
            max_tokens=3000,
        )

        # Clean up response
        raw = raw_response.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        report = json.loads(raw)

        # Add IDs to list items
        for key in ("channel_recommendations", "winning_messages", "competitor_table"):
            if key in report:
                for i, item in enumerate(report[key]):
                    item["id"] = f"{key[:3]}_{uuid.uuid4().hex[:8]}"

        # Ensure all sections exist
        report.setdefault("audience_profile", None)
        report.setdefault("channel_recommendations", [])
        report.setdefault("winning_messages", [])
        report.setdefault("competitor_table", [])
        report.setdefault("competitor_insight", "")
        report.setdefault("weekly_plan", None)

        return report

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude marketing report JSON: {e}")
        return _empty_report()
    except Exception as e:
        logger.error(f"Claude marketing report generation error: {e}")
        return _empty_report()


async def _generate_weekly_plan(business: dict) -> dict:
    """Generate a fresh weekly content plan."""
    try:
        from services.claude_client import chat as claude_chat
    except Exception:
        return None

    biz_name = business.get("business_name", "Unknown")
    biz_industry = business.get("industry", "General")
    biz_type = business.get("business_type", "")

    prompt = f"""צור תוכנית תוכן שבועית חדשה לעסק:
שם: {biz_name}
ענף: {biz_industry}
סוג: {biz_type}

החזר JSON בלבד:
{{
  "sunday": {{ "icon": "facebook|instagram|whatsapp|seo|google_ads", "action": "סוג הפעולה", "topic": "נושא ספציפי" }},
  "monday": {{ "icon": "...", "action": "...", "topic": "..." }},
  "tuesday": {{ "icon": "...", "action": "...", "topic": "..." }},
  "wednesday": {{ "icon": "...", "action": "...", "topic": "..." }},
  "thursday": {{ "icon": "...", "action": "...", "topic": "..." }},
  "friday": {{ "icon": "...", "action": "...", "topic": "..." }}
}}

תוכן מגוון, מעשי וספציפי לענף. בעברית."""

    try:
        raw = claude_chat(
            messages=[{"role": "user", "content": prompt}],
            system="יועץ תוכן ישראלי. JSON בלבד. עברית.",
            temperature=0.8,
            max_tokens=800,
        )
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Weekly plan generation error: {e}")
        return None


def _empty_report() -> dict:
    return {
        "audience_profile": None,
        "channel_recommendations": [],
        "winning_messages": [],
        "competitor_table": [],
        "competitor_insight": "",
        "weekly_plan": None,
    }
