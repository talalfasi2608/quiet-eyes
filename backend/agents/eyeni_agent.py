"""
Agent 1 — עיני 👁️
Mission: Find leads + monitor competitors 24/7, automatically.
Runs for: ALL paid users.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class EyeniAgent(BaseAgent):
    name = "eyeni"
    display_name = "עיני"
    emoji = "👁️"
    description = "עוקב על השוק שלך — לידים ומתחרים"
    plan_access = "paid"

    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        biz = self.get_business_data(supabase, business_id)
        if not biz:
            return {"items_found": 0, "tokens_used": 0}

        items_found = 0
        tokens_used = 0

        # ── Task A: Lead Hunting ──
        try:
            leads, toks = self._hunt_leads(biz, business_id, user_id, supabase)
            items_found += leads
            tokens_used += toks
        except Exception as e:
            logger.error(f"[eyeni] Lead hunting failed for {business_id}: {e}")

        # ── Task B: Competitor Monitoring ──
        try:
            changes, toks = self._monitor_competitors(biz, business_id, user_id, supabase)
            items_found += changes
            tokens_used += toks
        except Exception as e:
            logger.error(f"[eyeni] Competitor monitoring failed for {business_id}: {e}")

        # ── Task C: New Competitor Detection ──
        try:
            new_comps = self._detect_new_competitors(biz, business_id, user_id, supabase)
            items_found += new_comps
        except Exception as e:
            logger.error(f"[eyeni] New competitor detection failed for {business_id}: {e}")

        return {"items_found": items_found, "tokens_used": tokens_used}

    def _hunt_leads(self, biz: dict, business_id: str, user_id: str, supabase) -> tuple:
        """Search for leads via Apify Facebook Search."""
        import os
        import requests

        biz_type = biz.get("business_type", "")
        city = biz.get("city", biz.get("address", ""))
        keywords = biz.get("search_keywords", [])

        if not biz_type:
            return 0, 0

        # Build search query
        query_parts = [biz_type]
        if city:
            query_parts.append(city)
        query_parts.append("מחפש OR צריך OR ממליץ")
        query = " ".join(query_parts)

        # Get user's learned context
        learned_context = ""
        try:
            profile = supabase.table("user_agent_profiles").select("lead_scoring_context").eq("user_id", user_id).execute()
            if profile.data and profile.data[0].get("lead_scoring_context"):
                learned_context = profile.data[0]["lead_scoring_context"]
        except Exception:
            pass

        # Call Apify Facebook Search
        apify_key = os.getenv("APIFY_API_KEY")
        leads_found = 0
        total_tokens = 0
        posts = []

        if apify_key:
            try:
                resp = requests.post(
                    "https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items",
                    params={"token": apify_key},
                    json={
                        "searchQuery": query,
                        "maxResults": 20,
                        "dateFrom": (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%d"),
                    },
                    timeout=120,
                )
                if resp.ok:
                    posts = resp.json() if isinstance(resp.json(), list) else []
            except Exception as e:
                logger.warning(f"[eyeni] Apify call failed: {e}")

        # Also try Tavily as backup/supplement
        if not posts:
            tavily_key = os.getenv("TAVILY_API_KEY")
            if tavily_key:
                try:
                    resp = requests.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": tavily_key,
                            "query": f"{biz_type} {city} מחפש ממליץ",
                            "search_depth": "basic",
                            "max_results": 10,
                        },
                        timeout=30,
                    )
                    if resp.ok:
                        data = resp.json()
                        for r in data.get("results", []):
                            posts.append({
                                "text": r.get("content", ""),
                                "url": r.get("url", ""),
                                "title": r.get("title", ""),
                            })
                except Exception as e:
                    logger.warning(f"[eyeni] Tavily call failed: {e}")

        # Score each post with Claude
        for post in posts[:20]:
            text = post.get("text", post.get("content", ""))
            url = post.get("url", "")
            if not text or len(text) < 20:
                continue

            # Check duplicate
            try:
                existing = supabase.table("leads_discovered").select("id").eq("business_id", business_id).ilike("source_url", f"%{url[:100]}%").execute()
                if existing.data:
                    continue
            except Exception:
                pass

            # Score with Claude
            system = f"""אתה מנוע ציון לידים לשוק הישראלי.
{learned_context}
דרג רלוונטיות 0-100. היה מחמיר.
החזר JSON בלבד: {{"score": number, "urgency": "hot"|"warm"|"cold", "why": string, "action": string}}"""

            user_prompt = f"""סוג עסק: {biz_type}
