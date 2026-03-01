"""
Re-Engagement Checker — proactive WhatsApp nudges for inactive users.

Runs three checks to re-engage business owners:
1. User not logged in for 3 days
2. Hot lead found but not acted upon within 2 hours
3. No leads discovered in the last 48 hours

Rate-limited to 1 re-engagement message per business per day.
Every sent message is logged to the `re_engagement_log` table.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.quieteyes.co.il")


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def _get_business_name(biz: dict) -> str:
    """Extract a display name from a business row."""
    return biz.get("business_name") or biz.get("first_name") or "שלום"


def _get_business_phone(biz: dict) -> Optional[str]:
    """Return the best available phone number for WhatsApp."""
    return biz.get("whatsapp_number") or biz.get("phone") or None


def _already_sent_today(business_id: str, supabase) -> bool:
    """Return True if we already sent a re-engagement message today."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0,
    ).isoformat()

    try:
        result = (
            supabase.table("re_engagement_log")
            .select("id")
            .eq("business_id", business_id)
            .gte("sent_at", today_start)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception as e:
        logger.error(f"[ReEngagement] _already_sent_today error: {e}")
        # Fail-safe: assume already sent to avoid spamming
        return True


def _log_sent(business_id: str, message_type: str, supabase) -> None:
    """Insert a row into re_engagement_log."""
    try:
        supabase.table("re_engagement_log").insert({
            "business_id": business_id,
            "message_type": message_type,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.error(f"[ReEngagement] _log_sent error: {e}")


def _send(phone: str, message: str) -> bool:
    """Send a WhatsApp message, returning True on success."""
    from services.whatsapp import send_whatsapp_message

    try:
        return send_whatsapp_message(phone, message)
    except Exception as e:
        logger.error(f"[ReEngagement] WhatsApp send failed: {e}")
        return False


# ═══════════════════════════════════════════════════════════════
# Check 1 — User not logged in for 3 days
# ═══════════════════════════════════════════════════════════════

def _check_inactive_users(supabase) -> int:
    """
    Find businesses whose owner has not logged in for 3+ days.
    Sends a summary of what they missed.
    Returns count of messages sent.
    """
    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    sent = 0

    try:
        result = (
            supabase.table("businesses")
            .select("id, business_name, first_name, whatsapp_number, phone, last_login_at")
            .lt("last_login_at", three_days_ago)
            .execute()
        )
        businesses = result.data or []
    except Exception as e:
        logger.error(f"[ReEngagement] _check_inactive_users query error: {e}")
        return 0

    for biz in businesses:
        biz_id = biz["id"]

        if _already_sent_today(biz_id, supabase):
            continue

        phone = _get_business_phone(biz)
        if not phone:
            continue

        name = _get_business_name(biz)

        # Count new leads since last login
        new_leads = 0
        try:
            leads_result = (
                supabase.table("leads_discovered")
                .select("id")
                .eq("business_id", biz_id)
                .gte("created_at", biz.get("last_login_at", three_days_ago))
                .execute()
            )
            new_leads = len(leads_result.data or [])
        except Exception:
            pass

        # Count competitor changes since last login
        competitor_changes = 0
        try:
            comp_result = (
                supabase.table("intelligence_events")
                .select("id")
                .eq("business_id", biz_id)
                .eq("event_type", "competitor_change")
                .gte("created_at", biz.get("last_login_at", three_days_ago))
                .execute()
            )
            competitor_changes = len(comp_result.data or [])
        except Exception:
            pass

        message = (
            f"{name}, שלומך? 👋\n"
            f"\n"
            f"3 ימים שלא הצצת —\n"
            f"בינתיים עיני מצא:\n"
            f"- {new_leads} לידים חדשים\n"
            f"- {competitor_changes} שינויים אצל מתחרים\n"
            f"\n"
            f"כדאי לבדוק 👉 {_FRONTEND_URL}/dashboard"
        )

        if _send(phone, message):
            _log_sent(biz_id, "inactive_3_days", supabase)
            sent += 1
            logger.info(f"[ReEngagement] inactive_3_days sent to {biz_id}")

    return sent


# ═══════════════════════════════════════════════════════════════
# Check 2 — Hot lead not acted upon for 2 hours
# ═══════════════════════════════════════════════════════════════

def _check_hot_leads_pending(supabase) -> int:
    """
    Find high-relevance leads (score >= 85) still in 'new' status
    that were created more than 2 hours ago.
    Returns count of messages sent.
    """
    two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    sent = 0

    try:
        result = (
            supabase.table("leads_discovered")
            .select("id, business_id, relevance_score, content, search_query, created_at")
            .gte("relevance_score", 85)
            .eq("status", "new")
            .lt("created_at", two_hours_ago)
            .execute()
        )
        leads = result.data or []
    except Exception as e:
        logger.error(f"[ReEngagement] _check_hot_leads_pending query error: {e}")
        return 0

    # Group by business to avoid duplicate lookups
    biz_leads: dict[str, list[dict]] = {}
    for lead in leads:
        bid = lead.get("business_id")
        if bid:
            biz_leads.setdefault(bid, []).append(lead)

    for biz_id, biz_lead_list in biz_leads.items():
        if _already_sent_today(biz_id, supabase):
            continue

        # Fetch business info
        try:
            biz_result = (
                supabase.table("businesses")
                .select("business_name, first_name, whatsapp_number, phone")
                .eq("id", biz_id)
                .single()
                .execute()
            )
            biz = biz_result.data
        except Exception:
            continue

        if not biz:
            continue

        phone = _get_business_phone(biz)
        if not phone:
            continue

        name = _get_business_name(biz)

        # Use the hottest lead (highest score) for the message
        hottest = max(biz_lead_list, key=lambda l: l.get("relevance_score", 0))
        snippet = (hottest.get("content") or hottest.get("search_query") or "")[:80]

        message = (
            f"{name}, תזכורת קטנה 🎯\n"
            f"\n"
            f"ליד חם שנמצא לפני שעתיים\n"
            f"עוד לא טיפלת בו.\n"
            f"\n"
            f"'{snippet}'\n"
            f"\n"
            f"כדאי לפנות לפני שמישהו אחר יגיב 👉 {_FRONTEND_URL}/dashboard/sniper"
        )

        if _send(phone, message):
            _log_sent(biz_id, "hot_lead_pending", supabase)
            sent += 1
            logger.info(f"[ReEngagement] hot_lead_pending sent to {biz_id}")

    return sent


# ═══════════════════════════════════════════════════════════════
# Check 3 — No leads found in last 48 hours
# ═══════════════════════════════════════════════════════════════

def _check_no_leads_48h(supabase) -> int:
    """
    Find businesses that received 0 leads in the last 48 hours.
    Suggest broadening their search settings.
    Returns count of messages sent.
    """
    forty_eight_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    sent = 0

    try:
        biz_result = (
            supabase.table("businesses")
            .select("id, business_name, first_name, whatsapp_number, phone")
            .execute()
        )
        businesses = biz_result.data or []
    except Exception as e:
        logger.error(f"[ReEngagement] _check_no_leads_48h businesses query error: {e}")
        return 0

    for biz in businesses:
        biz_id = biz["id"]

        if _already_sent_today(biz_id, supabase):
            continue

        # Count leads in last 48 hours
        try:
            leads_result = (
                supabase.table("leads_discovered")
                .select("id")
                .eq("business_id", biz_id)
                .gte("created_at", forty_eight_hours_ago)
                .limit(1)
                .execute()
            )
            if leads_result.data:
                # Has leads — skip
                continue
        except Exception:
            continue

        phone = _get_business_phone(biz)
        if not phone:
            continue

        name = _get_business_name(biz)

        message = (
            f"{name}, עיני לא מצא לידים ב-48 שעות.\n"
            f"\n"
            f"זה יכול לקרות — בוא נרחיב קצת את החיפוש.\n"
            f"\n"
            f"👉 לחץ כדי לעדכן הגדרות: {_FRONTEND_URL}/dashboard/settings"
        )

        if _send(phone, message):
            _log_sent(biz_id, "no_leads_48h", supabase)
            sent += 1
            logger.info(f"[ReEngagement] no_leads_48h sent to {biz_id}")

    return sent


# ═══════════════════════════════════════════════════════════════
# Public entry point
# ═══════════════════════════════════════════════════════════════

def run_re_engagement_checks(supabase) -> dict:
    """
    Run all three re-engagement checks and return a summary.

    Args:
        supabase: Supabase client instance.

    Returns:
        dict with counts of messages sent per check, e.g.
        {"inactive_3_days": 2, "hot_lead_pending": 1, "no_leads_48h": 0, "total": 3}
    """
    logger.info("[ReEngagement] Starting re-engagement checks")

    inactive = _check_inactive_users(supabase)
    hot_leads = _check_hot_leads_pending(supabase)
    no_leads = _check_no_leads_48h(supabase)

    total = inactive + hot_leads + no_leads

    logger.info(
        f"[ReEngagement] Done — "
        f"inactive_3_days={inactive}, "
        f"hot_lead_pending={hot_leads}, "
        f"no_leads_48h={no_leads}, "
        f"total={total}"
    )

    return {
        "inactive_3_days": inactive,
        "hot_lead_pending": hot_leads,
        "no_leads_48h": no_leads,
        "total": total,
    }
