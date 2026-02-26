"""
Scheduler Service for Quiet Eyes.

Manages scheduled jobs (competitor scans, lead sniping, market discovery,
weekly reports) with cron-based timing and database-backed state.
"""

import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


def safe_print(msg: str):
    """Print with fallback for encoding issues."""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("utf-8", errors="replace").decode("utf-8"))


# =============================================================================
# JOB TYPES
# =============================================================================

class JobType:
    """Constants for the supported scheduled job types."""
    COMPETITOR_SCAN = "competitor_scan"
    LEAD_SNIPE = "lead_snipe"
    PRICE_CHECK = "price_check"
    MARKET_DISCOVERY = "market_discovery"
    WEEKLY_REPORT = "weekly_report"
    MASTER_INTEL_SCAN = "master_intel_scan"
    WEEKLY_MEMORY_SNAPSHOT = "weekly_memory_snapshot"
    WEEKLY_PREDICTION = "weekly_prediction"
    MONTHLY_PATTERNS = "monthly_patterns"
    # Phase 3: Automation Engine
    REVIEW_MONITOR = "review_monitor"
    COMPETITOR_ALERTS_AUTO = "competitor_alerts_auto"
    MORNING_BRIEFING = "morning_briefing"
    CAMPAIGN_TRIGGERS = "campaign_triggers"
    # Phase 4: Expanded Data Sources
    MEGA_SCAN = "mega_scan"
    WEATHER_UPDATE = "weather_update"
    JOBS_SCAN = "jobs_scan"
    LICENSES_SCAN = "licenses_scan"
    # Daily full scan (leads + competitors + market discovery)
    DAILY_FULL_SCAN = "daily_full_scan"
    # Aliases (legacy job types created by older onboarding code)
    INTEL_LEADS = "intel_leads"
    INTEL_COMPETITORS = "intel_competitors"
    INTEL_TRENDS = "intel_trends"
    AUDIENCE_SCAN = "audience_scan"
    DAILY_SUMMARY = "daily_summary"


DEFAULT_JOBS = [
    {
        "job_type": JobType.COMPETITOR_SCAN,
        "cron_expression": "0 */6 * * *",   # every 6 hours
    },
    {
        "job_type": JobType.LEAD_SNIPE,
        "cron_expression": "0 */4 * * *",   # every 4 hours
    },
    {
        "job_type": JobType.MARKET_DISCOVERY,
        "cron_expression": "0 0 * * *",     # daily at midnight
    },
    {
        "job_type": JobType.WEEKLY_REPORT,
        "cron_expression": "0 8 * * 0",     # Sunday 8am UTC
    },
    {
        "job_type": JobType.MASTER_INTEL_SCAN,
        "cron_expression": "0 */6 * * *",   # every 6 hours
    },
    {
        "job_type": JobType.WEEKLY_MEMORY_SNAPSHOT,
        "cron_expression": "0 6 * * 0",     # Sunday 6am UTC
    },
    {
        "job_type": JobType.WEEKLY_PREDICTION,
        "cron_expression": "0 7 * * 0",     # Sunday 7am UTC
    },
    {
        "job_type": JobType.MONTHLY_PATTERNS,
        "cron_expression": "0 4 1 * *",     # 1st of month 4am UTC
    },
    # Phase 3: Automation Engine
    {
        "job_type": JobType.REVIEW_MONITOR,
        "cron_expression": "0 */1 * * *",   # hourly
    },
    {
        "job_type": JobType.COMPETITOR_ALERTS_AUTO,
        "cron_expression": "0 */3 * * *",   # every 3 hours
    },
    {
        "job_type": JobType.MORNING_BRIEFING,
        "cron_expression": "0 6 * * *",     # daily 6am UTC (8am Israel)
    },
    {
        "job_type": JobType.CAMPAIGN_TRIGGERS,
        "cron_expression": "0 7 * * *",     # daily 7am UTC (9am Israel)
    },
    # Daily full scan: leads + competitors + market at 6am UTC (8am Israel)
    {
        "job_type": JobType.DAILY_FULL_SCAN,
        "cron_expression": "0 6 * * *",     # daily 6am UTC (8am Israel)
    },
    # Phase 4: Expanded Data Sources
    {
        "job_type": JobType.MEGA_SCAN,
        "cron_expression": "0 8 * * *",     # daily 8am UTC (10am Israel)
    },
    {
        "job_type": JobType.WEATHER_UPDATE,
        "cron_expression": "0 4 * * *",     # daily 4am UTC (6am Israel)
    },
    {
        "job_type": JobType.JOBS_SCAN,
        "cron_expression": "0 5 * * 1",     # Monday 5am UTC (7am Israel)
    },
    {
        "job_type": JobType.LICENSES_SCAN,
        "cron_expression": "0 5 * * 2",     # Tuesday 5am UTC (7am Israel)
    },
]


