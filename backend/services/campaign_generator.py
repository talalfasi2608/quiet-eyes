"""
Campaign Generator — automated marketing campaign creation.

Checks for triggers (upcoming holidays, competitor opportunities, patterns)
and generates full multi-platform campaigns with Facebook, Instagram,
WhatsApp content and special offers.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None

# Israeli holiday calendar (approximate Gregorian dates — updated yearly)
ISRAELI_HOLIDAYS = [
    {"name": "פורים", "month": 3, "day": 14},
    {"name": "פסח", "month": 4, "day": 15},
    {"name": "יום העצמאות", "month": 5, "day": 5},
    {"name": "שבועות", "month": 6, "day": 5},
    {"name": "ראש השנה", "month": 9, "day": 25},
    {"name": "יום כיפור", "month": 10, "day": 4},
    {"name": "סוכות", "month": 10, "day": 9},
    {"name": "חנוכה", "month": 12, "day": 15},
    {"name": "טו בשבט", "month": 1, "day": 25},
]


class CampaignGenerator:
    """Generates marketing campaigns based on triggers."""

    def check_triggers(self, business_id: str, supabase) -> int:
        """
        Check for campaign triggers and generate campaigns.

        1. Check is_automation_enabled('campaign_generator')
        2. Check triggers: holiday in 7 days, competitor bad reviews, patterns
        3. For each trigger: generate full campaign JSON, save to campaigns table
        4. WhatsApp preview to owner, log

        Returns campaign count.
        """
        from services.automation_helpers import (
            is_automation_enabled,
            get_business_whatsapp,
            log_automation,
            store_whatsapp_context,
        )

        if not is_automation_enabled(business_id, "campaign_generator", supabase):
            return 0

        biz_info = self._get_business_info(business_id, supabase)
        if not biz_info:
            return 0

        phone = get_business_whatsapp(business_id, supabase)

        # Get memory context for richer campaigns
        memory_context = ""
        try:
            from services.memory_engine import get_memory_engine
            memory_context = get_memory_engine().get_context_for_ai(business_id, supabase)
        except Exception:
            pass

        triggers = []

        # Check holiday trigger
        holiday = self._check_holiday_trigger()
        if holiday:
            triggers.append({"type": "holiday", "data": holiday})

        # Check competitor opportunity
        comp_opp = self._check_competitor_opportunity(business_id, supabase)
        if comp_opp:
            triggers.append({"type": "competitor_opportunity", "data": comp_opp})

        if not triggers:
            return 0

        count = 0
        for trigger in triggers:
            try:
                # Check if similar campaign already exists (avoid duplicates)
                trigger_key = f"{trigger['type']}:{trigger['data'].get('name', trigger['data'].get('competitor_name', ''))}"
                try:
                    existing = (
                        supabase.table("campaigns")
                        .select("id")
                        .eq("business_id", business_id)
                        .eq("trigger", trigger_key)
                        .gte("created_at", (datetime.now(timezone.utc) - timedelta(days=7)).isoformat())
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        continue
                except Exception:
                    pass

                # Generate campaign
                campaign = self._generate_campaign(
                    trigger=trigger,
                    business_name=biz_info.get("business_name", ""),
                    industry=biz_info.get("industry", ""),
                    location=biz_info.get("location", ""),
                    memory_context=memory_context,
                )

                if not campaign:
                    continue

                # Save to campaigns table
                campaign_row = {
                    "business_id": business_id,
                    "campaign_name": campaign.get("campaign_name", "קמפיין חדש"),
                    "trigger": trigger_key,
                    "facebook_post": campaign.get("facebook_post", ""),
                    "instagram_caption": campaign.get("instagram_caption", ""),
                    "whatsapp_message": campaign.get("whatsapp_message", ""),
                    "offer": campaign.get("offer", ""),
                    "status": "draft",
                }

                insert_result = supabase.table("campaigns").insert(campaign_row).execute()
                campaign_id = insert_result.data[0]["id"] if insert_result.data else None

                # Send WhatsApp preview
                if phone:
                    preview_msg = (
                        f"🚀 קמפיין חדש: {campaign.get('campaign_name', '')}\n"
                        f"📌 טריגר: {trigger['data'].get('name', trigger['data'].get('competitor_name', ''))}\n\n"
                        f"📱 פוסט פייסבוק:\n{campaign.get('facebook_post', '')[:200]}\n\n"
                        f"🎁 הצעה: {campaign.get('offer', '')}\n\n"
                        f'השב "שלח" לאישור הקמפיין'
                    )
                    from services.whatsapp import send_whatsapp_message
                    send_whatsapp_message(phone, preview_msg)

                    if campaign_id:
                        store_whatsapp_context(
                            phone=phone,
                            context_type="campaign_approval",
                            context_data={
                                "campaign_id": campaign_id,
                                "business_id": business_id,
                                "campaign_name": campaign.get("campaign_name", ""),
                            },
                            business_id=business_id,
                            ttl_hours=48,
                            supabase=supabase,
                        )

                log_automation(
                    business_id=business_id,
                    automation_type="campaign_generator",
                    trigger_event=trigger_key,
                    action_taken="campaign_created",
                    result="draft",
                    details={
                        "campaign_id": campaign_id,
                        "campaign_name": campaign.get("campaign_name", ""),
                    },
                    supabase=supabase,
                )
                count += 1

            except Exception as e:
                logger.error(f"[CampaignGenerator] Trigger processing error: {e}")

        return count

    def _check_holiday_trigger(self) -> Optional[dict]:
        """Check if an Israeli holiday is within the next 7 days."""
        now = datetime.now(timezone.utc)
        for holiday in ISRAELI_HOLIDAYS:
            try:
                holiday_date = datetime(
                    now.year, holiday["month"], holiday["day"], tzinfo=timezone.utc
                )
                # If holiday already passed this year, check next year
                if holiday_date < now:
                    holiday_date = holiday_date.replace(year=now.year + 1)

                days_until = (holiday_date - now).days
                if 0 <= days_until <= 7:
                    return {
                        "name": holiday["name"],
                        "date": holiday_date.strftime("%Y-%m-%d"),
                        "days_until": days_until,
                    }
            except ValueError:
                continue

        return None

    def _check_competitor_opportunity(
        self, business_id: str, supabase
    ) -> Optional[dict]:
        """Check if any competitor has 2+ negative reviews in 48 hours."""
        since = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()

        try:
            events = (
                supabase.table("intelligence_events")
                .select("title, description, details")
                .eq("business_id", business_id)
                .eq("event_type", "competitor_change")
                .eq("severity", "high")
                .gte("created_at", since)
                .execute()
            )
            event_rows = events.data or []

            if len(event_rows) >= 2:
                # Extract competitor name from first event
                comp_name = ""
                for e in event_rows:
                    title = e.get("title", "")
                    if ":" in title:
                        comp_name = title.split(":")[-1].strip()
                        break

                return {
                    "competitor_name": comp_name or "מתחרה",
                    "negative_review_count": len(event_rows),
                }
        except Exception as e:
            logger.debug(f"[CampaignGenerator] Competitor opportunity check error: {e}")

        return None

    def _generate_campaign(
        self,
        trigger: dict,
        business_name: str,
        industry: str,
        location: str,
        memory_context: str,
    ) -> Optional[dict]:
        """Generate a full campaign JSON using Claude."""
        from services.claude_client import analyze

        trigger_type = trigger["type"]
        trigger_data = trigger["data"]

        if trigger_type == "holiday":
            trigger_desc = f"חג {trigger_data['name']} בעוד {trigger_data['days_until']} ימים"
        elif trigger_type == "competitor_opportunity":
            trigger_desc = f"מתחרה {trigger_data.get('competitor_name', '')} קיבל {trigger_data.get('negative_review_count', 0)} ביקורות שליליות"
        else:
            trigger_desc = "הזדמנות שיווקית"

        # Get city context for locally relevant campaigns
        city_context = ""
        try:
            from data.cities import get_city_context
            ctx = get_city_context(location)
            if ctx:
                city_context = f"הקשר עירוני: {ctx}"
        except Exception:
            pass

        prompt = f"""אתה מומחה שיווק דיגיטלי. צור קמפיין שיווקי מלא בעברית.

