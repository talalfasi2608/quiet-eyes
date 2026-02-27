"""
WhatsApp Webhook Router — handles incoming Twilio WhatsApp replies.

NO authentication — Twilio sends unauthenticated POST requests.
Dispatches to review_responder, lead_outreach, or campaign_generator
based on stored whatsapp_contexts.
"""

import logging
from fastapi import APIRouter, Form
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Webhook"])


def _normalize_phone(raw: str) -> str:
    """Normalize Twilio 'From' field to a clean phone number."""
    phone = raw.strip()
    if phone.startswith("whatsapp:"):
        phone = phone[9:]
    return phone


@router.post("/webhook")
async def whatsapp_webhook(
    From: str = Form(""),
    Body: str = Form(""),
):
    """
    Handle incoming WhatsApp messages from Twilio.

    Twilio sends Form-encoded POST with:
    - From: "whatsapp:+972501234567"
    - Body: message text

    Returns empty 200 for Twilio acknowledgement.
    """
    phone = _normalize_phone(From)
    body = Body.strip()

    if not phone or not body:
        return PlainTextResponse("", status_code=200)

    logger.info(f"[WhatsApp Webhook] Message from {phone[:8]}...: {body[:50]}")

    try:
        from config import supabase
        if not supabase:
            return PlainTextResponse("", status_code=200)
    except ImportError:
        return PlainTextResponse("", status_code=200)

    # Look up pending context for this phone
    from services.automation_helpers import get_whatsapp_context
    context = get_whatsapp_context(phone, supabase)

    if not context:
        # No pending context — send help message
        try:
            from services.whatsapp import send_whatsapp_message
            send_whatsapp_message(
                phone,
                "👁️ Quieteyes: אין פעולה ממתינה. הודעות אוטומטיות יגיעו כשיהיה עדכון חדש.",
            )
        except Exception:
            pass
        return PlainTextResponse("", status_code=200)

    context_type = context.get("context_type", "")
    context_data = context.get("context_data", {})
    context_id = context.get("id")

    try:
        if context_type == "review_approval":
            await _handle_review_approval(phone, body, context_data, supabase)

        elif context_type == "lead_outreach":
            await _handle_lead_outreach(phone, body, context_data, supabase)

        elif context_type == "campaign_approval":
            await _handle_campaign_approval(phone, body, context_data, supabase)

        else:
            logger.warning(f"[WhatsApp Webhook] Unknown context_type: {context_type}")

        # Expire the used context
        if context_id:
            try:
                supabase.table("whatsapp_contexts").delete().eq("id", context_id).execute()
            except Exception:
                pass

    except Exception as e:
        logger.error(f"[WhatsApp Webhook] Handler error: {e}")

    return PlainTextResponse("", status_code=200)


async def _handle_review_approval(
    phone: str, body: str, context_data: dict, supabase
):
    """Handle review response approval or edit."""
    from services.review_responder import get_review_responder
    from services.whatsapp import send_whatsapp_message

    responder = get_review_responder()

    if body == "אשר":
        result = responder.handle_approval(context_data, "אשר", supabase)
        send_whatsapp_message(
            phone,
            f'✅ תגובה מוכנה להעתקה:\n\n'
            f'"{result["response_text"]}"\n\n'
            f'לפרסום: {result.get("google_review_link", "")}'
        )

    elif body.startswith("ערוך:"):
        result = responder.handle_approval(context_data, body, supabase)
        send_whatsapp_message(
            phone,
            f'✅ תגובה מעודכנת מוכנה להעתקה:\n\n'
            f'"{result["response_text"]}"\n\n'
            f'לפרסום: {result.get("google_review_link", "")}'
        )

    else:
        send_whatsapp_message(
            phone,
            'השב "אשר" לאישור התגובה, או "ערוך: [טקסט חדש]" לעריכה.'
        )


async def _handle_lead_outreach(
    phone: str, body: str, context_data: dict, supabase
):
    """Handle lead outreach send confirmation."""
    from services.whatsapp import send_whatsapp_message
    from services.automation_helpers import log_automation

    if body == "שלח":
        outreach_text = context_data.get("outreach_text", "")
        lead_name = context_data.get("lead_name", "ליד")
        business_id = context_data.get("business_id", "")

        log_automation(
            business_id=business_id,
            automation_type="lead_outreach",
            trigger_event=f"manual_send:{context_data.get('lead_id', '')}",
            action_taken="outreach_approved",
            result="approved",
            details={"outreach_text": outreach_text},
            supabase=supabase,
        )

        send_whatsapp_message(
            phone,
            f'✅ הודעה ל-{lead_name} מוכנה להעתקה:\n\n"{outreach_text}"'
        )
    else:
        send_whatsapp_message(
            phone,
            'השב "שלח" לאישור ההודעה.'
        )


async def _handle_campaign_approval(
    phone: str, body: str, context_data: dict, supabase
):
    """Handle campaign approval."""
    from services.whatsapp import send_whatsapp_message
    from services.automation_helpers import log_automation

    campaign_id = context_data.get("campaign_id")
    business_id = context_data.get("business_id", "")
    campaign_name = context_data.get("campaign_name", "")

    if body == "שלח":
        # Update campaign status to active
        if campaign_id:
            try:
                supabase.table("campaigns").update(
                    {"status": "active"}
                ).eq("id", campaign_id).execute()
            except Exception as e:
                logger.error(f"Campaign update error: {e}")

        log_automation(
            business_id=business_id,
            automation_type="campaign_generator",
            trigger_event=f"campaign_approved:{campaign_id}",
            action_taken="campaign_activated",
            result="active",
            details={"campaign_id": campaign_id, "campaign_name": campaign_name},
            supabase=supabase,
        )

        send_whatsapp_message(
            phone,
            f'✅ קמפיין "{campaign_name}" אושר והופעל!\n'
            f'צפה בקמפיין המלא ב-Quieteyes.'
        )
    else:
        send_whatsapp_message(
            phone,
            'השב "שלח" לאישור הקמפיין.'
        )
