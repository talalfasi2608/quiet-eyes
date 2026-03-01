"""
Learning System — Improves agent accuracy per user over time.
Every 20 feedbacks: runs learning update with Claude.
"""

import json
import logging
from agents.base_agent import _get_supabase, _get_claude

logger = logging.getLogger(__name__)


def record_feedback(user_id: str, finding_id: str, was_relevant: bool, led_to_customer: bool = False):
    """Record user feedback on an agent finding."""
    sb = _get_supabase()
    if not sb:
        return

    try:
        # Save feedback
        sb.table("agent_feedback").insert({
            "user_id": user_id,
            "finding_id": finding_id,
            "was_relevant": was_relevant,
            "led_to_customer": led_to_customer,
        }).execute()

        # Update total feedbacks count
        profile = sb.table("user_agent_profiles").select("total_feedbacks").eq("user_id", user_id).execute()
        if profile.data:
            count = (profile.data[0].get("total_feedbacks") or 0) + 1
            sb.table("user_agent_profiles").update({
                "total_feedbacks": count,
            }).eq("user_id", user_id).execute()

            # Every 20 feedbacks → run learning update
            if count % 20 == 0:
                _run_learning_update(user_id, sb)
        else:
            # Create profile
            sb.table("user_agent_profiles").insert({
                "user_id": user_id,
                "total_feedbacks": 1,
            }).execute()

    except Exception as e:
        logger.error(f"[learning] Feedback recording failed: {e}")


def _run_learning_update(user_id: str, supabase):
    """Analyze feedback patterns and update scoring context."""
    try:
        # Get last 50 feedbacks with finding data
        feedbacks = supabase.table("agent_feedback").select(
            "was_relevant, led_to_customer, finding_id"
        ).eq("user_id", user_id).order("feedback_at", desc=True).limit(50).execute()

        if not feedbacks.data or len(feedbacks.data) < 10:
            return

        # Get finding details for each feedback
        finding_details = []
        for fb in feedbacks.data:
            if fb.get("finding_id"):
                try:
                    finding = supabase.table("agent_findings").select("finding_type, data, score").eq(
                        "id", fb["finding_id"]
                    ).execute()
                    if finding.data:
                        finding_details.append({
                            "was_relevant": fb["was_relevant"],
                            "led_to_customer": fb.get("led_to_customer", False),
                            "type": finding.data[0].get("finding_type"),
                            "score": finding.data[0].get("score"),
                            "data": finding.data[0].get("data", {}),
                        })
                except Exception:
                    continue

        if not finding_details:
            return

        # Call Claude for learning analysis
        client = _get_claude()
        if not client:
            return

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system="""נתח את דפוסי הפידבק.
מה עושה ליד טוב/רע לעסק זה?
החזר הנחיות קצרות לשיפור הציון בעברית.
תוצאה: פסקה אחת של 2-3 משפטים שתשמש כהקשר נוסף למנוע הציון.""",
            messages=[{
                "role": "user",
                "content": f"50 פידבקים אחרונים: {json.dumps(finding_details, ensure_ascii=False)}",
            }],
        )

        context = response.content[0].text if response.content else ""
        if context:
            supabase.table("user_agent_profiles").update({
                "lead_scoring_context": context,
                "last_learning_update": "now()",
            }).eq("user_id", user_id).execute()
            logger.info(f"[learning] Updated scoring context for user {user_id}")

    except Exception as e:
        logger.error(f"[learning] Learning update failed for {user_id}: {e}")
