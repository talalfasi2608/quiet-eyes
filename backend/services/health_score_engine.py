"""
Health Score Engine — calculates a 100-point business health score.

Computes four weighted components:
  1. Leads Pipeline      (30 pts) — today's discovered leads count
  2. Competitive Position (30 pts) — Google rating vs competitor average
  3. Market Activity      (20 pts) — intelligence events this week
  4. Platform Engagement  (20 pts) — login + task completion today

The composite score is saved to businesses.pulse_score along with
a JSON breakdown, and the trend vs the previous score is returned.

Tables used:
  - businesses          (read google_rating, pulse_score; write pulse_score)
  - leads_discovered    (count today's leads)
  - competitors         (avg competitor rating)
  - intelligence_events (count this week's intel items)
  - audit_logs          (check last-24h API activity)
  - automation_log      (check completed tasks today)
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


class HealthScoreEngine:
    """Calculates a real 100-point health score from four components."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def calculate_health_score(self, business_id: str, supabase) -> dict:
        """
        Calculate the full health score for a business.

        Returns dict with keys:
          - score          (int 0-100)
          - components     (dict with per-component breakdown)
          - previous_score (int | None)
          - trend          (str: "up", "down", "stable", "new")
        """
        try:
            leads_score = self._score_leads_pipeline(business_id, supabase)
            competitive_score = self._score_competitive_position(business_id, supabase)
            market_score = self._score_market_activity(business_id, supabase)
            engagement_score = self._score_platform_engagement(business_id, supabase)

            components = {
                "leads_pipeline": leads_score,
                "competitive_position": competitive_score,
                "market_activity": market_score,
                "platform_engagement": engagement_score,
            }

            total_score = (
                leads_score["score"]
                + competitive_score["score"]
                + market_score["score"]
                + engagement_score["score"]
            )

            # Fetch previous score before saving the new one
            previous_score = self._get_previous_score(business_id, supabase)

            # Determine trend
            if previous_score is None:
                trend = "new"
            elif total_score > previous_score:
                trend = "up"
            elif total_score < previous_score:
                trend = "down"
            else:
                trend = "stable"

            # Persist to businesses.pulse_score (store as 0-100 integer)
            self._save_score(business_id, total_score, components, supabase)

            result = {
                "score": total_score,
                "components": components,
                "previous_score": previous_score,
                "trend": trend,
            }

            logger.info(
                f"[HealthScore] business={business_id} "
                f"score={total_score} trend={trend} "
                f"(leads={leads_score['score']}, competitive={competitive_score['score']}, "
                f"market={market_score['score']}, engagement={engagement_score['score']})"
            )

            return result

        except Exception as e:
            logger.error(f"[HealthScore] Error for {business_id}: {e}")
            return {
                "score": 0,
                "components": {},
                "previous_score": None,
                "trend": "new",
            }

    # ------------------------------------------------------------------
    # Component 1: Leads Pipeline (30 points)
    # ------------------------------------------------------------------
    def _score_leads_pipeline(self, business_id: str, supabase) -> dict:
        """
        Score based on leads discovered today.
          0 leads  -> 0 pts
          1-2      -> 10 pts
          3-5      -> 20 pts
          6+       -> 30 pts
        """
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()

        leads_count = 0
        try:
            result = (
                supabase.table("leads_discovered")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .gte("created_at", today_start)
                .execute()
            )
            leads_count = result.count if hasattr(result, "count") and result.count else len(result.data or [])
        except Exception as e:
            logger.debug(f"[HealthScore] leads query error: {e}")

        if leads_count == 0:
            score = 0
        elif leads_count <= 2:
            score = 10
        elif leads_count <= 5:
            score = 20
        else:
            score = 30

        return {
            "score": score,
            "max": 30,
            "details": {"leads_today": leads_count},
        }

    # ------------------------------------------------------------------
    # Component 2: Competitive Position (30 points)
    # ------------------------------------------------------------------
    def _score_competitive_position(self, business_id: str, supabase) -> dict:
        """
        Score based on own Google rating vs average competitor rating.
          my_rating > avg_competitor -> 30 pts
          my_rating = avg_competitor -> 20 pts
          my_rating < avg_competitor -> 10 pts
          no rating data            -> 15 pts
        """
        my_rating = None
        avg_competitor = None

        # Fetch own rating
        try:
            biz = (
                supabase.table("businesses")
                .select("google_rating")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if biz.data:
                my_rating = biz.data.get("google_rating")
        except Exception as e:
            logger.debug(f"[HealthScore] business rating query error: {e}")

        # Fetch competitor ratings
        try:
            comp = (
                supabase.table("competitors")
                .select("google_rating")
                .eq("business_id", business_id)
                .execute()
            )
            ratings = [
                c["google_rating"]
                for c in (comp.data or [])
                if c.get("google_rating") is not None
            ]
            if ratings:
                avg_competitor = round(sum(ratings) / len(ratings), 2)
        except Exception as e:
            logger.debug(f"[HealthScore] competitor ratings query error: {e}")

        # Determine score
        if my_rating is None or avg_competitor is None:
            score = 15
            comparison = "no_data"
        elif my_rating > avg_competitor:
            score = 30
            comparison = "above"
        elif my_rating < avg_competitor:
            score = 10
            comparison = "below"
        else:
            score = 20
            comparison = "equal"

        return {
            "score": score,
            "max": 30,
            "details": {
                "my_rating": my_rating,
                "avg_competitor_rating": avg_competitor,
                "comparison": comparison,
            },
        }

    # ------------------------------------------------------------------
    # Component 3: Market Activity (20 points)
    # ------------------------------------------------------------------
    def _score_market_activity(self, business_id: str, supabase) -> dict:
        """
        Score based on intelligence events this week.
          0 items   -> 5 pts
          1-2 items -> 10 pts
          3+ items  -> 20 pts
        """
        week_start = (
            datetime.now(timezone.utc) - timedelta(days=7)
        ).isoformat()

        intel_count = 0
        try:
            result = (
                supabase.table("intelligence_events")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .gte("created_at", week_start)
                .execute()
            )
            intel_count = result.count if hasattr(result, "count") and result.count else len(result.data or [])
        except Exception as e:
            logger.debug(f"[HealthScore] intel events query error: {e}")

        if intel_count == 0:
            score = 5
        elif intel_count <= 2:
            score = 10
        else:
            score = 20

        return {
            "score": score,
            "max": 20,
            "details": {"intel_items_this_week": intel_count},
        }

    # ------------------------------------------------------------------
    # Component 4: Platform Engagement (20 points)
    # ------------------------------------------------------------------
    def _score_platform_engagement(self, business_id: str, supabase) -> dict:
        """
        Score based on engagement today:
          Logged in today (any audit_log entry for this business in last 24h) -> 10 pts
          Completed a task today (automation_log with result='success')       -> 10 pts
        """
        cutoff_24h = (
            datetime.now(timezone.utc) - timedelta(hours=24)
        ).isoformat()

        logged_in = False
        task_completed = False

        # Check audit_logs for recent API activity tied to this business.
        # audit_logs may reference the business via path or user_id;
        # we check if the business_id appears in the path column.
        try:
            audit = (
                supabase.table("audit_logs")
                .select("id", count="exact")
                .ilike("path", f"%{business_id}%")
                .gte("created_at", cutoff_24h)
                .limit(1)
                .execute()
            )
            count = audit.count if hasattr(audit, "count") and audit.count else len(audit.data or [])
            logged_in = count > 0
        except Exception as e:
            logger.debug(f"[HealthScore] audit_logs query error: {e}")

        # Fallback: also check automation_log for any recent activity
        if not logged_in:
            try:
                auto = (
                    supabase.table("automation_log")
                    .select("id", count="exact")
                    .eq("business_id", business_id)
                    .gte("created_at", cutoff_24h)
                    .limit(1)
                    .execute()
                )
                count = auto.count if hasattr(auto, "count") and auto.count else len(auto.data or [])
                logged_in = count > 0
            except Exception:
                pass

        # Check automation_log for a completed task today
        try:
            tasks = (
                supabase.table("automation_log")
                .select("id", count="exact")
                .eq("business_id", business_id)
                .eq("result", "success")
                .gte("created_at", cutoff_24h)
                .limit(1)
                .execute()
            )
            count = tasks.count if hasattr(tasks, "count") and tasks.count else len(tasks.data or [])
            task_completed = count > 0
        except Exception as e:
            logger.debug(f"[HealthScore] automation_log query error: {e}")

        login_pts = 10 if logged_in else 0
        task_pts = 10 if task_completed else 0

        return {
            "score": login_pts + task_pts,
            "max": 20,
            "details": {
                "logged_in_today": logged_in,
                "task_completed_today": task_completed,
            },
        }

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _get_previous_score(self, business_id: str, supabase) -> Optional[int]:
        """Fetch the current pulse_score before we overwrite it."""
        try:
            result = (
                supabase.table("businesses")
                .select("pulse_score")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if result.data:
                raw = result.data.get("pulse_score")
                if raw is not None:
                    # pulse_score may be stored as float (0-10 legacy)
                    # or int (0-100 new). Normalise to 0-100.
                    val = float(raw)
                    if val <= 10:
                        return int(val * 10)
                    return int(val)
        except Exception as e:
            logger.debug(f"[HealthScore] previous score fetch error: {e}")
        return None

    def _save_score(
        self,
        business_id: str,
        score: int,
        components: dict,
        supabase,
    ) -> None:
        """Save score and component breakdown to businesses.pulse_score."""
        try:
            payload = {
                "pulse_score": score,
                "pulse_score_data": json.dumps({
                    "score": score,
                    "components": components,
                    "calculated_at": datetime.now(timezone.utc).isoformat(),
                }),
            }
            supabase.table("businesses").update(payload).eq("id", business_id).execute()
            logger.debug(f"[HealthScore] Saved score={score} for {business_id}")
        except Exception as e:
            # If pulse_score_data column doesn't exist, fall back to just pulse_score
            logger.debug(f"[HealthScore] Full save failed ({e}), trying pulse_score only")
            try:
                supabase.table("businesses").update(
                    {"pulse_score": score}
                ).eq("id", business_id).execute()
            except Exception as e2:
                logger.error(f"[HealthScore] Save failed for {business_id}: {e2}")


# =============================================================================
# Singleton accessor
# =============================================================================

def get_health_score_engine() -> HealthScoreEngine:
    """Return the singleton HealthScoreEngine instance."""
    global _instance
    if _instance is None:
        _instance = HealthScoreEngine()
    return _instance
