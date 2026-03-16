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
    """Stub email adapter. In production, integrate with SendGrid/SES/SMTP."""
    logger.info("STUB: Sending email to=%s subject=%s", recipient, subject)
    return DeliveryResult(success=True, external_id=f"email-stub-{id(body)}")


def execute_whatsapp(recipient: str | None, body: str, payload: dict | None) -> DeliveryResult:
    """Stub WhatsApp adapter. In production, integrate with WhatsApp Business API."""
    logger.info("STUB: Sending WhatsApp to=%s", recipient)
    return DeliveryResult(success=True, external_id=f"wa-stub-{id(body)}")


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
