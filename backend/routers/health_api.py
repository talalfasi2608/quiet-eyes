"""
Health Check Router — Used by Railway/uptime monitoring.
"""

import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """System health check. Returns 200 if app is alive."""
    checks = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {},
    }

    # Check Supabase
    try:
        from config import get_settings
        s = get_settings()
        checks["services"]["database"] = "connected" if s.is_db_available else "not_configured"
    except Exception:
        checks["services"]["database"] = "error"

    # Check AI
    try:
        checks["services"]["ai"] = "ready" if os.getenv("ANTHROPIC_API_KEY") else "not_configured"
    except Exception:
        checks["services"]["ai"] = "error"

    # Check WhatsApp
    try:
        green = bool(os.getenv("GREEN_API_INSTANCE_ID") and os.getenv("GREEN_API_TOKEN"))
        twilio = bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN"))
        if green:
            checks["services"]["whatsapp"] = "green_api"
        elif twilio:
            checks["services"]["whatsapp"] = "twilio"
        else:
            checks["services"]["whatsapp"] = "not_configured"
    except Exception:
        checks["services"]["whatsapp"] = "error"

    return checks
