"""
Notification endpoints -- WhatsApp messaging via Twilio.
"""

import logging
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


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
