"""
WhatsApp Messaging Service via Twilio.

Sends WhatsApp messages using the Twilio API.
Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM
environment variables.

For development, use the Twilio Sandbox:
  1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
  2. Follow sandbox setup instructions
  3. Set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 (sandbox number)
"""

import os
import logging

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")


def _get_twilio_client():
    """Lazy-load Twilio client to avoid import errors if not installed."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        raise ValueError("Twilio credentials not configured")
    from twilio.rest import Client
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_whatsapp_message(phone: str, message: str) -> bool:
    """
    Send a WhatsApp message via Twilio.

    Args:
        phone: Recipient phone number (E.164 format, e.g. "+972501234567")
        message: Message body text

    Returns:
        True if sent successfully, False otherwise.
    """
    if not phone or not message:
        logger.warning("WhatsApp send skipped: missing phone or message")
        return False

    # Normalize phone format
    to_number = phone.strip()
    if not to_number.startswith("whatsapp:"):
        to_number = f"whatsapp:{to_number}"

    from_number = TWILIO_WHATSAPP_FROM.strip()
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"

    try:
        client = _get_twilio_client()
        result = client.messages.create(
            body=message,
            from_=from_number,
            to=to_number,
        )
        logger.info(
            f"WhatsApp sent to {phone[:8]}... | SID: {result.sid}"
        )
        return True
    except Exception as e:
        logger.error(f"WhatsApp send failed to {phone[:8]}...: {e}")
        raise
