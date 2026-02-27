"""
Review Responder — automated review response generation and approval workflow.

Monitors new reviews from intelligence_events, generates contextual Hebrew responses
using Claude, and sends them via WhatsApp for owner approval before posting.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


class ReviewResponder:
    """Generates review responses and manages approval workflow."""

    def check_new_reviews(self, business_id: str, supabase) -> int:
        """
        Check for new review events and generate responses.

        1. Check is_automation_enabled('review_responder')
        2. Query intelligence_events for review events since last run
        3. For each: generate response, WhatsApp for approval, store context, log

        Returns count processed.
        """
        from services.automation_helpers import (
            is_automation_enabled,
            get_business_whatsapp,
            log_automation,
            store_whatsapp_context,
        )

        if not is_automation_enabled(business_id, "review_responder", supabase):
            return 0

        phone = get_business_whatsapp(business_id, supabase)
        biz_info = self._get_business_info(business_id, supabase)
        if not biz_info:
            return 0

        # Find recent review events not yet processed
        since = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        try:
            events = (
                supabase.table("intelligence_events")
                .select("id, title, description, details, severity")
                .eq("business_id", business_id)
                .eq("event_type", "new_review")
                .gte("created_at", since)
                .order("created_at", desc=True)
                .limit(5)
                .execute()
            )
            reviews = events.data or []
        except Exception as e:
            logger.error(f"[ReviewResponder] Query reviews error: {e}")
            return 0

        if not reviews:
            return 0

        count = 0
        for review_event in reviews:
            try:
                details = review_event.get("details") or {}
                review_text = details.get("review_text", review_event.get("description", ""))
                rating = details.get("rating", 0)
                reviewer_name = details.get("reviewer_name", "")

                # Check if already processed (look for existing log)
                event_id = review_event["id"]
                try:
                    existing = (
                        supabase.table("automation_log")
                        .select("id")
                        .eq("business_id", business_id)
                        .eq("automation_type", "review_responder")
                        .ilike("trigger_event", f"%{event_id}%")
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        continue
                except Exception:
                    pass

                # Generate response
                response = self._generate_response(
                    review_text=review_text,
                    rating=rating,
                    business_name=biz_info.get("business_name", ""),
                    industry=biz_info.get("industry", ""),
                )

                # Send for approval via WhatsApp
                if phone:
                    approval_msg = (
                        f"📝 ביקורת חדשה"
                        f"{f' מאת {reviewer_name}' if reviewer_name else ''}:\n"
                        f"⭐ דירוג: {'⭐' * int(rating) if rating else 'N/A'}\n"
                        f'"{review_text[:200]}"\n\n'
                        f"💬 תגובה מוצעת:\n{response}\n\n"
                        f'השב "אשר" לאישור\n'
                        f'השב "ערוך: [טקסט]" לעריכה'
                    )
                    from services.whatsapp import send_whatsapp_message
                    send_whatsapp_message(phone, approval_msg)

                    # Store context for webhook handling
                    store_whatsapp_context(
                        phone=phone,
                        context_type="review_approval",
                        context_data={
                            "event_id": event_id,
                            "business_id": business_id,
                            "review_text": review_text,
                            "rating": rating,
                            "reviewer_name": reviewer_name,
                            "proposed_response": response,
                        },
                        business_id=business_id,
                        ttl_hours=24,
                        supabase=supabase,
                    )

                log_automation(
                    business_id=business_id,
                    automation_type="review_responder",
                    trigger_event=f"new_review:{event_id}",
                    action_taken="approval_requested" if phone else "response_generated",
                    result="pending_approval",
                    details={
                        "event_id": event_id,
                        "rating": rating,
                        "reviewer_name": reviewer_name,
                    },
                    supabase=supabase,
                )
                count += 1

            except Exception as e:
                logger.error(f"[ReviewResponder] Review processing error: {e}")

        return count

    def _generate_response(
        self,
        review_text: str,
        rating: float,
        business_name: str,
        industry: str,
    ) -> str:
        """Generate a Hebrew review response using Claude."""
        from services.claude_client import analyze

        sentiment = "חיובית" if rating >= 4 else "שלילית" if rating <= 2 else "מעורבת"

        prompt = f"""אתה כותב תגובות לביקורות גוגל. כתוב תגובה בעברית.

עסק: {business_name}
תחום: {industry}
דירוג: {rating} כוכבים
סוג ביקורת: {sentiment}
טקסט הביקורת: "{review_text}"

כללים:
- תגובה קצרה (3-5 שורות)
- אם חיובית: הודה בחום, הזמן לחזור
- אם שלילית: הבע אמפתיה, התנצל, הצע פתרון, הזמן ליצור קשר
- טון מקצועי ואישי
- אל תציין את שם המגיב
- חתום בשם העסק"""

        try:
            return analyze(prompt, max_tokens=400, temperature=0.7)
        except Exception as e:
            logger.error(f"[ReviewResponder] Claude error: {e}")
            if rating >= 4:
                return f"תודה רבה על הביקורת החמה! אנחנו ב{business_name} שמחים שנהנית. מחכים לראות אותך שוב!"
            else:
                return f"תודה על המשוב. ב{business_name} אנחנו לוקחים כל ביקורת ברצינות ונשמח לשפר. אנא צרו איתנו קשר ישירות."

    def handle_approval(self, context_data: dict, reply: str, supabase) -> dict:
        """
        Process an approval/edit reply from the business owner.

        Args:
            context_data: The stored context from whatsapp_contexts
            reply: The user's reply text

        Returns:
            dict with 'response_text' and 'google_review_link' (for manual posting)
        """
        proposed = context_data.get("proposed_response", "")
        business_id = context_data.get("business_id", "")

        if reply.strip() == "אשר":
            response_text = proposed
        elif reply.strip().startswith("ערוך:"):
            response_text = reply.strip()[5:].strip()
        else:
            return {"response_text": proposed, "status": "unchanged"}

        from services.automation_helpers import log_automation
        log_automation(
            business_id=business_id,
            automation_type="review_responder",
            trigger_event=f"approval:{context_data.get('event_id', '')}",
            action_taken="response_approved",
            result="approved",
            details={"final_response": response_text},
            supabase=supabase,
        )

        return {
            "response_text": response_text,
            "status": "approved",
            "google_review_link": "https://search.google.com/local/reviews",
        }

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


def get_review_responder() -> ReviewResponder:
    global _instance
    if _instance is None:
        _instance = ReviewResponder()
    return _instance
