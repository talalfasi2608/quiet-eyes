"""
Chat Router — AI COO chat + history.

Injects ALL real business data (competitors, leads, intelligence events,
trends, memory) into every Claude prompt so the AI advisor can reference
actual numbers, names, and facts.
"""

import json as _json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth, get_supabase_client
from services.permission_engine import require_feature

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _get_supabase():
    svc = _get_service_client()
    if svc:
        return svc
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _save_message(sb, user_id: str, role: str, content: str):
    """Save a single chat message to the chat_messages table."""
    sb.table("chat_messages").insert({
        "user_id": user_id,
        "role": role,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def _safe_query(sb, table: str, select: str, filters: dict,
                order_col: str = "created_at", desc: bool = True,
                limit: int = 10) -> list:
    """Run a Supabase query with graceful error handling."""
    try:
        q = sb.table(table).select(select)
        for col, val in filters.items():
            q = q.eq(col, val)
        q = q.order(order_col, desc=desc).limit(limit)
        result = q.execute()
        return result.data or []
    except Exception as e:
        logger.debug(f"Query {table} failed: {e}")
        return []


# =========================================================================
# DATA LOADING — pull ALL real business data for the AI context
# =========================================================================

def _load_business_data(sb, business_id: str) -> dict:
    """Load all relevant data for a business from every table."""
    now = datetime.now(timezone.utc)
    data: dict = {}

    # ── Competitors (top 10 by threat level) ─────────────────────────
    try:
        result = (
            sb.table("competitors")
            .select("name, google_rating, google_reviews_count, "
                    "perceived_threat_level, identified_weakness, "
                    "address, website")
            .eq("business_id", business_id)
            .order("google_rating", desc=True)
            .limit(10)
            .execute()
        )
        data["competitors"] = result.data or []
    except Exception as e:
        logger.debug(f"Competitors load: {e}")
        data["competitors"] = []

    # ── Recent leads (last 7 days) ───────────────────────────────────
    try:
        cutoff_7d = (now - timedelta(days=7)).isoformat()
        result = (
            sb.table("leads_discovered")
            .select("summary, original_text, platform, "
                    "relevance_score, status, source_url, created_at")
            .eq("business_id", business_id)
            .gte("created_at", cutoff_7d)
            .order("relevance_score", desc=True)
            .limit(15)
            .execute()
        )
        data["recent_leads"] = result.data or []
    except Exception as e:
        logger.debug(f"Leads load: {e}")
        data["recent_leads"] = []

    # ── All leads stats ──────────────────────────────────────────────
    try:
        all_leads = (
            sb.table("leads_discovered")
            .select("status")
            .eq("business_id", business_id)
            .execute()
        )
        leads_list = all_leads.data or []
        data["leads_stats"] = {
            "total": len(leads_list),
            "new": sum(1 for l in leads_list if l.get("status") == "new"),
            "sniped": sum(1 for l in leads_list if l.get("status") == "sniped"),
            "dismissed": sum(1 for l in leads_list if l.get("status") == "dismissed"),
        }
    except Exception:
        data["leads_stats"] = {"total": 0, "new": 0, "sniped": 0, "dismissed": 0}

    # ── Intelligence events (last 14 days) ───────────────────────────
    try:
        cutoff_14d = (now - timedelta(days=14)).isoformat()
        result = (
            sb.table("intelligence_events")
            .select("event_type, title, description, severity, "
                    "source, created_at, is_read")
            .eq("business_id", business_id)
            .gte("created_at", cutoff_14d)
            .order("created_at", desc=True)
            .limit(15)
            .execute()
        )
        data["intel_events"] = result.data or []
    except Exception as e:
        logger.debug(f"Intel events load: {e}")
        data["intel_events"] = []

    # ── Trend data (latest) ──────────────────────────────────────────
    try:
        result = (
            sb.table("trend_data")
            .select("*")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        data["trends"] = result.data or []
    except Exception as e:
        logger.debug(f"Trends load: {e}")
        data["trends"] = []

    # ── Business memory (last 4 weeks) ───────────────────────────────
    try:
        result = (
            sb.table("business_memory")
            .select("week_start, leads_found, leads_converted, "
                    "avg_rating, review_count, competitor_count, "
                    "top_threat_competitor, weekly_summary, "
                    "main_opportunity, main_threat, trend_direction")
            .eq("business_id", business_id)
            .order("week_start", desc=True)
            .limit(4)
            .execute()
        )
        data["memory"] = result.data or []
    except Exception as e:
        logger.debug(f"Memory load: {e}")
        data["memory"] = []

    return data


# =========================================================================
# CONTEXT FORMATTING — turn raw data into readable Hebrew text for Claude
# =========================================================================

def _format_competitors(competitors: list) -> str:
    if not competitors:
        return ""
    lines = ["מתחרים (נתונים אמיתיים מהמערכת):"]
    for i, c in enumerate(competitors, 1):
        threat = c.get("perceived_threat_level", "Low")
        emoji = {"High": "\U0001f534", "Medium": "\U0001f7e1", "Low": "\U0001f7e2"}.get(threat, "\U0001f7e1")
        rating = c.get("google_rating", "?")
        reviews = c.get("google_reviews_count", "?")
        name = c.get("name", "לא ידוע")
        address = c.get("address", "")
        weakness = c.get("identified_weakness", "")
        line = f"{i}. {emoji} {name} | ⭐{rating} | {reviews} ביקורות | רמת איום: {threat}"
        if address:
            line += f" | {address}"
        if weakness:
            line += f"\n   חולשה: {weakness}"
        lines.append(line)
    return "\n".join(lines)


def _format_leads(leads: list, stats: dict) -> str:
    if not leads and stats.get("total", 0) == 0:
        return ""
    lines = [
        f"לידים (סה\"כ: {stats.get('total', 0)} | "
        f"חדשים: {stats.get('new', 0)} | "
        f"מאושרים: {stats.get('sniped', 0)} | "
        f"נדחו: {stats.get('dismissed', 0)}):"
    ]
    if leads:
        lines.append(f"לידים אחרונים (7 ימים, {len(leads)} תוצאות):")
        for l in leads[:10]:
            platform = l.get("platform", "web")
            summary = (l.get("summary") or "")[:120]
            score = l.get("relevance_score", 0)
            status = l.get("status", "new")
            status_heb = {"new": "חדש", "sniped": "מאושר", "dismissed": "נדחה"}.get(status, status)
            lines.append(f"  \u2022 [{platform}] {summary} | ציון: {int(score * 100)}% | סטטוס: {status_heb}")
    return "\n".join(lines)


def _format_intel_events(events: list) -> str:
    if not events:
        return ""
    lines = [f"אירועי מודיעין אחרונים ({len(events)} ב-14 ימים):"]
    for e in events[:10]:
        severity = e.get("severity", "low")
        sev_emoji = {"critical": "\U0001f534", "high": "\U0001f7e0", "medium": "\U0001f7e1", "low": "\U0001f7e2"}.get(severity, "\U0001f7e1")
        title = e.get("title", "")
        desc = (e.get("description") or "")[:100]
        event_type = e.get("event_type", "")
        source = e.get("source", "")
        lines.append(f"  \u2022 {sev_emoji} [{event_type}] {title}")
        if desc:
            lines.append(f"    {desc}")
    return "\n".join(lines)


def _format_trends(trends: list) -> str:
    if not trends:
        return ""
    lines = ["מגמות שוק:"]
    for t in trends:
        keyword = t.get("keyword", t.get("platform", ""))
        score = t.get("interest_score", "?")
        source = t.get("source", "")
        lines.append(f"  \u2022 {keyword} | ציון עניין: {score} | מקור: {source}")
    return "\n".join(lines)


def _format_memory(memory: list) -> str:
    if not memory:
        return ""
    lines = ["היסטוריה שבועית (4 שבועות אחרונים):"]
    for m in memory:
        week = m.get("week_start", "?")
        leads = m.get("leads_found", 0)
        converted = m.get("leads_converted", 0)
        rating = m.get("avg_rating", "?")
        summary = (m.get("weekly_summary") or "")[:150]
        opportunity = m.get("main_opportunity", "")
        threat = m.get("main_threat", "")
        trend = m.get("trend_direction", "")
        line = f"  \u2022 שבוע {week}: {leads} לידים ({converted} המרות) | דירוג: {rating}"
        if trend:
            line += f" | מגמה: {trend}"
        if summary:
            line += f"\n    סיכום: {summary}"
        if opportunity:
            line += f"\n    הזדמנות: {opportunity}"
        if threat:
            line += f"\n    איום: {threat}"
        lines.append(line)
    return "\n".join(lines)


# =========================================================================
# ENDPOINTS
# =========================================================================

@router.get("/chat/{user_id}/history")
async def chat_history(user_id: str, request: Request, auth_user_id: str = Depends(require_auth), limit: int = Query(default=20)):
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        sb = _get_service_client() or get_supabase_client(request)
        result = (
            sb.table("chat_messages")
            .select("role, content")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        # Reverse so oldest message is first
        messages = list(reversed(result.data)) if result.data else []
        return {"messages": messages}
    except Exception as e:
        logger.debug(f"Chat history lookup failed (table may not exist): {e}")
        return {"messages": []}


class ChatRequest(BaseModel):
    user_id: str
    message: str
    prompt_template_id: Optional[int] = None


@router.post("/chat")
async def chat(payload: ChatRequest, request: Request, auth_user_id: str = Depends(require_auth), _perm=Depends(require_feature("ai_chat_messages_per_month"))):
    """AI COO chat endpoint — uses Claude with FULL real business data."""
    if payload.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        supabase = _get_supabase()

    # ─── STEP 1: Load business profile ───────────────────────────────
    biz_name = ""
    industry = ""
    biz_location = ""
    biz_audience = ""
    biz_description = ""
    biz_id = ""
    biz_price_tier = ""
    biz_data: dict = {}
    if supabase:
        try:
            r = (
                supabase.table("businesses")
                .select("id, business_name, industry, location, address, "
                        "target_audience, user_description, price_tier")
                .eq("user_id", payload.user_id)
                .execute()
            )
            if r.data:
                biz = r.data[0]
                biz_name = biz.get("business_name", "")
                industry = biz.get("industry", "")
                biz_location = biz.get("address") or biz.get("location", "")
                biz_audience = biz.get("target_audience", "")
                biz_description = biz.get("user_description", "")
                biz_id = biz.get("id", "")
                biz_price_tier = biz.get("price_tier", "")
        except Exception as e:
            logger.debug(f"Chat business lookup: {e}")

    # ─── STEP 2: Load ALL real data from DB ──────────────────────────
    competitors_count = 0
    leads_count = 0
    intel_count = 0
    if biz_id and supabase:
        sb = _get_service_client() or supabase
        biz_data = _load_business_data(sb, biz_id)
        competitors_count = len(biz_data.get("competitors", []))
        leads_count = biz_data.get("leads_stats", {}).get("total", 0)
        intel_count = len(biz_data.get("intel_events", []))

    # ─── STEP 3: Format data sections ────────────────────────────────
    comp_text = _format_competitors(biz_data.get("competitors", []))
    leads_text = _format_leads(
        biz_data.get("recent_leads", []),
        biz_data.get("leads_stats", {}),
    )
    intel_text = _format_intel_events(biz_data.get("intel_events", []))
    trends_text = _format_trends(biz_data.get("trends", []))
    memory_text = _format_memory(biz_data.get("memory", []))

    # ─── STEP 4: Load conversation history ───────────────────────────
    conversation_history = []
    try:
        sb = _get_service_client() or get_supabase_client(request)
        hist_result = (
            sb.table("chat_messages")
            .select("role, content")
            .eq("user_id", payload.user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        if hist_result.data:
            conversation_history = list(reversed(hist_result.data))
    except Exception as e:
        logger.debug(f"Failed to load conversation history: {e}")

    # ─── STEP 5: Build system prompt with ALL data ───────────────────
    try:
        from services.claude_client import chat as claude_chat
        from config import get_settings
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise HTTPException(status_code=503, detail="AI unavailable")

        today = datetime.now().strftime("%d/%m/%Y")

        system_prompt = f"""אתה יועץ עסקי אישי וחכם של "{biz_name}" במערכת Quieteyes.
יש לך גישה מלאה לכל הנתונים האמיתיים של העסק. תמיד ענה בעברית.
תמיד התבסס על הנתונים האמיתיים שלמטה — אל תמציא מידע.
תאריך היום: {today}

══════════════════════════════
פרטי העסק:
══════════════════════════════
שם: {biz_name}
תחום: {industry}
מיקום: {biz_location}
קהל יעד: {biz_audience}
תיאור: {biz_description}
רמת מחיר: {biz_price_tier or 'לא צוין'}

══════════════════════════════
{comp_text}
══════════════════════════════
{leads_text}
══════════════════════════════
{intel_text}
══════════════════════════════
{trends_text}
══════════════════════════════
{memory_text}
══════════════════════════════

כללים קריטיים:
1. תמיד ענה בעברית
2. התייחס תמיד לנתונים הספציפיים שלמעלה — ציין שמות מתחרים אמיתיים, לידים אמיתיים, מספרים אמיתיים
3. אם שואלים על מתחרה ספציפי — חפש אותו ברשימת המתחרים
4. אם שואלים על לידים — התייחס ללידים האמיתיים שנמצאו
5. אם שואלים על מגמות — התייחס לאירועי מודיעין ומגמות שוק
6. תן המלצה אחת ספציפית ומעשית בסוף כל תשובה
7. אל תמציא מידע שלא נמצא בנתונים — אם אין נתונים על נושא מסוים, אמור זאת בכנות
8. השתמש במספרים אמיתיים מהנתונים
9. אל תשאל מה העסק עושה — המידע כבר ניתן לך למעלה"""

        # Inject AI memory engine context (enriched summary)
        try:
            from services.memory_engine import get_memory_engine
            if biz_id:
                sb = _get_service_client() or get_supabase_client(request)
                memory_context = get_memory_engine().get_context_for_ai(biz_id, sb)
                if memory_context:
                    system_prompt += f"\n\n## ניתוח ביצועים מנוע זיכרון\n{memory_context}"
        except Exception as e:
            logger.debug(f"Memory context injection skipped: {e}")

        # Inject latest prediction
        try:
            from services.prediction_engine import get_prediction_engine
            if biz_id:
                sb = _get_service_client() or get_supabase_client(request)
                pred = get_prediction_engine().get_latest_prediction(biz_id, sb)
                if pred:
                    system_prompt += f"\n\n## תחזית לשבוע הנוכחי\n{_json.dumps(pred, ensure_ascii=False)}"
        except Exception:
            pass

        # ─── STEP 6: Call Claude ─────────────────────────────────────
        user_messages = []
        for msg in conversation_history:
            user_messages.append({"role": msg["role"], "content": msg["content"]})
        user_messages.append({"role": "user", "content": payload.message})

        ai_response = claude_chat(
            messages=user_messages,
            system=system_prompt,
            temperature=0.7,
            max_tokens=1500,
        )

        # ─── STEP 7: Persist messages ───────────────────────────────
        saved_count = 0
        try:
            sb = _get_service_client() or get_supabase_client(request)
            _save_message(sb, payload.user_id, "user", payload.message)
            _save_message(sb, payload.user_id, "assistant", ai_response)
            saved_count = len(conversation_history) + 2
        except Exception as e:
            logger.debug(f"Failed to save chat messages (table may not exist): {e}")
            saved_count = 0

        # ─── STEP 8: Build smart suggested questions ─────────────────
        suggested = _build_suggested_questions(biz_data, competitors_count, leads_count)

        return {
            "success": True,
            "response": ai_response,
            "business_name": biz_name,
            "competitors_count": competitors_count,
            "suggested_questions": suggested,
            "intelligence_summary": {
                "insights_30d": intel_count,
                "competitor_moves_7d": sum(
                    1 for e in biz_data.get("intel_events", [])
                    if e.get("event_type") == "competitor_change"
                ),
                "leads_tracked": leads_count,
                "memory_messages": saved_count,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Chat failed")


def _build_suggested_questions(biz_data: dict, comp_count: int, leads_count: int) -> list[str]:
    """Generate contextual suggested questions based on available data."""
    suggestions = []

    if comp_count > 0:
        # Pick the top-rated competitor name for a specific question
        comps = biz_data.get("competitors", [])
        if comps:
            top = comps[0].get("name", "")
            if top:
                suggestions.append(f"נתח לי את {top}")
        suggestions.append("מי המתחרה הכי מסוכן שלי?")

    if leads_count > 0:
        suggestions.append("כמה לידים נמצאו השבוע?")

    if biz_data.get("intel_events"):
        suggestions.append("מה הדבר הכי חשוב שקרה השבוע?")

    if biz_data.get("memory"):
        suggestions.append("מה המגמה העסקית שלי בחודש האחרון?")

    # Always include a general action question
    suggestions.append("תן לי 3 פעולות לשבוע הקרוב")

    return suggestions[:4]
