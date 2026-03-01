"""
Agent 4 — הכיס 💰
Mission: Track revenue trends, prevent drops.
Plans: PRO only.
Runs: daily at 07:00.
"""

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class HakisAgent(BaseAgent):
    name = "hakis"
    display_name = "הכיס"
    emoji = "💰"
    description = "מנתח מגמות ומזהה סיכונים לפני שהם מגיעים"
    plan_access = "pro"

    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        biz = self.get_business_data(supabase, business_id)
        if not biz:
            return {"items_found": 0, "tokens_used": 0}

        # Gather trend data
        trend_data = self._gather_trend_data(biz, business_id, supabase)

        system = """אתה יועץ פיננסי לעסקים קטנים.
נתח מגמות וזהה סיכונים עתידיים.
דבר בעברית, ספציפי עם מספרים.
החזר JSON בלבד:
{
  "trend": "up"|"down"|"stable",
  "prediction": string,
  "risk_level": "high"|"medium"|"low",
  "recommendation": string,
  "action": string
}"""

        user_prompt = f"""סוג עסק: {biz.get('business_type', '')}
שם: {biz.get('name_hebrew', biz.get('name', ''))}
נתוני מגמות: {json.dumps(trend_data, ensure_ascii=False)}"""

        try:
            response, tokens = self.call_claude(system, user_prompt, supabase, user_id)
            parsed = json.loads(response.strip().strip("```json").strip("```"))

            trend = parsed.get("trend", "stable")
            risk = parsed.get("risk_level", "low")

            # Save to revenue_trends
            supabase.table("revenue_trends").insert({
                "business_id": business_id,
                "trend": trend if trend in ("up", "down", "stable") else "stable",
                "risk_level": risk if risk in ("high", "medium", "low") else "low",
                "prediction": parsed.get("prediction", ""),
                "recommendation": parsed.get("recommendation", ""),
                "data": json.dumps(trend_data, ensure_ascii=False),
            }).execute()

            self.log_finding(supabase, user_id, "revenue_trend", parsed)
            items = 1

            # High risk → immediate WhatsApp
            if risk == "high":
                phone = self.get_business_phone(supabase, business_id)
                name = (biz.get("name_hebrew") or biz.get("name", "")).split()[0]
                app_url = os.getenv("APP_URL", "https://quieteyes.co.il")

                if phone:
                    msg = f"""💰 {name}, שמתי לב למשהו חשוב

{parsed.get('prediction', '')}

מה שאני ממליץ לעשות עכשיו:
→ {parsed.get('action', '')}

👉 {app_url}/dashboard/intelligence"""
                    self.send_whatsapp(phone, msg)

                # Create urgent intel item
                supabase.table("intelligence_events").insert({
                    "business_id": business_id,
                    "event_type": "revenue_risk",
                    "title": f"הכיס זיהה סיכון: {parsed.get('prediction', '')[:80]}",
                    "description": parsed.get("recommendation", ""),
                    "severity": "high",
                    "source": "hakis_agent",
                }).execute()
                items += 1

            # Trend down for 2+ weeks → action plan
            if trend == "down":
                try:
                    two_weeks = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
                    prev = supabase.table("revenue_trends").select("trend").eq(
                        "business_id", business_id
                    ).gte("created_at", two_weeks).order("created_at", desc=True).limit(3).execute()
                    down_streak = sum(1 for r in (prev.data or []) if r.get("trend") == "down")
                    if down_streak >= 2:
                        supabase.table("intelligence_events").insert({
                            "business_id": business_id,
                            "event_type": "revenue_decline",
                            "title": "ירידה מתמשכת — הכיס הכין תוכנית היפוך",
                            "description": parsed.get("recommendation", ""),
                            "severity": "high",
                            "source": "hakis_agent",
                        }).execute()
                        items += 1
                except Exception:
                    pass

            return {"items_found": items, "tokens_used": tokens}

        except Exception as e:
            logger.error(f"[hakis] Analysis failed: {e}")
            return {"items_found": 0, "tokens_used": 0}

    def _gather_trend_data(self, biz: dict, business_id: str, supabase) -> dict:
        """Gather data for trend analysis."""
        data = {}
        now = datetime.now(timezone.utc)

        # Lead volume by week (last 90 days)
        try:
            ninety_days = (now - timedelta(days=90)).isoformat()
            leads = supabase.table("leads_discovered").select("created_at").eq(
                "business_id", business_id
            ).gte("created_at", ninety_days).execute()

            weekly = {}
            for lead in (leads.data or []):
                dt = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                week_key = dt.strftime("%Y-W%W")
                weekly[week_key] = weekly.get(week_key, 0) + 1
            data["leads_by_week"] = weekly
        except Exception:
            data["leads_by_week"] = {}

        # Competitor activity trends
        try:
            month_ago = (now - timedelta(days=30)).isoformat()
            events = supabase.table("intelligence_events").select("event_type, created_at").eq(
                "business_id", business_id
            ).gte("created_at", month_ago).execute()
            data["events_last_30d"] = len(events.data or [])
        except Exception:
            data["events_last_30d"] = 0

        # Health score history
        try:
            history = supabase.table("health_score_history").select("score, calculated_at").eq(
                "business_id", business_id
            ).order("calculated_at", desc=True).limit(8).execute()
            data["health_scores"] = [(h["score"], h["calculated_at"]) for h in (history.data or [])]
        except Exception:
            data["health_scores"] = []

        # Current competitor count and ratings
        try:
            comps = supabase.table("competitors").select("google_rating, perceived_threat_level").eq(
                "business_id", business_id
            ).execute()
            data["competitors_count"] = len(comps.data or [])
            data["high_threats"] = sum(1 for c in (comps.data or []) if c.get("perceived_threat_level") == "High")
        except Exception:
            data["competitors_count"] = 0
            data["high_threats"] = 0

        data["business_type"] = biz.get("business_type", "")
        data["city"] = biz.get("city", "")

        return data


def get_hakis_agent():
    return HakisAgent()
