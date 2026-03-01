"""
Agent 5 — האוזן 👂
Mission: Analyze reviews, find hidden opportunities.
Plans: PRO only.
Runs: every 48 hours.
"""

import json
import logging
import os
from datetime import datetime, timezone
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class HaozenAgent(BaseAgent):
    name = "haozen"
    display_name = "האוזן"
    emoji = "👂"
    description = "מנתח ביקורות ומוצא הזדמנויות נסתרות"
    plan_access = "pro"

    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        biz = self.get_business_data(supabase, business_id)
        if not biz:
            return {"items_found": 0, "tokens_used": 0}

        # Fetch reviews
        my_reviews, comp_reviews = self._fetch_reviews(biz, business_id, supabase)

        if not my_reviews and not comp_reviews:
            return {"items_found": 0, "tokens_used": 0}

        system = """אתה מנתח חווית לקוח מומחה.
נתח ביקורות ומצא הזדמנויות.
דבר בעברית, ספציפי ופרקטי.
החזר JSON בלבד:
{
  "my_strengths": [string],
  "my_weaknesses": [string],
  "competitor_weaknesses": [string],
  "hidden_opportunity": string,
  "recommended_action": string
}"""

        user_prompt = f"""ביקורות של העסק שלי: {json.dumps(my_reviews, ensure_ascii=False)}
ביקורות של מתחרים: {json.dumps(comp_reviews, ensure_ascii=False)}
סוג עסק: {biz.get('business_type', '')}"""

        try:
            response, tokens = self.call_claude(system, user_prompt, supabase, user_id)
            parsed = json.loads(response.strip().strip("```json").strip("```"))

            # Save analysis
            supabase.table("review_analyses").insert({
                "business_id": business_id,
                "my_strengths": json.dumps(parsed.get("my_strengths", []), ensure_ascii=False),
                "my_weaknesses": json.dumps(parsed.get("my_weaknesses", []), ensure_ascii=False),
                "competitor_weaknesses": json.dumps(parsed.get("competitor_weaknesses", []), ensure_ascii=False),
                "hidden_opportunity": parsed.get("hidden_opportunity", ""),
                "recommended_action": parsed.get("recommended_action", ""),
            }).execute()

            items = 1

            # If hidden opportunity found → create intel item + WhatsApp
            opp = parsed.get("hidden_opportunity", "")
            if opp and len(opp) > 10:
                supabase.table("intelligence_events").insert({
                    "business_id": business_id,
                    "event_type": "review_opportunity",
                    "title": f"האוזן גילה הזדמנות: {opp[:80]}",
                    "description": parsed.get("recommended_action", ""),
                    "severity": "medium",
                    "source": "haozen_agent",
                }).execute()
                items += 1

                self.log_finding(supabase, user_id, "review_opportunity", {
                    "opportunity": opp,
                    "action": parsed.get("recommended_action", ""),
                })

                phone = self.get_business_phone(supabase, business_id)
                name = (biz.get("name_hebrew") or biz.get("name", "")).split()[0]
                app_url = os.getenv("APP_URL", "https://quieteyes.co.il")

                if phone:
                    msg = f"""👂 {name}, גיליתי משהו מעניין

{opp}

מה שאפשר לעשות עם זה:
→ {parsed.get('recommended_action', '')}

👉 {app_url}/dashboard/intelligence"""
                    self.send_whatsapp(phone, msg)

            return {"items_found": items, "tokens_used": tokens}

        except Exception as e:
            logger.error(f"[haozen] Analysis failed: {e}")
            return {"items_found": 0, "tokens_used": 0}

    def _fetch_reviews(self, biz: dict, business_id: str, supabase) -> tuple:
        """Fetch reviews from Google Places API."""
        import requests

        google_key = os.getenv("GOOGLE_API_KEY")
        if not google_key:
            return [], []

        my_reviews = []
        comp_reviews = []

        # Fetch user's own reviews (if they have a place_id)
        my_place_id = biz.get("google_place_id") or biz.get("place_id")
        if my_place_id:
            try:
                resp = requests.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={
                        "place_id": my_place_id,
                        "fields": "reviews",
                        "key": google_key,
                        "language": "he",
                    },
                    timeout=15,
                )
                if resp.ok:
                    reviews = resp.json().get("result", {}).get("reviews", [])
                    my_reviews = [
                        {"text": r.get("text", ""), "rating": r.get("rating", 0)}
                        for r in reviews[:10]
                        if r.get("text")
                    ]
            except Exception as e:
                logger.warning(f"[haozen] Own review fetch failed: {e}")

        # Fetch competitor reviews
        try:
            comps = supabase.table("competitors").select("place_id, name").eq(
                "business_id", business_id
            ).limit(5).execute()

            for comp in (comps.data or []):
                pid = comp.get("place_id")
                if not pid:
                    continue
                try:
                    resp = requests.get(
                        "https://maps.googleapis.com/maps/api/place/details/json",
                        params={
                            "place_id": pid,
                            "fields": "reviews",
                            "key": google_key,
                            "language": "he",
                        },
                        timeout=15,
                    )
                    if resp.ok:
                        reviews = resp.json().get("result", {}).get("reviews", [])
                        for r in reviews[:5]:
                            if r.get("text"):
                                comp_reviews.append({
                                    "competitor": comp["name"],
                                    "text": r["text"],
                                    "rating": r.get("rating", 0),
                                })
                except Exception:
                    continue
        except Exception:
            pass

        return my_reviews, comp_reviews


def get_haozen_agent():
    return HaozenAgent()
