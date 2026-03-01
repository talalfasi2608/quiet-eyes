"""
Daily Task Generator — creates 3 actionable daily tasks per business using Claude AI.

Analyzes today's leads, competitor changes, and health score to produce
specific, data-driven Hebrew tasks with estimated time and impact level.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


class DailyTaskGenerator:
    """Generates, stores, and manages daily tasks for each business."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_daily_tasks(self, business_id: str, supabase) -> list[dict]:
        """
        Generate 3 daily tasks for a business and persist them.

        1. Fetch business info (type, city)
        2. Fetch today's leads count + top lead text
        3. Fetch recent competitor changes
        4. Fetch current health score
        5. Call Claude to produce 3 tasks in Hebrew
        6. Clear old uncompleted tasks, insert new ones

        Returns the list of newly created task rows.
        """
        try:
            biz_info = self._get_business_info(business_id, supabase)
            if not biz_info:
                logger.warning(f"[DailyTasks] No business info for {business_id}")
                return []

            leads_data = self._get_todays_leads(business_id, supabase)
            competitor_changes = self._get_competitor_changes(business_id, supabase)
            health_score = self._get_health_score(business_id, supabase)

            tasks = self._generate_tasks_with_claude(
                biz_info, leads_data, competitor_changes, health_score
            )

            if not tasks:
                logger.warning(f"[DailyTasks] Claude returned no tasks for {business_id}")
                return []

            # Clear old uncompleted tasks before inserting fresh ones
            self._clear_old_uncompleted(business_id, supabase)

            saved = self._save_tasks(business_id, tasks, supabase)
            logger.info(f"[DailyTasks] Generated {len(saved)} tasks for {business_id}")
            return saved

        except Exception as e:
            logger.error(f"[DailyTasks] Error generating tasks for {business_id}: {e}")
            return []

    def complete_task(self, task_id: str, supabase) -> Optional[dict]:
        """
        Mark a task as completed with the current timestamp.

        Returns the updated task row, or None on failure.
        """
        try:
            result = (
                supabase.table("daily_tasks")
                .update({
                    "completed": True,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", task_id)
                .execute()
            )
            rows = result.data or []
            if rows:
                logger.info(f"[DailyTasks] Task {task_id} marked completed")
                return rows[0]
            return None
        except Exception as e:
            logger.error(f"[DailyTasks] Error completing task {task_id}: {e}")
            return None

    def get_todays_tasks(self, business_id: str, supabase) -> list[dict]:
        """
        Return today's tasks for a business (generated today, UTC day).
        """
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()

        try:
            result = (
                supabase.table("daily_tasks")
                .select("*")
                .eq("business_id", business_id)
                .gte("generated_at", today_start)
                .order("generated_at", desc=False)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"[DailyTasks] Error fetching today's tasks for {business_id}: {e}")
            return []

    # ------------------------------------------------------------------
    # Data gathering helpers
    # ------------------------------------------------------------------

    def _get_business_info(self, business_id: str, supabase) -> Optional[dict]:
        """Fetch business type and city."""
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

    def _get_todays_leads(self, business_id: str, supabase) -> dict:
        """Fetch today's lead count and the text of the top lead."""
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        data = {"count": 0, "top_lead_text": ""}

        try:
            result = (
                supabase.table("leads_discovered")
                .select("id, title, description, score")
                .eq("business_id", business_id)
                .gte("created_at", since)
                .order("score", desc=True)
                .limit(10)
                .execute()
            )
            rows = result.data or []
            data["count"] = len(rows)
            if rows:
                top = rows[0]
                data["top_lead_text"] = (
                    f"{top.get('title', '')} — {top.get('description', '')}"
                ).strip(" —")
        except Exception:
            pass

        return data

    def _get_competitor_changes(self, business_id: str, supabase) -> list[str]:
        """Fetch recent competitor change summaries."""
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        try:
            result = (
                supabase.table("intelligence_events")
                .select("title")
                .eq("business_id", business_id)
                .eq("event_type", "competitor_change")
                .gte("created_at", since)
                .limit(5)
                .execute()
            )
            return [row.get("title", "") for row in (result.data or []) if row.get("title")]
        except Exception:
            return []

    def _get_health_score(self, business_id: str, supabase) -> Optional[int]:
        """Fetch the latest health score for the business."""
        try:
            result = (
                supabase.table("health_scores")
                .select("score")
                .eq("business_id", business_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if rows:
                return rows[0].get("score")
        except Exception:
            pass
        return None

    # ------------------------------------------------------------------
    # Claude AI integration
    # ------------------------------------------------------------------

    def _generate_tasks_with_claude(
        self,
        biz_info: dict,
        leads_data: dict,
        competitor_changes: list[str],
        health_score: Optional[int],
    ) -> list[dict]:
        """Call Claude to produce 3 daily tasks based on real data."""
        from services.claude_client import analyze

        business_type = biz_info.get("industry", "לא ידוע")
        city = biz_info.get("location", "לא ידוע")

        leads_count = leads_data.get("count", 0)
        top_lead = leads_data.get("top_lead_text", "אין")
        leads_text = f"{leads_count} לידים"
        if top_lead:
            leads_text += f", המוביל: {top_lead}"

        changes_text = "\n".join(f"- {c}" for c in competitor_changes) if competitor_changes else "אין שינויים"
        score_text = str(health_score) if health_score is not None else "לא זמין"

        prompt = f"""אתה יועץ עסקי לעסק ישראלי.

פרטי העסק:
סוג: {business_type}
עיר: {city}

נתונים מהיום:
לידים שנמצאו: {leads_text}
שינויים אצל מתחרים: {changes_text}
ציון בריאות: {score_text}

צור בדיוק 3 משימות לעסק להיום.
כל משימה:
- כותרת קצרה (עד 6 מילים)
- תיאור (משפט אחד)
- כמה דקות זה לוקח
- רמת השפעה: גבוהה/בינונית/נמוכה

דבר בעברית, חברותי, ספציפי.
לא גנרי — מבוסס על הנתונים האמיתיים.

החזר JSON בלבד בפורמט:
{{"tasks": [{{"title": "...", "description": "...", "minutes": 10, "impact": "high"}}]}}

impact חייב להיות אחד מ: high, medium, low"""

        try:
            raw = analyze(prompt, max_tokens=1000, temperature=0.7)
            return self._parse_tasks_response(raw)
        except Exception as e:
            logger.error(f"[DailyTasks] Claude error: {e}")
            return []

    def _parse_tasks_response(self, raw: str) -> list[dict]:
        """Parse Claude's JSON response into a list of task dicts."""
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith("```"):
            # Remove opening fence (```json or ```)
            first_newline = text.index("\n")
            text = text[first_newline + 1:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.error(f"[DailyTasks] Failed to parse JSON: {text[:200]}")
            return []

        tasks_raw = data.get("tasks", [])
        if not isinstance(tasks_raw, list):
            return []

        valid_impacts = {"high", "medium", "low"}
        # Map Hebrew impact values to English
        impact_map = {"גבוהה": "high", "בינונית": "medium", "נמוכה": "low"}

        tasks = []
        for t in tasks_raw[:3]:
            if not isinstance(t, dict):
                continue

            impact = str(t.get("impact", "medium")).lower()
            # Translate Hebrew impact if needed
            if impact in impact_map:
                impact = impact_map[impact]
            if impact not in valid_impacts:
                impact = "medium"

            minutes = t.get("minutes", 15)
            if not isinstance(minutes, int):
                try:
                    minutes = int(minutes)
                except (ValueError, TypeError):
                    minutes = 15

            tasks.append({
                "title": str(t.get("title", ""))[:100],
                "description": str(t.get("description", ""))[:500],
                "minutes": minutes,
                "impact": impact,
            })

        return tasks

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _clear_old_uncompleted(self, business_id: str, supabase) -> None:
        """Delete uncompleted tasks for the business (from previous days)."""
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()

        try:
            supabase.table("daily_tasks") \
                .delete() \
                .eq("business_id", business_id) \
                .eq("completed", False) \
                .lt("generated_at", today_start) \
                .execute()
        except Exception as e:
            logger.warning(f"[DailyTasks] Failed to clear old tasks for {business_id}: {e}")

    def _save_tasks(self, business_id: str, tasks: list[dict], supabase) -> list[dict]:
        """Insert task rows into daily_tasks and return the saved rows."""
        now = datetime.now(timezone.utc).isoformat()
        rows = [
            {
                "business_id": business_id,
                "title": t["title"],
                "description": t["description"],
                "minutes": t["minutes"],
                "impact": t["impact"],
                "completed": False,
                "completed_at": None,
                "generated_at": now,
            }
            for t in tasks
        ]

        try:
            result = supabase.table("daily_tasks").insert(rows).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"[DailyTasks] Failed to save tasks for {business_id}: {e}")
            return []


# ------------------------------------------------------------------
# Module-level convenience functions + singleton accessor
# ------------------------------------------------------------------

def get_daily_task_generator() -> DailyTaskGenerator:
    """Get or create the singleton DailyTaskGenerator instance."""
    global _instance
    if _instance is None:
        _instance = DailyTaskGenerator()
    return _instance


def generate_daily_tasks(business_id: str, supabase) -> list[dict]:
    """Convenience wrapper — generate 3 daily tasks for a business."""
    return get_daily_task_generator().generate_daily_tasks(business_id, supabase)


def complete_task(task_id: str, supabase) -> Optional[dict]:
    """Convenience wrapper — mark a task as completed."""
    return get_daily_task_generator().complete_task(task_id, supabase)


def get_todays_tasks(business_id: str, supabase) -> list[dict]:
    """Convenience wrapper — return today's tasks for a business."""
    return get_daily_task_generator().get_todays_tasks(business_id, supabase)
