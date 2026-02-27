"""
Notification endpoints — WhatsApp messaging via Twilio.
"""

import logging
import os
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request

from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


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


class SendWhatsAppRequest(BaseModel):
    phone: str
    message: str


@router.post("/send-whatsapp")
async def send_whatsapp(
    body: SendWhatsAppRequest,
    user_id: str = Depends(require_auth),
):
    """Send a WhatsApp message via Twilio (requires authentication)."""
    try:
        from services.whatsapp import send_whatsapp_message

        result = send_whatsapp_message(body.phone, body.message)
        if result:
            return {"success": True}
        return {"success": False, "error": "Message was not sent"}

    except ValueError as e:
        # Twilio credentials not configured
        raise HTTPException(status_code=503, detail=str(e))
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp service is not available (Twilio not installed)",
        )
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        return {"success": False, "error": str(e)}


class TestWhatsAppRequest(BaseModel):
    business_id: str
    message_type: Optional[str] = "test"  # test, morning, lead, competitor


@router.post("/test-whatsapp")
async def test_whatsapp(
    body: TestWhatsAppRequest,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """
    Send a test WhatsApp message to verify integration.
    Looks up the user's phone from their business record,
    formats it, and sends a test message.
    """
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify ownership
    try:
        result = (
            sb.table("businesses")
            .select("user_id, business_name, whatsapp_number, phone")
            .eq("id", body.business_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Business not found")
        if result.data.get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        biz = result.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"test-whatsapp lookup error: {e}")
        raise HTTPException(status_code=500, detail="Failed to look up business")

    # Find the phone number
    raw_phone = biz.get("whatsapp_number") or biz.get("phone")
    if not raw_phone:
        raise HTTPException(
            status_code=400,
            detail="לא נמצא מספר טלפון. הוסף מספר בהגדרות או באונבורדינג."
        )

    from utils.phone import format_for_whatsapp, format_for_display
    formatted_phone = format_for_whatsapp(raw_phone)
    display_phone = format_for_display(raw_phone)

    # Build message based on type
    from services.whatsapp_templates import (
        test_message,
        morning_summary,
        new_hot_lead,
        competitor_change,
    )

    biz_name = biz.get("business_name", "העסק שלך")

    if body.message_type == "morning":
        message = morning_summary(
            business_name=biz_name,
            hot_leads=3,
            competitor_changes=1,
            recommended_action="בדוק ליד חם שהתקבל בלילה",
        )
    elif body.message_type == "lead":
        message = new_hot_lead(
            search_query="שיפוץ דירה באזור תל אביב",
            relevance_score=92,
            source="פייסבוק",
            quote="מישהו מכיר קבלן טוב לשיפוץ?",
            recommended_action="הגב עם המומחיות שלך",
        )
    elif body.message_type == "competitor":
        message = competitor_change(
            competitor_name="עסק לדוגמה",
            change_description="ירד מ-4.8 ל-4.2 כוכבים בגוגל",
            recommendation="זו הזדמנות לבלוט עם הדירוג הגבוה שלך",
        )
    else:
        message = test_message(business_name=biz_name)

    # Send
    try:
        from services.whatsapp import send_whatsapp_message

        success = send_whatsapp_message(formatted_phone, message)
        return {
            "success": success,
            "phone": display_phone,
            "formatted_phone": formatted_phone,
            "message_type": body.message_type,
            "message_preview": message[:100] + "..." if len(message) > 100 else message,
        }

    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"test-whatsapp send error: {e}")
        return {"success": False, "phone": display_phone, "error": str(e)}
