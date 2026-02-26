"""
Beta Feedback Scheduler

Automated triggers for beta feedback collection:
- Day 7: NPS survey via WhatsApp
- Day 14: Feedback request via WhatsApp
- Day 30: Conversion push via WhatsApp

Called by GlobalRadar on a daily schedule.
"""

import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


def _get_service_client():
    try:
        from supabase import create_client
        import os
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def check_beta_feedback_triggers():
    """
    Check all activated beta users and send feedback triggers
    based on their activation date.

    - Day 7: NPS survey
    - Day 14: Feature feedback request
    - Day 30: Conversion push

    Tracks sent triggers in beta_feedback to avoid duplicates.
    """
    supabase = _get_service_client()
    if not supabase:
        logger.debug("[BetaScheduler] No service client available")
        return

    now = datetime.now(timezone.utc)

    # Get all activated beta users
    result = (
        supabase.table("beta_waitlist")
        .select("id, name, phone, email, activated_at")
        .eq("status", "activated")
        .not_.is_("activated_at", "null")
        .execute()
    )
    users = result.data or []
    if not users:
        return

    # Get all existing feedback triggers to avoid duplicates
    existing_triggers = (
        supabase.table("beta_feedback")
        .select("user_id, trigger")
        .in_("trigger", ["day_7", "day_14", "day_30"])
        .execute()
    )
    sent_set: set[tuple[str, str]] = set()
    for t in existing_triggers.data or []:
        sent_set.add((t["user_id"], t["trigger"]))

    triggers_sent = 0

    for user in users:
        activated_at = datetime.fromisoformat(
            user["activated_at"].replace("Z", "+00:00")
        )
        days_since = (now - activated_at).days
        phone = user.get("phone")
        name = user.get("name", "")
        # We use email as a proxy user_id for waitlist users
        # In practice, this would map to the auth user_id
        user_id = user["id"]

        # Day 7: NPS Survey
        if days_since >= 7 and (user_id, "day_7") not in sent_set:
            if phone:
                _send_day7_nps(phone, name)
            _record_trigger(supabase, user_id, "day_7")
            sent_set.add((user_id, "day_7"))
            triggers_sent += 1

        # Day 14: Feedback Request
        if days_since >= 14 and (user_id, "day_14") not in sent_set:
            if phone:
                _send_day14_feedback(phone, name)
            _record_trigger(supabase, user_id, "day_14")
            sent_set.add((user_id, "day_14"))
            triggers_sent += 1

        # Day 30: Conversion Push
        if days_since >= 30 and (user_id, "day_30") not in sent_set:
            if phone:
                _send_day30_conversion(phone, name)
            _record_trigger(supabase, user_id, "day_30")
            sent_set.add((user_id, "day_30"))
            triggers_sent += 1

    if triggers_sent > 0:
        logger.info(f"[BetaScheduler] Sent {triggers_sent} feedback triggers")


def _record_trigger(supabase, user_id: str, trigger: str):
    """Record that a trigger was sent to avoid duplicates."""
    try:
        supabase.table("beta_feedback").insert({
            "user_id": user_id,
            "type": "nps" if trigger == "day_7" else "general",
            "trigger": trigger,
            "message": f"[auto-trigger] {trigger} sent",
        }).execute()
    except Exception as e:
        logger.warning(f"[BetaScheduler] Failed to record trigger: {e}")


def _send_day7_nps(phone: str, name: str):
    """Send Day 7 NPS survey via WhatsApp."""
    try:
        from services.whatsapp import send_whatsapp_message
        message = (
            f"היי {name}! 👋\n\n"
            f"עברו 7 ימים מאז שהצטרפת לבטא של Quieteyes.\n"
            f"נשמח לשמוע — בסקאלה של 0-10, כמה סביר שתמליץ עלינו לחבר?\n\n"
            f"פשוט השב עם מספר (0-10) ונשמח גם לכל מילה נוספת 💬"
        )
        send_whatsapp_message(phone, message)
    except Exception as e:
        logger.warning(f"[BetaScheduler] Day 7 NPS send failed: {e}")


def _send_day14_feedback(phone: str, name: str):
    """Send Day 14 feedback request via WhatsApp."""
    try:
        from services.whatsapp import send_whatsapp_message
        message = (
            f"היי {name}! 🎯\n\n"
            f"שבועיים ב-Quieteyes! נשמח לשמוע:\n"
            f"• מה הפיצ'ר שהכי עוזר לך?\n"
            f"• מה היית רוצה שנוסיף?\n"
            f"• יש באג שמפריע?\n\n"
            f"כל פידבק מועיל לנו מאוד! 🙏"
        )
        send_whatsapp_message(phone, message)
    except Exception as e:
        logger.warning(f"[BetaScheduler] Day 14 feedback send failed: {e}")


def _send_day30_conversion(phone: str, name: str):
    """Send Day 30 conversion push via WhatsApp."""
    try:
        from services.whatsapp import send_whatsapp_message
        message = (
            f"היי {name}! 🌟\n\n"
            f"חודש של Quieteyes! תקופת הבטא שלך מתקרבת לסיום.\n\n"
            f"בתור משתמש בטא מייסד, יש לך 50% הנחה על 3 החודשים הראשונים.\n"
            f"לא רוצה להפסיד את זה? שדרג עכשיו ותשמור על כל הנתונים שלך.\n\n"
            f"שדרג: https://app.quieteyes.co.il/dashboard/billing"
        )
        send_whatsapp_message(phone, message)
    except Exception as e:
        logger.warning(f"[BetaScheduler] Day 30 conversion send failed: {e}")