עסק: {business_name}
תחום: {industry}
מיקום: {location}
טריגר: {trigger_desc}

{city_context}

{f'הקשר היסטורי: {memory_context[:400]}' if memory_context else ''}

החזר JSON בלבד (ללא markdown) עם השדות:
{{
  "campaign_name": "שם הקמפיין (קצר, קליט)",
  "facebook_post": "פוסט פייסבוק מלא (3-5 שורות, כולל אימוג'י, קריאה לפעולה)",
  "instagram_caption": "כיתוב אינסטגרם (2-3 שורות, האשטגים רלוונטיים)",
  "whatsapp_message": "הודעת WhatsApp קצרה ללקוחות (2-3 שורות)",
  "offer": "הצעה מיוחדת (משפט אחד, לדוגמה: 20% הנחה לחג)"
}}"""

        try:
            raw = analyze(prompt, max_tokens=1000, temperature=0.7)
            # Parse JSON from response
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error(f"[CampaignGenerator] JSON parse error from Claude")
            return {
                "campaign_name": f"קמפיין {trigger_desc}",
                "facebook_post": f"🎉 {trigger_desc}! ב{business_name} מחכים לכם עם הפתעות מיוחדות!",
                "instagram_caption": f"✨ {trigger_desc} #{industry} #{location}",
                "whatsapp_message": f"היי! {trigger_desc} - בואו לנצל את ההזדמנות ב{business_name}!",
                "offer": "הנחה מיוחדת לרגל האירוע",
            }
        except Exception as e:
            logger.error(f"[CampaignGenerator] Claude error: {e}")
            return None

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


def get_campaign_generator() -> CampaignGenerator:
    global _instance
    if _instance is None:
        _instance = CampaignGenerator()
    return _instance
