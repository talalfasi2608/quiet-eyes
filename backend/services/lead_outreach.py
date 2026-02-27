"""
Lead Outreach — automated hot lead alerts with personalized outreach messages.

Monitors leads_discovered for high-relevance leads and generates
personalized Hebrew outreach messages sent via WhatsApp.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


class LeadOutreach:
    """Monitors hot leads and generates outreach messages."""

    def check_hot_leads(self, business_id: str, supabase) -> int:
        """
        Check for new hot leads and send outreach alerts.

        1. Check is_automation_enabled('lead_alerts')
        2. Query leads_discovered where relevance_score > 0.85 AND status='new'
        3. For each: generate outreach message, WhatsApp notify, log

        Returns count processed.
        """
        from services.automation_helpers import (
            is_automation_enabled,
            get_business_whatsapp,
            log_automation,
        )

        if not is_automation_enabled(business_id, "lead_alerts", supabase):
            return 0

        phone = get_business_whatsapp(business_id, supabase)
        biz_info = self._get_business_info(business_id, supabase)
        if not biz_info:
            return 0

        # Find hot leads
        try:
            since = (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()
            leads_result = (
                supabase.table("leads_discovered")
                .select("id, lead_name, platform, summary, relevance_score, status")
                .eq("business_id", business_id)
                .eq("status", "new")
                .gte("relevance_score", 0.85)
                .gte("created_at", since)
                .order("relevance_score", desc=True)
                .limit(5)
                .execute()
            )
            hot_leads = leads_result.data or []
        except Exception as e:
            logger.error(f"[LeadOutreach] Query leads error: {e}")
            return 0

        if not hot_leads:
            return 0

        count = 0
        for lead in hot_leads:
            try:
                # Generate outreach message
                outreach = self._generate_outreach(
                    lead_summary=lead.get("summary", ""),
                    lead_platform=lead.get("platform", ""),
                    business_name=biz_info.get("business_name", ""),
                    industry=biz_info.get("industry", ""),
                )

                # Send WhatsApp notification using template
                if phone:
                    from services.whatsapp_templates import new_hot_lead
                    score = lead.get("relevance_score", 0)
                    message = new_hot_lead(
                        search_query=lead.get("summary", lead.get("lead_name", "ליד חדש")),
                        relevance_score=int(score * 100),
                        source=lead.get("platform", "N/A"),
                        quote=outreach[:100] if outreach else "",
                        recommended_action="העתק את ההודעה ושלח ישירות!",
                        lead_id=lead.get("id", ""),
                    )
                    from services.whatsapp import send_whatsapp_message
                    send_whatsapp_message(phone, message)

                # Mark lead as notified
                try:
                    supabase.table("leads_discovered").update(
                        {"status": "contacted"}
                    ).eq("id", lead["id"]).execute()
                except Exception:
                    pass

                log_automation(
                    business_id=business_id,
                    automation_type="lead_outreach",
                    trigger_event=f"hot_lead:{lead.get('lead_name', '')}",
                    action_taken="outreach_sent" if phone else "outreach_generated",
                    result="success",
                    details={
                        "lead_id": lead["id"],
                        "lead_name": lead.get("lead_name", ""),
                        "relevance_score": lead.get("relevance_score", 0),
                    },
                    supabase=supabase,
                )
                count += 1

            except Exception as e:
                logger.error(f"[LeadOutreach] Lead processing error: {e}")

        return count

    def _generate_outreach(
        self,
        lead_summary: str,
        lead_platform: str,
        business_name: str,
        industry: str,
    ) -> str:
        """Generate a personalized Hebrew outreach message using Claude."""
        from services.claude_client import analyze

        prompt = f"""אתה כותב הודעות פנייה עסקיות. צור הודעת פנייה קצרה ואישית בעברית.

עסק: {business_name}
תחום: {industry}
פלטפורמת הליד: {lead_platform}
מידע על הליד: {lead_summary}

כללים:
- הודעה קצרה (3-4 שורות)
- טון מקצועי אך חם
- הצע ערך ספציפי
- סיום עם שאלה פתוחה
- אל תכלול קישורים או מספרי טלפון"""

        try:
            return analyze(prompt, max_tokens=300, temperature=0.7)
        except Exception as e:
            logger.error(f"[LeadOutreach] Claude error: {e}")
            return (
                f"שלום, אני מ{business_name}. "
                f"ראיתי שאתם מחפשים שירותי {industry} ורציתי להציע את עזרתנו. "
                f"אשמח לשוחח על איך נוכל לעזור!"
            )

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


def get_lead_outreach() -> LeadOutreach:
    global _instance
    if _instance is None:
        _instance = LeadOutreach()
    return _instance