# =============================================================================
# SCHEDULER SERVICE
# =============================================================================

class SchedulerService:
    """
    Manages scheduled job lifecycle: creation, querying, execution tracking.
    Jobs are stored in the `scheduled_jobs` Supabase table.
    """

    def __init__(self):
        self._supabase = None

    @property
    def supabase(self):
        if self._supabase is None:
            try:
                from config import supabase
                self._supabase = supabase
            except ImportError:
                logger.warning("Supabase not available for scheduler")
        return self._supabase

    # -------------------------------------------------------------------------
    # Ensure default jobs exist for a business
    # -------------------------------------------------------------------------

    def ensure_default_jobs(self, business_id: str):
        """Create missing default jobs for a business."""
        if not self.supabase:
            return

        try:
            existing = (
                self.supabase.table("scheduled_jobs")
                .select("job_type")
                .eq("business_id", business_id)
                .execute()
            )
            existing_types = {j["job_type"] for j in (existing.data or [])}

            for job_def in DEFAULT_JOBS:
                if job_def["job_type"] not in existing_types:
                    self.supabase.table("scheduled_jobs").insert({
                        "business_id": business_id,
                        "job_type": job_def["job_type"],
                        "cron_expression": job_def["cron_expression"],
                        "status": "active",
                        "next_run_at": (
                            self._calculate_next_run(job_def["cron_expression"])
                            or datetime.now(timezone.utc) + timedelta(hours=1)
                        ).isoformat(),
                    }).execute()
                    safe_print(
                        f"[Scheduler] Created {job_def['job_type']} job for {business_id}"
                    )
        except Exception as e:
            logger.error(f"ensure_default_jobs error: {e}")

    # -------------------------------------------------------------------------
    # Get jobs for a business
    # -------------------------------------------------------------------------

    def get_jobs(self, business_id: str) -> list[dict]:
        """Returns all scheduled jobs for a business."""
        if not self.supabase:
            return []
        try:
            result = (
                self.supabase.table("scheduled_jobs")
                .select("*")
                .eq("business_id", business_id)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"get_jobs error: {e}")
            return []

    # -------------------------------------------------------------------------
    # Toggle job active/paused
    # -------------------------------------------------------------------------

    def toggle_job(self, job_id: str, active: bool):
        """Sets job status to 'active' or 'paused'."""
        if not self.supabase:
            return
        try:
            self.supabase.table("scheduled_jobs").update({
                "status": "active" if active else "paused",
            }).eq("id", job_id).execute()
        except Exception as e:
            logger.error(f"toggle_job error: {e}")

    # -------------------------------------------------------------------------
    # Get due jobs
    # -------------------------------------------------------------------------

    def get_due_jobs(self) -> list[dict]:
        """Returns all active jobs where next_run_at <= now or is null."""
        if not self.supabase:
            return []
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            # Jobs that are due
            due = (
                self.supabase.table("scheduled_jobs")
                .select("*")
                .eq("status", "active")
                .lte("next_run_at", now_iso)
                .execute()
            )
            # Jobs that have never run (null next_run_at)
            null_next = (
                self.supabase.table("scheduled_jobs")
                .select("*")
                .eq("status", "active")
                .is_("next_run_at", "null")
                .execute()
            )
            all_jobs = (due.data or []) + (null_next.data or [])
            # De-duplicate by id
            seen = set()
            unique = []
            for j in all_jobs:
                if j["id"] not in seen:
                    seen.add(j["id"])
                    unique.append(j)
            return unique
        except Exception as e:
            logger.error(f"get_due_jobs error: {e}")
            return []

    # -------------------------------------------------------------------------
    # Mark job as run and calculate next run
    # -------------------------------------------------------------------------

    def mark_job_run(self, job_id: str):
        """Sets last_run_at to now and calculates next_run_at."""
        if not self.supabase:
            return
        try:
            # Get the job's cron expression
            job = (
                self.supabase.table("scheduled_jobs")
                .select("cron_expression")
                .eq("id", job_id)
                .single()
                .execute()
            )
            cron_expr = (job.data or {}).get("cron_expression", "")
            next_run = self._calculate_next_run(cron_expr)

            update = {
                "last_run_at": datetime.now(timezone.utc).isoformat(),
            }
            if next_run:
                update["next_run_at"] = next_run.isoformat()

            self.supabase.table("scheduled_jobs").update(update).eq("id", job_id).execute()
        except Exception as e:
            logger.error(f"mark_job_run error: {e}")

    # -------------------------------------------------------------------------
    # Cron parser (with day-of-week support — SPRINT 12 FIX)
    # -------------------------------------------------------------------------

    def _calculate_next_run(self, cron_expression: str) -> Optional[datetime]:
        """
        Calculate the next run datetime from a cron expression.
        Tries croniter first (if installed). Falls back to manual parser.

        Supported manual patterns:
          - "0 */N * * *"  -> every N hours at minute 0
          - "0 0 * * *"    -> daily at midnight UTC
          - "M H * * *"    -> specific time daily
          - "M H * * D"    -> specific time on day-of-week (SPRINT 12)
                              Cron day-of-week: 0=Sunday
                              Python weekday: 0=Monday
                              Conversion: (cron_day - 1) % 7
        """
        now = datetime.now(timezone.utc)

        # Try croniter first
        try:
            from croniter import croniter
            cron = croniter(cron_expression, now)
            return cron.get_next(datetime).replace(tzinfo=timezone.utc)
        except ImportError:
            pass
        except Exception as e:
            safe_print(f"[Scheduler] croniter error for '{cron_expression}': {e}")

        # ── Pattern: "M H * * D" — specific day-of-week (SPRINT 12 FIX) ──
        dow_match = re.match(
            r"^(\d+)\s+(\d+)\s+\*\s+\*\s+(\d+)$", cron_expression
        )
        if dow_match:
            minute = int(dow_match.group(1))
            hour = int(dow_match.group(2))
            cron_dow = int(dow_match.group(3))  # 0=Sunday
            # Convert cron day-of-week to Python weekday (0=Monday)
            python_dow = (cron_dow - 1) % 7

            candidate = now.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )
            # Find the next occurrence of this weekday
            days_ahead = python_dow - candidate.weekday()
            if days_ahead < 0:
                days_ahead += 7
            candidate = candidate + timedelta(days=days_ahead)
            # If candidate is in the past (same day but earlier time), add 7 days
            if candidate <= now:
                candidate += timedelta(days=7)
            return candidate

        # ── Pattern: "M H D * *" -> specific day of month ──
        dom_match = re.match(
            r"^(\d+)\s+(\d+)\s+(\d+)\s+\*\s+\*$", cron_expression
        )
        if dom_match:
            minute = int(dom_match.group(1))
            hour = int(dom_match.group(2))
            day = int(dom_match.group(3))

            candidate = now.replace(
                day=day, hour=hour, minute=minute, second=0, microsecond=0
            )
            if candidate <= now:
                # Move to next month
                if candidate.month == 12:
                    candidate = candidate.replace(year=candidate.year + 1, month=1)
                else:
                    candidate = candidate.replace(month=candidate.month + 1)
            return candidate

        # ── Pattern: "0 */N * * *" -> every N hours at minute 0 ──
        every_n_hours = re.match(
            r"^0\s+\*/(\d+)\s+\*\s+\*\s+\*$", cron_expression
        )
        if every_n_hours:
            n = int(every_n_hours.group(1))
            current_hour = now.hour
            # Find next hour that is a multiple of N
            next_hour = ((current_hour // n) + 1) * n
            if next_hour >= 24:
                # Roll over to next day
                next_run = now.replace(
                    hour=next_hour % 24, minute=0, second=0, microsecond=0
                ) + timedelta(days=next_hour // 24)
            else:
                next_run = now.replace(
                    hour=next_hour, minute=0, second=0, microsecond=0
                )
            if next_run <= now:
                next_run += timedelta(hours=n)
            return next_run

        # ── Pattern: "0 0 * * *" -> daily at midnight UTC ──
        daily_midnight = re.match(
            r"^0\s+0\s+\*\s+\*\s+\*$", cron_expression
        )
        if daily_midnight:
            next_midnight = now.replace(
                hour=0, minute=0, second=0, microsecond=0
            ) + timedelta(days=1)
            return next_midnight

        # ── Pattern: "M H * * *" -> specific time daily ──
        specific_time = re.match(
            r"^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$", cron_expression
        )
        if specific_time:
            minute = int(specific_time.group(1))
            hour = int(specific_time.group(2))
            candidate = now.replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )
            if candidate <= now:
                candidate += timedelta(days=1)
            return candidate

        safe_print(
            f"[Scheduler] Unable to parse cron expression: '{cron_expression}'"
        )
        return None


# =============================================================================
# SINGLETON
# =============================================================================

_instance: Optional[SchedulerService] = None


def get_scheduler() -> SchedulerService:
    global _instance
    if _instance is None:
        _instance = SchedulerService()
    return _instance
