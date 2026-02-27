"""
Trial Conversion Service — automated trial-to-paid conversion flow.

Checks trial status for all businesses and sends appropriate
touchpoint messages (WhatsApp) based on trial day.

Touchpoints: Day 1, 3, 7, 12, 13, 14, 21
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None

# Touchpoint schedule: day number -> touchpoint key
TOUCHPOINT_SCHEDULE = {
    1: "day1_welcome",
    3: "day3_value",
    7: "day7_halfway",
    12: "day12_urgency",
    13: "day13_last_chance",
    14: "day14_expired",
    21: "day21_winback",
}


class TrialConversion:
    """Manages trial conversion touchpoints."""

    def check_all_trials(self, supabase) -> int:
        """
        Check all businesses with active/expired trials and send appropriate touchpoints.
        Called daily by the scheduler.
        Returns count of touchpoints sent.
        """
        count = 0
        now = datetime.now(timezone.utc)

        try:
            # Get all businesses with their subscription and user info
            businesses = (
                supabase.table("businesses")
                .select("id, business_name, first_name, user_id, phone, whatsapp_number, notification_whatsapp, created_at")
                .execute()
            )

            for biz in (businesses.data or []):
                biz_id = biz["id"]
                user_id = biz.get("user_id")
                if not user_id:
                    continue

                # Get subscription info
                try:
                    sub = (
                        supabase.table("subscriptions")
                        .select("tier, trial_ends_at, trial_touchpoints_sent, plan_started_at")
                        .eq("user_id", user_id)
                        .maybe_single()
                        .execute()
                    )
                    sub_data = sub.data if sub.data else {}
                except Exception:
                    sub_data = {}

                # Skip if already paying (converted)
                tier = sub_data.get("tier", "free")
                if tier not in ("free", "starter") or sub_data.get("plan_started_at"):
                    # Check if they actually converted (have a paid tier beyond trial)
                    if tier not in ("free",):
                        continue

                trial_ends_at_str = sub_data.get("trial_ends_at")
                if not trial_ends_at_str:
                    # No trial — use business created_at + 14 days as fallback
                    created_at = biz.get("created_at")
                    if not created_at:
                        continue
                    try:
                        created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        trial_end = created_dt + timedelta(days=14)
                        trial_ends_at_str = trial_end.isoformat()
                    except Exception:
                        continue

                try:
                    trial_end = datetime.fromisoformat(trial_ends_at_str.replace("Z", "+00:00"))
                except Exception:
                    continue

                trial_start = trial_end - timedelta(days=14)
                trial_day = (now - trial_start).days

                # Get already-sent touchpoints
                sent_raw = sub_data.get("trial_touchpoints_sent") or "[]"
                if isinstance(sent_raw, list):
                    sent_touchpoints = sent_raw
                else:
                    try:
                        sent_touchpoints = json.loads(sent_raw) if isinstance(sent_raw, str) else []
                    except Exception:
                        sent_touchpoints = []

                # Check if there's a touchpoint to send for this day
                touchpoint_key = TOUCHPOINT_SCHEDULE.get(trial_day)
                if not touchpoint_key:
                    continue

                if touchpoint_key in sent_touchpoints:
                    continue

                # Check notification preferences
                if not biz.get("notification_whatsapp", True):
                    continue

                # Get phone number
                phone = self._get_phone(biz, supabase)
                if not phone:
                    continue

                # Send the touchpoint
                sent = self._send_touchpoint(
                    touchpoint_key=touchpoint_key,
                    biz=biz,
                    biz_id=biz_id,
                    phone=phone,
                    trial_day=trial_day,
                    supabase=supabase,
                )

                if sent:
                    # Mark as sent
                    sent_touchpoints.append(touchpoint_key)
                    try:
                        supabase.table("subscriptions").update({
                            "trial_touchpoints_sent": json.dumps(sent_touchpoints),
                        }).eq("user_id", user_id).execute()
                    except Exception as e:
                        logger.debug(f"[TrialConversion] Failed to update touchpoints: {e}")

                    # Log
                    try:
                        from services.automation_helpers import log_automation
                        log_automation(
                            business_id=biz_id,
                            automation_type="trial_conversion",
                            trigger_event=f"trial_day_{trial_day}",
                            action_taken=touchpoint_key,
                            result="sent",
                            details={"trial_day": trial_day, "phone": phone[:8] + "..."},
                            supabase=supabase,
                        )
                    except Exception:
                        pass

                    count += 1

        except Exception as e:
            logger.error(f"[TrialConversion] check_all_trials error: {e}")

        return count

    def _get_phone(self, biz: dict, supabase) -> Optional[str]:
        """Get formatted phone for WhatsApp."""
        try:
            from utils.phone import format_for_whatsapp, is_valid_israeli_mobile
            for field in ("whatsapp_number", "phone"):
                raw = biz.get(field)
                if raw and is_valid_israeli_mobile(raw):
                    return format_for_whatsapp(raw)
        except Exception:
            pass
        return None

    def _send_touchpoint(
        self,
        touchpoint_key: str,
        biz: dict,
        biz_id: str,
        phone: str,
        trial_day: int,
        supabase,
    ) -> bool:
        """Send a specific touchpoint message. Returns True if sent."""
        from services.whatsapp import send_whatsapp_message
        from services.whatsapp_templates import (
            trial_day1_welcome,
            trial_day3_value,
            trial_day7_halfway,
            trial_day12_urgency,
            trial_day13_last_chance,
            trial_day14_expired,
            trial_day21_winback,
        )

        name = biz.get("first_name") or biz.get("business_name", "")
        biz_name = biz.get("business_name", "")

        try:
            stats = self._get_trial_stats(biz_id, supabase)

            if touchpoint_key == "day1_welcome":
                msg = trial_day1_welcome(
                    name=name,
                    competitors_found=stats.get("competitors_count", 0),
                    leads_found=stats.get("leads_count", 0),
                )
            elif touchpoint_key == "day3_value":
                insight = self._generate_insight(biz_id, biz_name, supabase)
                msg = trial_day3_value(
                    name=name,
                    leads_found=stats.get("leads_count", 0),
                    competitor_changes=stats.get("competitor_changes", 0),
                    new_businesses=stats.get("new_businesses", 0),
                    insight=insight,
                )
            elif touchpoint_key == "day7_halfway":
                insight = self._generate_insight(biz_id, biz_name, supabase)
                msg = trial_day7_halfway(
                    name=name,
                    business_name=biz_name,
                    leads_found=stats.get("leads_count", 0),
                    competitors_tracked=stats.get("competitors_count", 0),
                    changes_detected=stats.get("competitor_changes", 0),
                    alerts_sent=stats.get("alerts_sent", 0),
                    best_insight=insight,
                )
            elif touchpoint_key == "day12_urgency":
                msg = trial_day12_urgency(
                    name=name,
                    leads_found=stats.get("leads_count", 0),
                    competitor_changes=stats.get("competitor_changes", 0),
                    health_score=stats.get("health_score", 65),
                )
            elif touchpoint_key == "day13_last_chance":
                msg = trial_day13_last_chance(name=name)
            elif touchpoint_key == "day14_expired":
                msg = trial_day14_expired(name=name)
            elif touchpoint_key == "day21_winback":
                msg = trial_day21_winback(
                    name=name,
                    leads_missed=stats.get("leads_since_expiry", 0),
                )
            else:
                return False

            send_whatsapp_message(phone, msg)
            logger.info(f"[TrialConversion] Sent {touchpoint_key} to {biz_id}")
            return True

        except Exception as e:
            logger.error(f"[TrialConversion] Send {touchpoint_key} error: {e}")
            return False

    def _get_trial_stats(self, business_id: str, supabase) -> dict:
        """Gather trial usage stats for a business."""
        stats = {
            "leads_count": 0,
            "competitors_count": 0,
            "competitor_changes": 0,
            "new_businesses": 0,
            "alerts_sent": 0,
            "health_score": 65,
            "leads_since_expiry": 0,
        }

        try:
            leads = supabase.table("leads_discovered").select("id").eq("business_id", business_id).execute()
            stats["leads_count"] = len(leads.data or [])
        except Exception:
            pass

        try:
            comps = supabase.table("competitors").select("id").eq("business_id", business_id).execute()
            stats["competitors_count"] = len(comps.data or [])
        except Exception:
            pass

        try:
            events = (
                supabase.table("intelligence_events")
                .select("id, event_type")
                .eq("business_id", business_id)
                .execute()
            )
            event_list = events.data or []
            stats["competitor_changes"] = sum(1 for e in event_list if e.get("event_type") == "competitor_change")
            stats["new_businesses"] = sum(1 for e in event_list if e.get("event_type") == "new_competitor")
        except Exception:
            pass

        try:
            alerts = (
                supabase.table("automation_log")
                .select("id")
                .eq("business_id", business_id)
                .execute()
            )
            stats["alerts_sent"] = len(alerts.data or [])
        except Exception:
            pass

        return stats

    def _generate_insight(self, business_id: str, business_name: str, supabase) -> str:
        """Generate a one-line AI insight from the business's data."""
        try:
            from services.claude_client import analyze
            stats = self._get_trial_stats(business_id, supabase)
            prompt = (
                f"כתוב תובנה עסקית אחת (משפט אחד בלבד) בעברית עבור העסק '{business_name}'. "
                f"נתונים: {stats['leads_count']} לידים, {stats['competitors_count']} מתחרים, "
                f"{stats['competitor_changes']} שינויים אצל מתחרים. "
                f"תובנה קצרה ופרקטית:"
            )
            return analyze(prompt, max_tokens=100, temperature=0.7).strip()
        except Exception:
            return ""


def get_trial_conversion() -> TrialConversion:
    global _instance
    if _instance is None:
        _instance = TrialConversion()
    return _instance
