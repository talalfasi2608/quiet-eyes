"""
Agent 2 — המוח 🧠
Mission: Generate daily tasks + smart alerts + morning brief + health score.
Runs: daily at 06:00 for all paid users.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class HamoaAgent(BaseAgent):
    name = "hamoa"
    display_name = "המוח"
    emoji = "🧠"
    description = "מכין משימות יומיות, התראות חכמות וסיכום בוקר"
    plan_access = "paid"

    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        biz = self.get_business_data(supabase, business_id)
        if not biz:
            return {"items_found": 0, "tokens_used": 0}

        items = 0
        tokens = 0

        # ── Task A: Generate Daily Tasks ──
        try:
            t_items, t_tokens = self._generate_daily_tasks(biz, business_id, user_id, supabase)
            items += t_items
            tokens += t_tokens
        except Exception as e:
            logger.error(f"[hamoa] Task generation failed for {business_id}: {e}")

        # ── Task B: Smart Alerts ──
        try:
            a_items = self._check_smart_alerts(biz, business_id, user_id, supabase)
            items += a_items
        except Exception as e:
            logger.error(f"[hamoa] Smart alerts failed for {business_id}: {e}")

        # ── Task C: Morning Brief WhatsApp ──
        try:
            self._send_morning_brief(biz, business_id, user_id, supabase)
        except Exception as e:
            logger.error(f"[hamoa] Morning brief failed for {business_id}: {e}")

        # ── Task D: Health Score Recalculation ──
        try:
            self._recalc_health_score(business_id, supabase)
        except Exception as e:
            logger.error(f"[hamoa] Health score failed for {business_id}: {e}")

        return {"items_found": items, "tokens_used": tokens}

    def _generate_daily_tasks(self, biz: dict, business_id: str, user_id: str, supabase) -> tuple:
        """Generate 3 daily tasks using Claude."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Delete previous uncompleted tasks
        try:
            supabase.table("daily_tasks").delete().eq(
                "business_id", business_id
            ).eq("completed", False).lt(
                "generated_at", today_start.isoformat()
            ).execute()
        except Exception:
            pass

        # Check if already generated today
        try:
            existing = supabase.table("daily_tasks").select("id").eq(
                "business_id", business_id
            ).gte("generated_at", today_start.isoformat()).execute()
            if existing.data:
                return 0, 0
        except Exception:
            pass

        # Gather data for Claude
        data = {}

        # Hot leads
        try:
            leads = supabase.table("leads_discovered").select("summary, relevance_score").eq(
                "business_id", business_id
            ).gte("relevance_score", 70).order("created_at", desc=True).limit(5).execute()
            data["hot_leads"] = leads.data or []
        except Exception:
            data["hot_leads"] = []

        # Competitor changes this week
        try:
            week_ago = (now - timedelta(days=7)).isoformat()
            events = supabase.table("intelligence_events").select("title, severity").eq(
                "business_id", business_id
            ).gte("created_at", week_ago).limit(10).execute()
            data["intel_items"] = events.data or []
        except Exception:
            data["intel_items"] = []

        # Health score
        data["health_score"] = biz.get("pulse_score", 0)

        # Yesterday's completed tasks
        try:
            yesterday = (now - timedelta(days=1)).isoformat()
            completed = supabase.table("daily_tasks").select("title").eq(
                "business_id", business_id
            ).eq("completed", True).gte("completed_at", yesterday).execute()
            data["completed_yesterday"] = [t["title"] for t in (completed.data or [])]
        except Exception:
            data["completed_yesterday"] = []

        system = """אתה יועץ עסקי לשוק הישראלי.
דבר בעברית, חברותי, ספציפי.
תמיד מבוסס על נתונים אמיתיים.
צור בדיוק 3 משימות יומיות.
החזר JSON בלבד: {"tasks": [{"title": string, "description": string, "minutes": number, "impact": "high"|"medium"|"low"}]}"""

        user_prompt = f"""סוג עסק: {biz.get('business_type', '')}
שם: {biz.get('name_hebrew', biz.get('name', ''))}
נתונים: {json.dumps(data, ensure_ascii=False)}"""

        try:
            response, tokens = self.call_claude(system, user_prompt, supabase, user_id)
            parsed = json.loads(response.strip().strip("```json").strip("```"))
            tasks = parsed.get("tasks", [])[:3]

            for task in tasks:
                impact = task.get("impact", "medium")
                if impact not in ("high", "medium", "low"):
                    impact = "medium"
                supabase.table("daily_tasks").insert({
                    "business_id": business_id,
                    "title": task.get("title", ""),
                    "description": task.get("description", ""),
                    "minutes": task.get("minutes", 15),
                    "impact": impact,
                }).execute()

            return len(tasks), tokens
        except Exception as e:
            logger.error(f"[hamoa] Claude task gen failed: {e}")
            return 0, 0

    def _check_smart_alerts(self, biz: dict, business_id: str, user_id: str, supabase) -> int:
        """Check conditions and create urgent intel items."""
        alerts = 0
        now = datetime.now(timezone.utc)
        biz_name = biz.get("name_hebrew", biz.get("name", ""))

        # Check 1: Health dropped > 10 points this week
        try:
            week_ago = (now - timedelta(days=7)).isoformat()
            history = supabase.table("health_score_history").select("score").eq(
                "business_id", business_id
            ).order("calculated_at", desc=True).limit(2).execute()
            if history.data and len(history.data) >= 2:
                current = history.data[0]["score"]
                previous = history.data[1]["score"]
                if previous - current > 10:
                    supabase.table("intelligence_events").insert({
                        "business_id": business_id,
                        "event_type": "health_drop",
                        "title": f"ציון הבריאות ירד מ-{previous} ל-{current}",
                        "description": "כדאי לבדוק מה קרה ולפעול.",
                        "severity": "high",
                        "source": "hamoa_agent",
                    }).execute()
                    alerts += 1
        except Exception:
            pass

        # Check 2: No leads in 48h
        try:
            two_days = (now - timedelta(hours=48)).isoformat()
            leads = supabase.table("leads_discovered").select("id").eq(
                "business_id", business_id
            ).gte("created_at", two_days).limit(1).execute()
            if not leads.data:
                supabase.table("intelligence_events").insert({
                    "business_id": business_id,
                    "event_type": "no_leads",
                    "title": "לא נמצאו לידים ב-48 שעות",
                    "description": "בוא נרחיב את החיפוש.",
                    "severity": "medium",
                    "source": "hamoa_agent",
                }).execute()
                alerts += 1
        except Exception:
            pass

        # Check 3: User not logged in 3+ days
        try:
            last_login = biz.get("last_login_at")
            if last_login:
                last_dt = datetime.fromisoformat(last_login.replace("Z", "+00:00"))
                if (now - last_dt).days >= 3:
                    # Count what happened while away
                    leads_count = 0
                    try:
                        since = last_dt.isoformat()
                        r = supabase.table("leads_discovered").select("id").eq(
                            "business_id", business_id
                        ).gte("created_at", since).execute()
                        leads_count = len(r.data or [])
                    except Exception:
                        pass

                    supabase.table("intelligence_events").insert({
                        "business_id": business_id,
                        "event_type": "inactive_user",
                        "title": f"3 ימים שלא הצצת — עיני מצא {leads_count} דברים בינתיים",
                        "severity": "medium",
                        "source": "hamoa_agent",
                    }).execute()
                    alerts += 1
        except Exception:
            pass

        return alerts

    def _send_morning_brief(self, biz: dict, business_id: str, user_id: str, supabase):
        """Send morning WhatsApp brief."""
        import os

        phone = self.get_business_phone(supabase, business_id)
        if not phone:
            return

        name = biz.get("name_hebrew", biz.get("name", "")).split()[0] if biz.get("name_hebrew") or biz.get("name") else ""
        app_url = os.getenv("APP_URL", "https://quieteyes.co.il")
        now = datetime.now(timezone.utc)
        yesterday = (now - timedelta(hours=24)).isoformat()

        # Gather overnight data
        leads_count = 0
        top_lead = ""
        comp_change = ""

        try:
            leads = supabase.table("leads_discovered").select("summary, relevance_score").eq(
                "business_id", business_id
            ).gte("created_at", yesterday).order("relevance_score", desc=True).limit(3).execute()
            leads_count = len(leads.data or [])
            if leads.data:
                top_lead = (leads.data[0].get("summary") or "")[:60]
        except Exception:
            pass

        try:
            events = supabase.table("intelligence_events").select("title").eq(
                "business_id", business_id
            ).eq("event_type", "competitor_change").gte("created_at", yesterday).limit(1).execute()
            if events.data:
                comp_change = events.data[0].get("title", "")
        except Exception:
            pass

        # Get top daily task
        top_task = ""
        try:
            tasks = supabase.table("daily_tasks").select("title").eq(
                "business_id", business_id
            ).eq("completed", False).order("generated_at", desc=True).limit(1).execute()
            if tasks.data:
                top_task = tasks.data[0].get("title", "")
        except Exception:
            pass

        # Build message
        parts = [f"בוקר טוב {name} ☀️\n\nהנה מה שקרה בלילה:\n"]

        if leads_count > 0:
            parts.append(f"👀 {leads_count} אנשים מחפשים אותך")
            if top_lead:
                parts.append(f"   הכי חם: '{top_lead}'")

        if comp_change:
            parts.append(f"\n💡 {comp_change}")

        if leads_count == 0 and not comp_change:
            parts.append("😌 שקט הלילה — יום טוב להתמקד")

        if top_task:
            parts.append(f"\nדבר אחד שכדאי לעשות היום:\n→ {top_task}")

        parts.append(f"\n👉 {app_url}/dashboard")

        self.send_whatsapp(phone, "\n".join(parts))

    def _recalc_health_score(self, business_id: str, supabase):
        """Recalculate health score using real data."""
        try:
            from services.health_score_engine import get_health_score_engine
            engine = get_health_score_engine()
            engine.calculate_health_score(business_id, supabase)
        except Exception as e:
            logger.error(f"[hamoa] Health score calc failed: {e}")


def get_hamoa_agent():
    return HamoaAgent()