עיר: {city}
פוסט: '{text[:500]}'"""

            try:
                response_text, tokens = self.call_claude(system, user_prompt, supabase, user_id)
                total_tokens += tokens

                # Parse JSON response
                parsed = json.loads(response_text.strip().strip("```json").strip("```"))
                score = parsed.get("score", 0)

                if score >= 50:
                    # Save to leads table
                    supabase.table("leads_discovered").insert({
                        "business_id": business_id,
                        "summary": text[:300],
                        "source": "eyeni_agent",
                        "source_url": url[:500] if url else None,
                        "relevance_score": score,
                        "status": "new",
                        "metadata": json.dumps(parsed),
                    }).execute()
                    leads_found += 1

                    self.log_finding(supabase, user_id, "lead", {
                        "text": text[:200], "score": score, "url": url,
                    }, score)

                    # Hot lead → send WhatsApp immediately
                    if score >= 80:
                        phone = self.get_business_phone(supabase, business_id)
                        owner_name = biz.get("name_hebrew", biz.get("name", ""))
                        if phone:
                            msg = f"""{owner_name}, שמתי לב 🎯

מישהו כתב עכשיו שהוא מחפש
{parsed.get('why', text[:60])}.

כדאי לפנות בשעה הקרובה —
הכנתי לך תגובה מוכנה:

---
{parsed.get('action', 'פנה אליהם עם הצעת ערך ברורה.')}
---

👉 ראה את הפוסט: {url}"""
                            self.send_whatsapp(phone, msg)

            except Exception as e:
                logger.warning(f"[eyeni] Claude scoring failed: {e}")

        return leads_found, total_tokens

    def _monitor_competitors(self, biz: dict, business_id: str, user_id: str, supabase) -> tuple:
        """Monitor tracked competitors for changes."""
        import os
        import requests

        changes = 0
        tokens = 0

        try:
            result = supabase.table("competitors").select("*").eq("business_id", business_id).execute()
            competitors = result.data or []
        except Exception:
            return 0, 0

        google_key = os.getenv("GOOGLE_API_KEY")
        if not google_key:
            return 0, 0

        for comp in competitors:
            place_id = comp.get("place_id")
            if not place_id:
                continue

            try:
                resp = requests.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={
                        "place_id": place_id,
                        "fields": "rating,user_ratings_total,reviews",
                        "key": google_key,
                        "language": "he",
                    },
                    timeout=15,
                )
                if not resp.ok:
                    continue

                place = resp.json().get("result", {})
                new_rating = place.get("rating")
                new_reviews = place.get("user_ratings_total")
                old_rating = comp.get("google_rating")
                old_reviews = comp.get("google_reviews_count")

                changed = False
                change_details = {}

                if new_rating and old_rating and abs(new_rating - old_rating) >= 0.1:
                    changed = True
                    change_details["rating_change"] = new_rating - old_rating

                if new_reviews and old_reviews and new_reviews > old_reviews:
                    changed = True
                    change_details["new_reviews"] = new_reviews - old_reviews

                if changed:
                    # Update competitor record
                    update = {}
                    if new_rating:
                        update["google_rating"] = new_rating
                    if new_reviews:
                        update["google_reviews_count"] = new_reviews
                    supabase.table("competitors").update(update).eq("id", comp["id"]).execute()

                    # Create intel item
                    urgency = "high" if change_details.get("rating_change", 0) < -0.3 else "medium"
                    title = f"{comp['name']} — שינוי בדירוג" if "rating_change" in change_details else f"{comp['name']} — ביקורות חדשות"

                    supabase.table("intelligence_events").insert({
                        "business_id": business_id,
                        "event_type": "competitor_change",
                        "title": title,
                        "description": json.dumps(change_details, ensure_ascii=False),
                        "severity": urgency,
                        "source": "eyeni_agent",
                    }).execute()

                    self.log_finding(supabase, user_id, "competitor_change", {
                        "competitor": comp["name"], **change_details,
                    })
                    changes += 1

                    # Big rating drop → opportunity alert
                    if change_details.get("rating_change", 0) < -0.3:
                        phone = self.get_business_phone(supabase, business_id)
                        if phone:
                            self.send_whatsapp(phone, f"""הזדמנות! 🎯

