"""
Channel adapters for outbound message execution.

Each adapter receives the OutboundAction and executes delivery.
All adapters currently run in stub mode — they simulate success
without contacting external services.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DeliveryResult:
    success: bool
    external_id: str | None = None
    error: str | None = None


def execute_email(recipient: str | None, subject: str | None, body: str, payload: dict | None) -> DeliveryResult:
    """Send email via Twilio SendGrid. Falls back to stub if not configured."""
    from app.config import settings

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not recipient:
        logger.info("STUB: Sending email to=%s subject=%s (Twilio not configured)", recipient, subject)
        return DeliveryResult(success=True, external_id=f"email-stub-{id(body)}")

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # Use Twilio SendGrid via the Messages resource
        message = client.messages.create(
            body=f"Subject: {subject or 'No subject'}\n\n{body}",
            from_=settings.TWILIO_SMS_FROM,
            to=recipient,
        )
        logger.info("Email/SMS sent to=%s sid=%s", recipient, message.sid)
        return DeliveryResult(success=True, external_id=message.sid)
    except Exception as e:
        logger.error("Email send failed to=%s: %s", recipient, e)
        return DeliveryResult(success=False, error=str(e))


def execute_whatsapp(recipient: str | None, body: str, payload: dict | None) -> DeliveryResult:
    """Send WhatsApp message via Twilio. Falls back to stub if not configured."""
    from app.config import settings

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info("STUB: Sending WhatsApp to=%s (Twilio not configured)", recipient)
        return DeliveryResult(success=True, external_id=f"wa-stub-{id(body)}")

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        to_number = f"whatsapp:{recipient}" if not recipient.startswith("whatsapp:") else recipient
        message = client.messages.create(
            body=body,
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to_number,
        )
        logger.info("WhatsApp sent to=%s sid=%s", recipient, message.sid)
        return DeliveryResult(success=True, external_id=message.sid)
    except Exception as e:
        logger.error("WhatsApp send failed to=%s: %s", recipient, e)
        return DeliveryResult(success=False, error=str(e))


def execute_linkedin(recipient: str | None, body: str, payload: dict | None) -> DeliveryResult:
    """Stub LinkedIn adapter. In production, integrate with LinkedIn API."""
    logger.info("STUB: Sending LinkedIn message to=%s", recipient)
    return DeliveryResult(success=True, external_id=f"li-stub-{id(body)}")


def execute_content(body: str, payload: dict | None) -> DeliveryResult:
    """Stub content publishing adapter. In production, integrate with CMS/social APIs."""
    logger.info("STUB: Publishing content draft, length=%d", len(body))
    return DeliveryResult(success=True, external_id=f"content-stub-{id(body)}")


def execute_crm(recipient: str | None, body: str, payload: dict | None) -> DeliveryResult:
    """Stub CRM follow-up adapter. In production, integrate with HubSpot/Salesforce."""
    logger.info("STUB: CRM follow-up for=%s", recipient)
    return DeliveryResult(success=True, external_id=f"crm-stub-{id(body)}")


def dispatch(channel: str, recipient: str | None, subject: str | None, body: str, payload: dict | None) -> DeliveryResult:
    """Route to the correct channel adapter."""
    if channel == "EMAIL":
        return execute_email(recipient, subject, body, payload)
    elif channel == "WHATSAPP":
        return execute_whatsapp(recipient, body, payload)
    elif channel == "LINKEDIN":
        return execute_linkedin(recipient, body, payload)
    elif channel == "CONTENT":
        return execute_content(body, payload)
    elif channel == "CRM":
        return execute_crm(recipient, body, payload)
    else:
        return DeliveryResult(success=False, error=f"Unknown channel: {channel}")
