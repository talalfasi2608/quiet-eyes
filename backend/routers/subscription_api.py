"""
Subscription API Router — Upgrade, cancel, and plan management.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subscription", tags=["Subscription"])


def _get_service_client():
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


@router.get("")
async def get_subscription(auth_user_id: str = Depends(require_auth)):
    """Get current subscription details."""
    sb = _get_service_client()
    if not sb:
        return {"plan": "free", "billing_cycle": "monthly", "trial_days_remaining": 0}

    try:
        result = sb.table("subscriptions").select("*").eq("user_id", auth_user_id).maybe_single().execute()
        if not result.data:
            return {"plan": "free", "billing_cycle": "monthly", "trial_days_remaining": 0}

        sub = result.data
        now = datetime.now(timezone.utc)

        # Calculate trial days
        trial_days = 0
        trial_end = sub.get("trial_ends_at")
        if trial_end:
            try:
                end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
                trial_days = max(0, (end_dt - now).days)
            except Exception:
                pass

        return {
            "plan": sub.get("tier", "free"),
            "billing_cycle": sub.get("billing_interval", "monthly"),
            "trial_days_remaining": trial_days,
            "trial_ends_at": sub.get("trial_ends_at"),
            "plan_started_at": sub.get("created_at"),
            "status": sub.get("status", "active"),
        }
    except Exception as e:
        logger.error(f"Subscription fetch failed: {e}")
        return {"plan": "free", "billing_cycle": "monthly", "trial_days_remaining": 0}


class UpgradeRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"


@router.post("/upgrade")
async def upgrade_subscription(body: UpgradeRequest, auth_user_id: str = Depends(require_auth)):
    """Upgrade user's subscription plan."""
    valid_plans = ["starter", "growth", "pro", "business"]
    if body.plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}")
    if body.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="Invalid billing cycle")

    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    now = datetime.now(timezone.utc).isoformat()

    try:
        # Upsert subscription
        sb.table("subscriptions").upsert({
            "user_id": auth_user_id,
            "tier": body.plan,
            "billing_interval": body.billing_cycle,
            "status": "active",
            "updated_at": now,
        }, on_conflict="user_id").execute()

        # Update business profile if exists
        try:
            sb.table("businesses").update({
                "subscription_plan": body.plan,
                "billing_cycle": body.billing_cycle,
                "plan_started_at": now,
            }).eq("user_id", auth_user_id).execute()
        except Exception:
            pass

        # Send WhatsApp confirmation
        try:
            _send_upgrade_whatsapp(sb, auth_user_id, body.plan)
        except Exception:
            pass

        return {"success": True, "message": f"שודרגת ל-{body.plan}! כל 6 העוזרים עובדים בשבילך"}
    except Exception as e:
        logger.error(f"Upgrade failed: {e}")
        raise HTTPException(status_code=500, detail="Upgrade failed")


@router.post("/cancel")
async def cancel_subscription(auth_user_id: str = Depends(require_auth)):
    """Cancel subscription at end of current period."""
    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        sb.table("subscriptions").update({
            "status": "cancelling",
            "cancel_at_period_end": True,
        }).eq("user_id", auth_user_id).execute()

        # Send WhatsApp confirmation
        try:
            phone = _get_user_phone(sb, auth_user_id)
            if phone:
                from lib.apis.green_api import send_message, is_configured
                if is_configured():
                    send_message(phone, "ביטול המנוי ייכנס לתוקף בסוף התקופה הנוכחית. נשמח לראותך חוזר/ת! 💙")
        except Exception:
            pass

        return {"success": True, "message": "המנוי יבוטל בסוף התקופה הנוכחית"}
    except Exception as e:
        logger.error(f"Cancel failed: {e}")
        raise HTTPException(status_code=500, detail="Cancel failed")


def _get_user_phone(sb, user_id: str) -> str | None:
    try:
        result = sb.table("businesses").select("phone").eq("user_id", user_id).maybe_single().execute()
        return result.data.get("phone") if result.data else None
    except Exception:
        return None


def _send_upgrade_whatsapp(sb, user_id: str, plan: str):
    phone = _get_user_phone(sb, user_id)
    if not phone:
        return
    plan_names = {"starter": "Starter", "growth": "Growth", "pro": "Pro", "business": "Business"}
    name = plan_names.get(plan, plan)
    msg = f"שודרגת ל-{name}! 🎉\n\nכל העוזרים שלך כבר עובדים.\nנתראה בדשבורד 💪"
    try:
        from lib.apis.green_api import send_message, is_configured
        if is_configured():
            send_message(phone, msg)
            return
    except Exception:
        pass
    try:
        from services.whatsapp import send_whatsapp_message
        send_whatsapp_message(phone, msg)
    except Exception:
        pass