{comp['name']} קיבל ביקורות שליליות — הדירוג ירד ל-{new_rating}.

הלקוחות שלהם מחפשים חלופה.
כדאי לפנות אליהם עכשיו.""")

            except Exception as e:
                logger.warning(f"[eyeni] Competitor check failed for {comp.get('name')}: {e}")

        return changes, tokens

    def _detect_new_competitors(self, biz: dict, business_id: str, user_id: str, supabase) -> int:
        """Search for new competitors in the area."""
        import os
        import requests

        google_key = os.getenv("GOOGLE_API_KEY")
        if not google_key:
            return 0

        lat = biz.get("latitude")
        lng = biz.get("longitude")
        biz_type = biz.get("business_type", "")
        radius = (biz.get("radius_km") or 5) * 1000

        if not lat or not lng or not biz_type:
            return 0

        # Get existing competitor place_ids
        try:
            existing = supabase.table("competitors").select("place_id").eq("business_id", business_id).execute()
            known_place_ids = {r["place_id"] for r in (existing.data or []) if r.get("place_id")}
        except Exception:
            known_place_ids = set()

        new_found = 0
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": f"{lat},{lng}",
                    "radius": min(radius, 10000),
                    "keyword": biz_type,
                    "key": google_key,
                    "language": "he",
                },
                timeout=15,
            )
            if not resp.ok:
                return 0

            places = resp.json().get("results", [])
            for place in places[:20]:
                pid = place.get("place_id")
                if not pid or pid in known_place_ids:
                    continue

                # Calculate distance
                plat = place.get("geometry", {}).get("location", {}).get("lat", 0)
                plng = place.get("geometry", {}).get("location", {}).get("lng", 0)

                # Add to competitors table
                supabase.table("competitors").insert({
                    "business_id": business_id,
                    "name": place.get("name", ""),
                    "place_id": pid,
                    "google_rating": place.get("rating"),
                    "google_reviews_count": place.get("user_ratings_total"),
                    "perceived_threat_level": "Medium",
                    "address": place.get("vicinity", ""),
                    "latitude": plat,
                    "longitude": plng,
                }).execute()

                # Create intel item
                supabase.table("intelligence_events").insert({
                    "business_id": business_id,
                    "event_type": "new_competitor",
                    "title": f"מתחרה חדש: {place.get('name', '')}",
                    "description": f"נמצא עסק חדש באזורך: {place.get('name', '')} ({place.get('vicinity', '')})",
                    "severity": "medium",
                    "source": "eyeni_agent",
                }).execute()

                self.log_finding(supabase, user_id, "new_competitor", {
                    "name": place.get("name"), "place_id": pid,
                })
                new_found += 1

                # Very close competitor → WhatsApp alert
                if plat and plng:
                    from math import radians, cos, sin, sqrt, atan2
                    R = 6371000
                    dlat = radians(plat - lat)
                    dlon = radians(plng - lng)
                    a = sin(dlat/2)**2 + cos(radians(lat)) * cos(radians(plat)) * sin(dlon/2)**2
                    dist = R * 2 * atan2(sqrt(a), sqrt(1-a))
                    if dist < 300:
                        phone = self.get_business_phone(supabase, business_id)
                        if phone:
                            self.send_whatsapp(phone, f"""👁️ מתחרה חדש מאוד קרוב!

{place.get('name', '')} נפתח {int(dist)}מ ממך.
דירוג: {place.get('rating', '—')}

כדאי להכיר ולראות מה הם מציעים.""")

        except Exception as e:
            logger.warning(f"[eyeni] New competitor detection failed: {e}")

        return new_found


def get_eyeni_agent():
    return EyeniAgent()
