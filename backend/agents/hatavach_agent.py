"""
Agent 6 — הטווח 🔭
Mission: Detect market trends before they arrive.
Plans: PRO only.
Runs: every Monday at 08:00.
"""

import json
import logging
import os
from datetime import datetime, timezone
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class HatavachAgent(BaseAgent):
    name = "hatavach"
    display_name = "הטווח"
    emoji = "🔭"
    description = "מזהה מגמות שוק לפני שהן מגיעות"
    plan_access = "pro"

    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        biz = self.get_business_data(supabase, business_id)
        if not biz:
            return {"items_found": 0, "tokens_used": 0}

        biz_type = biz.get("business_type", "")
        city = biz.get("city", biz.get("address", ""))

        if not biz_type:
            return {"items_found": 0, "tokens_used": 0}

        # Search for trends
        trend_data = self._search_trends(biz_type, city)

        system = """אתה אנליסט שוק לעסקים קטנים בישראל.
זהה מגמות שמגיעות לפני שהן מגיעות.
דבר בעברית, ספציפי, עם טווח זמן.
החזר JSON בלבד:
{
  "trends": [
    {
      "name": string,
      "arriving_in": string,
      "confidence": "high"|"medium"|"low",
      "opportunity": string,
      "action": string
    }
  ],
  "upcoming_events": [
    {
      "name": string,
      "date": string,
      "relevance": string,
      "preparation": string
    }
  ]
}"""

        user_prompt = f"""סוג עסק: {biz_type}
עיר: {city}
נתוני מגמות: {json.dumps(trend_data, ensure_ascii=False)}"""

        try:
            response, tokens = self.call_claude(system, user_prompt, supabase, user_id)
            parsed = json.loads(response.strip().strip("```json").strip("```"))

            trends = parsed.get("trends", [])
            events = parsed.get("upcoming_events", [])

            # Save to market_trends
            supabase.table("market_trends").insert({
                "business_id": business_id,
                "trends": json.dumps(trends, ensure_ascii=False),
                "upcoming_events": json.dumps(events, ensure_ascii=False),
            }).execute()

            items = 0

            # High-confidence trends → intel items
            for trend in trends:
                if trend.get("confidence") == "high":
                    supabase.table("intelligence_events").insert({
                        "business_id": business_id,
                        "event_type": "market_trend",
                        "title": f"מגמה: {trend.get('name', '')}",
                        "description": trend.get("opportunity", ""),
                        "severity": "medium",
                        "source": "hatavach_agent",
                    }).execute()
                    items += 1

                self.log_finding(supabase, user_id, "market_trend", trend)

            # Send WhatsApp summary
            phone = self.get_business_phone(supabase, business_id)
            name = (biz.get("name_hebrew") or biz.get("name", "")).split()[0]
            app_url = os.getenv("APP_URL", "https://quieteyes.co.il")

            if phone and (trends or events):
                parts = [f"🔭 {name}, מה מגיע לאזורך\n"]

                if trends:
                    top = trends[0]
                    parts.append(f"{top.get('name', '')}:")
                    parts.append(f"{top.get('opportunity', '')}")
                    parts.append(f"\nכדאי להתחיל להתכונן עכשיו:")
                    parts.append(f"→ {top.get('action', '')}")

                if events:
                    top_event = events[0]
                    parts.append(f"\n📅 לא לשכוח: {top_event.get('name', '')} {top_event.get('date', '')}")
                    parts.append(f"{top_event.get('preparation', '')}")

                parts.append(f"\n👉 {app_url}/dashboard/intelligence")
                self.send_whatsapp(phone, "\n".join(parts))

            return {"items_found": max(items, 1), "tokens_used": tokens}

        except Exception as e:
            logger.error(f"[hatavach] Trend analysis failed: {e}")
            return {"items_found": 0, "tokens_used": 0}

    def _search_trends(self, biz_type: str, city: str) -> dict:
        """Search for trends using Tavily API and SerpAPI."""
        import requests
        data = {"web_results": [], "google_trends": []}

        # Tavily search
        tavily_key = os.getenv("TAVILY_API_KEY")
        if tavily_key:
            queries = [
                f"{biz_type} מגמה 2025 ישראל",
                f"{biz_type} חדש פופולרי",
                f"שינוי {biz_type} ישראל",
            ]
            for q in queries:
                try:
                    resp = requests.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": tavily_key,
                            "query": q,
                            "search_depth": "basic",
                            "max_results": 5,
                        },
                        timeout=20,
                    )
                    if resp.ok:
                        results = resp.json().get("results", [])
                        for r in results[:3]:
                            data["web_results"].append({
                                "title": r.get("title", ""),
                                "content": r.get("content", "")[:200],
                            })
                except Exception:
                    continue

        # SerpAPI Google Trends
        serpapi_key = os.getenv("SERPAPI_API_KEY")
        if serpapi_key:
            try:
                resp = requests.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google_trends",
                        "q": biz_type,
                        "geo": "IL",
                        "api_key": serpapi_key,
                    },
                    timeout=15,
                )
                if resp.ok:
                    trends = resp.json().get("interest_over_time", {}).get("timeline_data", [])
                    data["google_trends"] = [
                        {"date": t.get("date", ""), "value": t.get("values", [{}])[0].get("extracted_value", 0)}
                        for t in trends[-10:]
                    ]
            except Exception:
                pass

        return data


def get_hatavach_agent():
    return HatavachAgent()
