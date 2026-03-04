"""
Morning Briefing — daily WhatsApp summary for business owners.

Gathers overnight events, leads, competitor changes, and predictions
into a concise Hebrew briefing sent via WhatsApp each morning.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


class MorningBriefing:
    """Generates and sends daily morning briefings via WhatsApp."""

    def send_morning_briefing(self, business_id: str, supabase) -> bool:
        """
        Generate and send a morning briefing for a business.

        1. Check is_automation_enabled('morning_briefing')
        2. Gather: new leads, events, competitor changes, prediction, memory context
        3. claude_client.analyze() -> 5-line Hebrew briefing
        4. Format WhatsApp message
        5. send_whatsapp_message(), log_automation()

        Returns True if briefing was sent successfully.
        """
        from services.automation_helpers import (
            is_automation_enabled,
            get_business_whatsapp,
            log_automation,
        )

        if not is_automation_enabled(business_id, "morning_briefing", supabase):
            return False

        phone = get_business_whatsapp(business_id, supabase)
        if not phone:
            logger.debug(f"[MorningBriefing] No WhatsApp for {business_id}")
            return False

        try:
            # Gather data
            biz_info = self._get_business_info(business_id, supabase)
            if not biz_info:
                return False

            overnight_data = self._gather_overnight_data(business_id, supabase)

            # Get memory context and prediction
            memory_context = ""
            try:
                from services.memory_engine import get_memory_engine
                memory_context = get_memory_engine().get_context_for_ai(business_id, supabase)
            except Exception:
                pass

            prediction_text = ""
            try:
                from services.prediction_engine import get_prediction_engine
                pred = get_prediction_engine().get_latest_prediction(business_id, supabase)
                if pred:
                    prediction_text = pred.get("prediction_text", "")
            except Exception:
                pass

            # Generate briefing with Claude
            briefing = self._generate_briefing(
                biz_info, overnight_data, memory_context, prediction_text
            )

            # Format and send using template
            leads_count = overnight_data.get("new_leads", 0)
            events_count = overnight_data.get("new_events", 0)
            competitor_count = len(overnight_data.get("competitor_changes", []))

            from services.whatsapp_templates import morning_summary
            message = morning_summary(
                business_name=biz_info.get("business_name", ""),
                hot_leads=leads_count,
                competitor_changes=competitor_count,
                recommended_action=briefing.split("\n")[0] if briefing else "",
            )

            from services.whatsapp import send_whatsapp_message
            send_whatsapp_message(phone, message)

            log_automation(
                business_id=business_id,
                automation_type="morning_briefing",
                trigger_event="scheduled_daily",
                action_taken="briefing_sent",
                result="success",
                details={
                    "leads_count": leads_count,
                    "events_count": events_count,
                },
                supabase=supabase,
            )

            logger.info(f"[MorningBriefing] Sent to {business_id}")
            return True

        except Exception as e:
            logger.error(f"[MorningBriefing] Error for {business_id}: {e}")
            log_automation(
                business_id=business_id,
                automation_type="morning_briefing",
                trigger_event="scheduled_daily",
                action_taken="briefing_failed",
                result="error",
                details={"error": str(e)},
                supabase=supabase,
            )
            return False

    def send_for_all_businesses(self, supabase) -> int:
        """
        Send morning briefings to all businesses that have it enabled,
        notification_whatsapp is on, and whose morning_alert_time matches.
        Returns count of briefings sent.
        """
        from services.automation_helpers import is_automation_enabled

        current_hour = datetime.now(timezone.utc).hour
        count = 0

        try:
            # Get all businesses with their notification preferences
            result = (
                supabase.table("businesses")
                .select("id, morning_alert_time, notification_whatsapp")
                .execute()
            )
            businesses = result.data or []

            for biz in businesses:
                biz_id = biz["id"]

                # Skip if user disabled WhatsApp notifications
                if not biz.get("notification_whatsapp", True):
                    continue

                # Check morning_alert_time (stored as HH:MM Israel time)
                # Convert Israel time to UTC using proper timezone
                alert_time = biz.get("morning_alert_time") or "09:00"
                try:
                    alert_hour_local = int(str(alert_time).split(":")[0])
                    # Israel is UTC+2 (winter) or UTC+3 (summer/DST)
                    from datetime import datetime, timezone, timedelta
                    now_utc = datetime.now(timezone.utc)
                    # March last Friday to October last Sunday = DST (UTC+3)
                    month = now_utc.month
                    is_dst = 3 < month < 10 or (month == 3 and now_utc.day >= 25) or (month == 10 and now_utc.day < 25)
                    israel_offset = 3 if is_dst else 2
                    target_hour_utc = (alert_hour_local - israel_offset) % 24
                except (ValueError, IndexError):
                    target_hour_utc = 6  # default 09:00 Israel = 06:00 UTC (summer)

                if current_hour != target_hour_utc:
                    continue

                if self.send_morning_briefing(biz_id, supabase):
                    count += 1

        except Exception as e:
            logger.error(f"[MorningBriefing] send_for_all error: {e}")

        return count

    def _get_business_info(self, business_id: str, supabase) -> Optional[dict]:
        """Fetch basic business info."""
        try:
            result = (
                supabase.table("businesses")
                .select("business_name, industry, location, google_rating")
                .eq("id", business_id)
                .single()
                .execute()
            )
            return result.data
        except Exception:
            return None

    def _gather_overnight_data(self, business_id: str, supabase) -> dict:
        """Gather events and leads from the last 24 hours."""
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        data = {"new_leads": 0, "new_events": 0, "events_summary": [], "competitor_changes": []}

        try:
            # New leads
            leads = (
                supabase.table("leads_discovered")
                .select("id")
                .eq("business_id", business_id)
                .gte("created_at", since)
                .execute()
            )
            data["new_leads"] = len(leads.data or [])
        except Exception:
            pass

        try:
            # Intelligence events
            events = (
                supabase.table("intelligence_events")
                .select("title, event_type, severity")
                .eq("business_id", business_id)
                .gte("created_at", since)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            event_rows = events.data or []
            data["new_events"] = len(event_rows)
            data["events_summary"] = [
                {"title": e.get("title", ""), "type": e.get("event_type", "")}
                for e in event_rows[:5]
            ]
        except Exception:
            pass

        try:
            # Competitor changes
            comp_events = (
                supabase.table("intelligence_events")
                .select("title, description")
                .eq("business_id", business_id)
                .eq("event_type", "competitor_change")
                .gte("created_at", since)
                .limit(3)
                .execute()
            )
            data["competitor_changes"] = [
                e.get("title", "") for e in (comp_events.data or [])
            ]
        except Exception:
            pass

        return data

    def _generate_briefing(
        self,
        biz_info: dict,
        overnight_data: dict,
        memory_context: str,
        prediction_text: str,
    ) -> str:
        """Generate a 5-line Hebrew briefing using Claude."""
        from services.claude_client import analyze

        events_text = "\n".join(
            f"- {e['title']}" for e in overnight_data.get("events_summary", [])
        ) or "אין אירועים חדשים"

        competitor_text = "\n".join(
            f"- {c}" for c in overnight_data.get("competitor_changes", [])
        ) or "אין שינויים"

        # Get city context for locally relevant briefing
        city_context = ""
        try:
            from data.cities import get_city_context
            ctx = get_city_context(biz_info.get("location", ""))
            if ctx:
                city_context = f"\nהקשר עירוני:\n{ctx}"
        except Exception:
            pass

        prompt = f"""אתה עוזר עסקי. צור תדריך בוקר קצר (5 שורות מקסימום) בעברית.

