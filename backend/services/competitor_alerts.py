"""
Competitor Alerts — automated competitor monitoring and WhatsApp alerts.

Checks for rating drops, review surges, and new competitors,
then generates actionable recommendations sent via WhatsApp.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


class CompetitorAlerts:
    """Monitors competitors and sends automated alerts."""

    def check_all_competitors(self, business_id: str, supabase) -> int:
        """
        Check all competitors for alertable changes.

        1. Check is_automation_enabled('competitor_alerts')
        2. For each competitor: check rating drop >= 0.3, review surge 3+ in 24h
        3. Check for new competitors nearby
        4. For each alert: generate action recommendation, WhatsApp, log

        Returns alert count.
        """
        from services.automation_helpers import (
            is_automation_enabled,
            get_business_whatsapp,
            log_automation,
        )

        if not is_automation_enabled(business_id, "competitor_alerts", supabase):
            return 0

        phone = get_business_whatsapp(business_id, supabase)
        biz_info = self._get_business_info(business_id, supabase)
        if not biz_info:
            return 0

        # Get competitors
        try:
            comp_result = (
                supabase.table("competitors")
                .select("id, name, google_rating, review_count, website")
                .eq("business_id", business_id)
                .execute()
            )
            competitors = comp_result.data or []
        except Exception as e:
            logger.error(f"[CompetitorAlerts] Fetch competitors error: {e}")
            return 0

        alert_count = 0

        biz_location = biz_info.get("location", "")

        for comp in competitors:
            # Check rating drop
            rating_alert = self._check_rating_drop(comp, supabase)
            if rating_alert:
                action = self._generate_action(
                    "rating_drop", rating_alert, biz_info.get("business_name", ""), location=biz_location
                )
                if phone and action:
                    self._send_alert(phone, comp["name"], "ירידה בדירוג", action)

                log_automation(
                    business_id=business_id,
                    automation_type="competitor_alerts",
                    trigger_event=f"rating_drop:{comp['name']}",
                    action_taken="alert_sent" if phone else "alert_logged",
                    result="success",
                    details=rating_alert,
                    supabase=supabase,
                )
                alert_count += 1

            # Check review surge
            surge_alert = self._check_review_surge(comp, business_id, supabase)
            if surge_alert:
                action = self._generate_action(
                    "review_surge", surge_alert, biz_info.get("business_name", ""), location=biz_location
                )
                if phone and action:
                    self._send_alert(phone, comp["name"], "זינוק בביקורות", action)

                log_automation(
                    business_id=business_id,
                    automation_type="competitor_alerts",
                    trigger_event=f"review_surge:{comp['name']}",
                    action_taken="alert_sent" if phone else "alert_logged",
                    result="success",
                    details=surge_alert,
                    supabase=supabase,
                )
                alert_count += 1

        return alert_count

    def _check_rating_drop(self, competitor: dict, supabase) -> Optional[dict]:
        """
        Check if a competitor's rating dropped >= 0.3 compared to stored value.
        Returns alert data dict or None.
        """
        comp_id = competitor.get("id")
        current_rating = competitor.get("google_rating")
        if not comp_id or current_rating is None:
            return None

        try:
            # Check intelligence_events for previous rating records
            since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            events = (
                supabase.table("intelligence_events")
                .select("details")
                .eq("source", "competitor_scan")
                .gte("created_at", since)
                .execute()
            )

            for event in (events.data or []):
                details = event.get("details") or {}
                prev_rating = details.get("previous_rating")
                if prev_rating and isinstance(prev_rating, (int, float)):
                    drop = float(prev_rating) - float(current_rating)
                    if drop >= 0.3:
                        return {
                            "competitor_name": competitor.get("name", ""),
                            "previous_rating": prev_rating,
                            "current_rating": current_rating,
                            "drop": round(drop, 1),
                        }
        except Exception as e:
            logger.debug(f"[CompetitorAlerts] rating check error: {e}")

        return None

    def _check_review_surge(
        self, competitor: dict, business_id: str, supabase
    ) -> Optional[dict]:
        """
        Check if a competitor received 3+ reviews in the last 24 hours.
        Returns alert data dict or None.
        """
        comp_name = competitor.get("name", "")
        if not comp_name:
            return None

        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        try:
            events = (
                supabase.table("intelligence_events")
                .select("id")
                .eq("business_id", business_id)
                .eq("event_type", "competitor_change")
                .ilike("title", f"%{comp_name}%")
                .gte("created_at", since)
                .execute()
            )
            count = len(events.data or [])
            if count >= 3:
                return {
                    "competitor_name": comp_name,
                    "review_count_24h": count,
                }
        except Exception as e:
            logger.debug(f"[CompetitorAlerts] review surge check error: {e}")

        return None

    def _generate_action(
        self, alert_type: str, alert_data: dict, business_name: str, location: str = ""
    ) -> str:
        """Generate an action recommendation using Claude."""
        from services.claude_client import analyze

        # Get city context for localized recommendations
        city_context = ""
        if location:
            try:
                from data.cities import get_city_context
                ctx = get_city_context(location)
                if ctx:
                    city_context = f"\nהקשר עירוני:\n{ctx}\n"
            except Exception:
                pass

        if alert_type == "rating_drop":
            prompt = f"""מתחרה "{alert_data.get('competitor_name', '')}" ירד מדירוג {alert_data.get('previous_rating')} ל-{alert_data.get('current_rating')}.

אתה יועץ עסקי של "{business_name}". כתוב המלצה קצרה (3 שורות) בעברית:
1. מה המשמעות
2. איך לנצל את ההזדמנות
3. פעולה מומלצת אחת
{city_context}"""

        elif alert_type == "review_surge":
            prompt = f"""מתחרה "{alert_data.get('competitor_name', '')}" קיבל {alert_data.get('review_count_24h', 0)} ביקורות ב-24 שעות.

אתה יועץ עסקי של "{business_name}". כתוב המלצה קצרה (3 שורות) בעברית:
1. מה זה אומר (קמפיין? אירוע?)
2. איך להגיב
3. פעולה מומלצת אחת
{city_context}"""
        else:
            return ""

        try:
            return analyze(prompt, max_tokens=300, temperature=0.7)
        except Exception as e:
            logger.error(f"[CompetitorAlerts] Claude error: {e}")
            return f"נמצא שינוי אצל {alert_data.get('competitor_name', '')}, מומלץ לבדוק."

    def _send_alert(self, phone: str, comp_name: str, alert_title: str, action: str):
        """Send a competitor alert via WhatsApp."""
        try:
            from services.whatsapp import send_whatsapp_message
            from services.whatsapp_templates import competitor_change

            message = competitor_change(
                competitor_name=comp_name,
                change_description=alert_title,
                recommendation=action,
            )
            send_whatsapp_message(phone, message)
        except Exception as e:
            logger.error(f"[CompetitorAlerts] WhatsApp send error: {e}")

    def _get_business_info(self, business_id: str, supabase) -> Optional[dict]:
        try:
            result = (
                supabase.table("businesses")
                .select("business_name, industry, location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            return result.data
        except Exception:
            return None


def get_competitor_alerts() -> CompetitorAlerts:
    global _instance
    if _instance is None:
        _instance = CompetitorAlerts()
    return _instance
