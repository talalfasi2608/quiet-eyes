"""
Chat Router — AI COO chat + history.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth, get_supabase_client

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
async def chat(payload: ChatRequest, request: Request, auth_user_id: str = Depends(require_auth)):
    """AI COO chat endpoint — uses Claude with business context."""
    if payload.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        supabase = _get_supabase()

    # Get business context
    biz_name = ""
    industry = ""
    biz_location = ""
    biz_audience = ""
    biz_description = ""
    competitors_count = 0
    if supabase:
        try:
            r = supabase.table("businesses").select("id, business_name, industry, location, address, target_audience, user_description, price_tier").eq("user_id", payload.user_id).execute()
            if r.data:
                biz = r.data[0]
                biz_name = biz.get("business_name", "")
                industry = biz.get("industry", "")
                biz_location = biz.get("address", biz.get("location", ""))
                biz_audience = biz.get("target_audience", "")
                biz_description = biz.get("user_description", "")
                biz_id = biz.get("id", "")
                # Count competitors
                cr = supabase.table("competitors").select("id", count="exact").eq("business_id", biz_id).execute()
                competitors_count = cr.count or 0 if hasattr(cr, 'count') else len(cr.data or [])
        except Exception as e:
            logger.debug(f"Chat context lookup: {e}")

    # Load recent conversation history for AI context
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

    # Call Claude
    try:
        from services.claude_client import chat as claude_chat
        from config import get_settings
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise HTTPException(status_code=503, detail="AI unavailable")

        system_prompt = f"""אתה יועץ עסקי בכיר של Quieteyes עבור "{biz_name}".
אתה מומחה ב-OSINT, שיווק דיגיטלי ואסטרטגיה עסקית בתחום {industry}.

פרטי העסק:
- שם: {biz_name}
- תחום: {industry}
- מיקום: {biz_location}
- קהל יעד: {biz_audience}
- תיאור: {biz_description}
- מתחרים במערכת: {competitors_count}

כללים קריטיים:
1. תמיד ענה בעברית
2. כל המלצה חייבת להתבסס על הנתונים שיש לך על העסק
3. היה ספציפי - ציין שמות, מספרים, תאריכים, מיקום
4. אל תיתן עצות גנריות - רק מה שרלוונטי לעסק הזה ולתחום שלו
5. אל תשאל מה העסק עושה - המידע כבר ניתן לך למעלה
6. תן תוכנית פעולה מעשית וישירה"""

        # Build messages: history + current user message (system is separate in Claude)
        user_messages = []
        for msg in conversation_history:
            user_messages.append({"role": msg["role"], "content": msg["content"]})
        user_messages.append({"role": "user", "content": payload.message})

        ai_response = claude_chat(
            messages=user_messages,
            system=system_prompt,
            temperature=0.7,
            max_tokens=800,
        )

        # Persist user message and AI response to chat_messages
        saved_count = 0
        try:
            sb = _get_service_client() or get_supabase_client(request)
            _save_message(sb, payload.user_id, "user", payload.message)
            _save_message(sb, payload.user_id, "assistant", ai_response)
            saved_count = len(conversation_history) + 2
        except Exception as e:
            logger.debug(f"Failed to save chat messages (table may not exist): {e}")
            saved_count = 0

        return {
            "success": True,
            "response": ai_response,
            "business_name": biz_name,
            "competitors_count": competitors_count,
            "suggested_questions": [
                "מה המתחרים שלי עושים?",
                "איך אני יכול לשפר את הדירוג בגוגל?",
                "תן לי 3 פעולות לשבוע הקרוב",
            ],
            "intelligence_summary": {
                "insights_30d": 0,
                "competitor_moves_7d": 0,
                "leads_tracked": 0,
                "memory_messages": saved_count,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Chat failed")