עסק: {biz_info.get('business_name', '')}
תחום: {biz_info.get('industry', '')}
מיקום: {biz_info.get('location', '')}
דירוג: {biz_info.get('google_rating', 'N/A')}
{city_context}

לידים חדשים (24 שעות): {overnight_data.get('new_leads', 0)}
אירועי מודיעין: {overnight_data.get('new_events', 0)}

אירועים אחרונים:
{events_text}

שינויים במתחרים:
{competitor_text}

{f'תחזית: {prediction_text}' if prediction_text else ''}

{f'הקשר היסטורי: {memory_context[:500]}' if memory_context else ''}

כתוב תדריך בוקר קצר, ישיר ופרקטי. 5 שורות מקסימום. התמקד במה שחשוב היום."""

        try:
            return analyze(prompt, max_tokens=500, temperature=0.7)
        except Exception as e:
            logger.error(f"[MorningBriefing] Claude error: {e}")
            return (
                f"📊 {overnight_data.get('new_events', 0)} אירועים חדשים\n"
                f"🎯 {overnight_data.get('new_leads', 0)} לידים חדשים\n"
                f"המשך יום פרודוקטיבי!"
            )


def get_morning_briefing() -> MorningBriefing:
    global _instance
    if _instance is None:
        _instance = MorningBriefing()
    return _instance
