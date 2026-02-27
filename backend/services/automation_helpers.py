"""
Automation Helpers — shared utilities for Phase 3 automation engine.

Provides toggle checks, audit logging, WhatsApp context management,
and phone number resolution for all automation services.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def get_automation_settings(business_id: str, supabase=None) -> dict:
    """
    Fetch or create-with-defaults automation_settings row for a business.
    Returns dict with boolean keys: review_responder, lead_alerts, etc.
    """
    sb = supabase or _get_supabase()
    if not sb:
        return {
            "review_responder": True,
            "lead_alerts": True,
            "competitor_alerts": True,
            "morning_briefing": True,
            "campaign_generator": True,
        }

    try:
        result = (
            sb.table("automation_settings")
            .select("*")
            .eq("business_id", business_id)
            .maybe_single()
            .execute()
        )
        if result.data:
            return result.data

        # Create defaults
        new_row = {
            "business_id": business_id,
            "review_responder": True,
            "lead_alerts": True,
            "competitor_alerts": True,
            "morning_briefing": True,
            "campaign_generator": True,
        }
        insert_result = sb.table("automation_settings").insert(new_row).execute()
        return insert_result.data[0] if insert_result.data else new_row
    except Exception as e:
        logger.error(f"get_automation_settings error: {e}")
        return {
            "review_responder": True,
            "lead_alerts": True,
            "competitor_alerts": True,
            "morning_briefing": True,
            "campaign_generator": True,
        }


def is_automation_enabled(business_id: str, key: str, supabase=None) -> bool:
    """
    Check if a single automation toggle is enabled.
    key: 'review_responder', 'lead_alerts', 'competitor_alerts',
         'morning_briefing', 'campaign_generator'
    """
    settings = get_automation_settings(business_id, supabase)
    return bool(settings.get(key, True))


def log_automation(
    business_id: str,
    automation_type: str,
    trigger_event: str,
    action_taken: str,
    result: str,
    details: Optional[dict] = None,
    supabase=None,
):
    """Insert a row into automation_log for audit trail."""
    sb = supabase or _get_supabase()
    if not sb:
        logger.warning("No supabase client for log_automation")
        return

    try:
        sb.table("automation_log").insert({
            "business_id": business_id,
            "automation_type": automation_type,
            "trigger_event": trigger_event,
            "action_taken": action_taken,
            "result": result,
            "details": details or {},
        }).execute()
    except Exception as e:
        logger.error(f"log_automation error: {e}")


def get_business_whatsapp(business_id: str, supabase=None) -> Optional[str]:
    """
    Get the WhatsApp phone number for a business.
    Priority: whatsapp_number > phone > notification_preferences.whatsapp_phone
    Returns E.164 format (+972XXXXXXXXX) or None.
    """
    sb = supabase or _get_supabase()
    if not sb:
        return None

    try:
        from utils.phone import format_for_whatsapp, is_valid_israeli_mobile

        biz = (
            sb.table("businesses")
            .select("whatsapp_number, phone, notification_whatsapp, workspace_id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        if not biz.data:
            return None

        # Respect the user's WhatsApp notification preference
        if not biz.data.get("notification_whatsapp", True):
            return None

        # Try whatsapp_number first, then phone column
        for field in ("whatsapp_number", "phone"):
            raw = biz.data.get(field)
            if raw and is_valid_israeli_mobile(raw):
                return format_for_whatsapp(raw)

        # Fallback to notification preferences
        workspace_id = biz.data.get("workspace_id")
        if workspace_id:
            prefs = (
                sb.table("notification_preferences")
                .select("whatsapp_phone")
                .eq("workspace_id", workspace_id)
                .maybe_single()
                .execute()
            )
            if prefs.data and prefs.data.get("whatsapp_phone"):
                return format_for_whatsapp(prefs.data["whatsapp_phone"])
    except Exception as e:
        logger.error(f"get_business_whatsapp error: {e}")

    return None


def get_business_notification_prefs(business_id: str, supabase=None) -> dict:
    """
    Get notification preferences for a business.
    Returns dict with notification toggles and phone info.
    """
    sb = supabase or _get_supabase()
    if not sb:
        return {}

    try:
        result = (
            sb.table("businesses")
            .select(
                "notification_whatsapp, notification_email, notification_weekly_report, "
                "morning_alert_time, alert_sensitivity, whatsapp_number, phone, business_name"
            )
            .eq("id", business_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception as e:
        logger.error(f"get_business_notification_prefs error: {e}")
        return {}


def store_whatsapp_context(
    phone: str,
    context_type: str,
    context_data: dict,
    business_id: str,
    ttl_hours: int = 24,
    supabase=None,
):
    """Insert a pending approval workflow into whatsapp_contexts with expiry."""
    sb = supabase or _get_supabase()
    if not sb:
        return

    expires_at = (datetime.now(timezone.utc) + timedelta(hours=ttl_hours)).isoformat()

    try:
        sb.table("whatsapp_contexts").insert({
            "phone_number": phone,
            "context_type": context_type,
            "context_data": context_data,
            "business_id": business_id,
            "expires_at": expires_at,
        }).execute()
    except Exception as e:
        logger.error(f"store_whatsapp_context error: {e}")


def get_whatsapp_context(phone: str, supabase=None) -> Optional[dict]:
    """Fetch the latest non-expired context for a phone number."""
    sb = supabase or _get_supabase()
    if not sb:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            sb.table("whatsapp_contexts")
            .select("*")
            .eq("phone_number", phone)
            .gte("expires_at", now_iso)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.error(f"get_whatsapp_context error: {e}")

    return None
