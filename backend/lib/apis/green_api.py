"""
Green API Client — WhatsApp messaging via green-api.com.

Alternative to Twilio for WhatsApp messaging.
Uses GREEN_API_INSTANCE_ID and GREEN_API_TOKEN env vars.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)


def _get_config() -> tuple[str, str]:
    instance_id = os.getenv("GREEN_API_INSTANCE_ID", "")
    token = os.getenv("GREEN_API_TOKEN", "")
    if not instance_id or not token:
        raise ValueError("GREEN_API_INSTANCE_ID and GREEN_API_TOKEN must be set")
    return instance_id, token


def format_phone(phone: str) -> str:
    """Normalize Israeli phone to WhatsApp format (972XXXXXXXXX)."""
    clean = "".join(c for c in phone if c.isdigit())
    if clean.startswith("972"):
        return clean
    if clean.startswith("0"):
        return "972" + clean[1:]
    return "972" + clean


def send_message(phone: str, message: str) -> dict:
    """
    Send a WhatsApp text message via Green API.
    Returns {"idMessage": "..."} on success.
    """
    instance_id, token = _get_config()
    chat_id = f"{format_phone(phone)}@c.us"

    url = f"https://api.green-api.com/waInstance{instance_id}/sendMessage/{token}"
    try:
        resp = httpx.post(
            url,
            json={"chatId": chat_id, "message": message},
            timeout=10,
        )
        data = resp.json()
        if data.get("idMessage"):
            logger.info(f"Green API sent to {chat_id[:12]}...")
        else:
            logger.warning(f"Green API response: {data}")
        return data
    except Exception as e:
        logger.error(f"Green API send failed: {e}")
        return {"error": str(e)}


def send_test(phone: str) -> bool:
    """Send a test message to verify the connection works."""
    result = send_message(
        phone,
        "שלום! 👋\n\nזוהי הודעת בדיקה מ-Quieteyes.\n\nהכל עובד מצוין 😊",
    )
    return bool(result.get("idMessage"))


def is_configured() -> bool:
    """Check if Green API credentials are available."""
    return bool(
        os.getenv("GREEN_API_INSTANCE_ID") and os.getenv("GREEN_API_TOKEN")
    )
