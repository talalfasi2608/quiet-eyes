"""
Prediction Engine for Quiet Eyes.

Generates weekly business predictions and lead quality scores
using Claude AI with accumulated memory context.

Tables used:
  - business_predictions  (stored weekly predictions)
"""

import json
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class PredictionEngine:
    """AI-powered business predictions from historical data."""

    # ------------------------------------------------------------------
    # predict_next_week  — called every Sunday by scheduler
    # ------------------------------------------------------------------
    def predict_next_week(self, business_id: str, supabase) -> dict:
        """
        Predict what will happen next week based on
        memory + patterns + business context.
        """
        from services.memory_engine import get_memory_engine
        memory_engine = get_memory_engine()

        # Rich memory context
        memory_context = memory_engine.get_context_for_ai(business_id, supabase)

        # Business info
        biz_name = ""
        biz_type = ""
        biz_city = ""
        biz_rating = None
        competitor_count = 0
        try:
            biz = (
                supabase.table("businesses")
                .select("business_name, industry, location, google_rating")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if biz.data:
                biz_name = biz.data.get("business_name", "")
                biz_type = biz.data.get("industry", "")
                biz_city = biz.data.get("location", "")
                biz_rating = biz.data.get("google_rating")
        except Exception:
            pass

        try:
            comp = (
                supabase.table("competitors")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .execute()
            )
            competitor_count = comp.count if hasattr(comp, "count") and comp.count else len(comp.data or [])
        except Exception:
            pass

        # Discovered patterns
        patterns_text = ""
        try:
            pat_res = (
                supabase.table("business_patterns")
                .select("pattern_data")
                .eq("business_id", business_id)
                .order("discovered_at", desc=True)
                .limit(5)
                .execute()
            )
            if pat_res.data:
                patterns_text = json.dumps(
                    [r.get("pattern_data", {}) for r in pat_res.data],
                    ensure_ascii=False,
                )
        except Exception:
            pass

        prompt = f"""אתה יועץ עסקי חכם עם גישה לנתונים היסטוריים.

עסק: {biz_name} ({biz_type} ב{biz_city})
דירוג: {biz_rating or 'לא ידוע'}
מתחרים: {competitor_count}

{memory_context or 'אין נתונים היסטוריים עדיין — תן תחזית כללית לתחום.'}

דפוסים שזוהו:
{patterns_text or 'אין דפוסים עדיין'}

בהתבסס על כל המידע, תחזה לשבוע הבא:
1. כמה לידים צפויים?
2. האם הדירוג צפוי לעלות/לרדת?
3. מה המתחרים צפויים לעשות?
4. מה ההזדמנות הכי גדולה?
5. מה הסיכון הכי גדול?

החזר JSON בלבד:
{{
  "predicted_leads": 15,
  "leads_confidence": 0.75,
  "rating_prediction": "stable",
  "competitor_moves": ["..."],
  "top_opportunity": "...",
  "top_risk": "...",
  "recommended_actions": [
    {{
      "action": "מה לעשות",
      "reason": "למה",
      "urgency": "high/medium/low",
      "expected_impact": "מה התוצאה הצפויה"
    }}
  ],
  "summary": "סיכום תחזית קצר בעברית"
}}"""

        prediction_data: dict = {}
        confidence = 0.5

        try:
            from services.claude_client import analyze
            response = analyze(prompt=prompt, max_tokens=2000, temperature=0.5)
            prediction_data = _parse_json(response) or {}

            # Confidence heuristic based on data richness
            if memory_context:
                week_count = memory_context.count("שבוע")
                confidence = min(0.9, 0.4 + (week_count * 0.05))
            else:
                confidence = 0.3

            prediction_data.setdefault("predicted_leads", 0)
            prediction_data.setdefault("leads_confidence", confidence)

        except Exception as e:
            logger.error(f"[PredictionEngine] Claude call failed: {e}")
            prediction_data = {
                "predicted_leads": 0,
                "leads_confidence": 0,
                "rating_prediction": "stable",
                "competitor_moves": [],
                "top_opportunity": "",
                "top_risk": "",
                "recommended_actions": [],
                "summary": "לא ניתן לייצר תחזית כעת.",
            }
            confidence = 0.0

        # Calculate valid_from (next Monday) and valid_until (next Sunday)
        now = datetime.now(timezone.utc)
        days_until_monday = (7 - now.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = (now + timedelta(days=days_until_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        next_sunday = next_monday + timedelta(days=6)

        # Save to business_predictions
        try:
            supabase.table("business_predictions").insert({
                "business_id": business_id,
                "prediction_type": "weekly",
                "prediction_data": prediction_data,
                "confidence": confidence,
                "valid_from": next_monday.strftime("%Y-%m-%d"),
                "valid_until": next_sunday.strftime("%Y-%m-%d"),
            }).execute()
            logger.info(
                f"[PredictionEngine] Prediction saved for {business_id} "
                f"({next_monday.strftime('%Y-%m-%d')} → {next_sunday.strftime('%Y-%m-%d')})"
            )
        except Exception as e:
            logger.error(f"[PredictionEngine] Failed to save prediction: {e}")

        return prediction_data

    # ------------------------------------------------------------------
    # predict_lead_quality  — score a single lead
    # ------------------------------------------------------------------
    def predict_lead_quality(self, lead: dict, business_id: str, supabase) -> float:
        """
        Score a lead based on historical conversion data.
        Returns 0..1 probability the lead converts.
        """
        # Get previously converted leads for comparison
        history: list[dict] = []
        try:
            conv_res = (
                supabase.table("leads_discovered")
                .select("source, relevance_score, status, industry")
                .eq("business_id", business_id)
                .eq("status", "converted")
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            history = conv_res.data or []
        except Exception:
            pass

        if not history:
            return lead.get("relevance_score", 0.5)

        prompt = f"""היסטוריית לידים שהומרו ללקוחות:
{json.dumps(history[:10], ensure_ascii=False)}

ליד חדש:
{json.dumps(lead, ensure_ascii=False)}

בהתבסס על הדפוס של לידים שהצליחו בעבר,
מה הסיכוי שהליד הזה יהפוך ללקוח?
החזר מספר בין 0 ל-1 בלבד."""

        try:
            from services.claude_client import analyze
            score_text = analyze(prompt=prompt, max_tokens=20, temperature=0.2)
            return float(score_text.strip())
        except Exception:
            return lead.get("relevance_score", 0.5)

    # ------------------------------------------------------------------
    # get_latest_prediction  — fetch for cockpit display
    # ------------------------------------------------------------------
    def get_latest_prediction(self, business_id: str, supabase) -> Optional[dict]:
        """
        Fetch the most recent valid prediction
        (today between valid_from and valid_until).
        """
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        try:
            result = (
                supabase.table("business_predictions")
                .select("prediction_data, confidence, valid_from, valid_until")
                .eq("business_id", business_id)
                .lte("valid_from", today)
                .gte("valid_until", today)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                row = result.data[0]
                data = row.get("prediction_data", {})
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except Exception:
                        data = {}
                data["confidence"] = row.get("confidence", 0.5)
                data["valid_from"] = row.get("valid_from")
                data["valid_until"] = row.get("valid_until")
                return data
            return None
        except Exception as e:
            logger.debug(f"[PredictionEngine] get_latest_prediction: {e}")
            return None


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def _parse_json(text: str) -> Optional[dict]:
    """Parse JSON from Claude response, with regex fallback."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return None


# ═══════════════════════════════════════════════════════════════
# Singleton
# ═══════════════════════════════════════════════════════════════

_instance: Optional[PredictionEngine] = None


def get_prediction_engine() -> PredictionEngine:
    global _instance
    if _instance is None:
        _instance = PredictionEngine()
    return _instance
