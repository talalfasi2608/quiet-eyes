"""
Agent 3 — הקול 📢
Mission: Create weekly marketing content plan.
Plans: GROWTH + PRO only.
Runs: every Sunday at 07:00.
"""

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class HakolAgent(BaseAgent):
    name = "hakol"
    display_name = "הקול"
    emoji = "📢"
    description = "מכין תוכנית שיווק שבועית עם פוסטים מוכנים"
    plan_access = "growth_pro"

    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        biz = self.get_business_data(supabase, business_id)
        if not biz:
            return {"items_found": 0, "tokens_used": 0}

        # Gather intelligence for content
        data = self._gather_content_data(biz, business_id, supabase)

        # Generate content plan via Claude
        system = """אתה מומחה שיווק דיגיטלי לשוק הישראלי.
צור תוכנית תוכן שבועית.
כל פוסט מוכן לפרסום — לא סקיצות.
עברית, טון חברותי ומקצועי.
החזר JSON בלבד:
{
  "week_theme": string,
  "posts": [
    {
      "day": string,
      "platform": "facebook"|"instagram",
      "time": string,
      "content": string,
      "hashtags": [string],
      "cta": string,
      "image_description": string
    }
  ],
  "weekly_tip": string
}"""

        user_prompt = f"""סוג עסק: {biz.get('business_type', '')}
שם העסק: {biz.get('name_hebrew', biz.get('name', ''))}
עיר: {biz.get('city', biz.get('address', ''))}
נתונים: {json.dumps(data, ensure_ascii=False)}"""

        try:
            response, tokens = self.call_claude(system, user_prompt, supabase, user_id)
            parsed = json.loads(response.strip().strip("```json").strip("```"))

            # Save to marketing_plans
            today = datetime.now(timezone.utc).date()
            # Find start of this week (Sunday)
            days_since_sunday = (today.weekday() + 1) % 7
            week_start = today - timedelta(days=days_since_sunday)

            supabase.table("marketing_plans").insert({
                "business_id": business_id,
                "week_start": week_start.isoformat(),
                "week_theme": parsed.get("week_theme", ""),
                "posts": json.dumps(parsed.get("posts", []), ensure_ascii=False),
                "weekly_tip": parsed.get("weekly_tip", ""),
            }).execute()

            posts_count = len(parsed.get("posts", []))

            self.log_finding(supabase, user_id, "marketing_plan", {
                "week_theme": parsed.get("week_theme"),
                "posts_count": posts_count,
            })

            # Send WhatsApp notification
            phone = self.get_business_phone(supabase, business_id)
            if phone:
                name = (biz.get("name_hebrew") or biz.get("name", "")).split()[0]
                app_url = os.getenv("APP_URL", "https://quieteyes.co.il")
                msg = f"""{name}, תוכנית השיווק השבועית שלך מוכנה 📢

השבוע נדבר על: {parsed.get('week_theme', '')}

מה מחכה לך:
📅 {posts_count} פוסטים מוכנים לפרסום
💡 {parsed.get('weekly_tip', '')}

כל הפוסטים כתובים ומוכנים —
רק צריך להעתיק ולפרסם 😊

👉 {app_url}/dashboard/marketing"""
                self.send_whatsapp(phone, msg)

            return {"items_found": posts_count, "tokens_used": tokens}

        except Exception as e:
            logger.error(f"[hakol] Content generation failed: {e}")
            return {"items_found": 0, "tokens_used": 0}

    def _gather_content_data(self, biz: dict, business_id: str, supabase) -> dict:
        """Gather intelligence for content creation."""
        data = {}
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()

        # Top leads this week (what people asked for)
        try:
            leads = supabase.table("leads_discovered").select("summary").eq(
                "business_id", business_id
            ).gte("created_at", week_ago).order("relevance_score", desc=True).limit(5).execute()
            data["what_people_search"] = [l["summary"][:100] for l in (leads.data or [])]
        except Exception:
            data["what_people_search"] = []

        # Competitor names (for content gap analysis)
        try:
            comps = supabase.table("competitors").select("name").eq(
                "business_id", business_id
            ).limit(5).execute()
            data["competitors"] = [c["name"] for c in (comps.data or [])]
        except Exception:
            data["competitors"] = []

        # Business type + city for seasonal content
        data["business_type"] = biz.get("business_type", "")
        data["city"] = biz.get("city", biz.get("address", ""))

        return data


def get_hakol_agent():
    return HakolAgent()
