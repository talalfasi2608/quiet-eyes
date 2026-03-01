"""
Agent Scheduler — Central cron that triggers agents on schedule.
Integrates with GlobalRadar's existing polling loop.
"""

import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── Schedule Configuration (Israel time = UTC+2/+3) ──
# Times are in UTC. Israel is UTC+2 (winter) or UTC+3 (summer).
# 06:00 IST ≈ 03:00-04:00 UTC

AGENT_SCHEDULES = {
    "eyeni": {
        # Frequency varies by plan — handled in GlobalRadar job dispatch
        "description": "Lead hunting + competitor monitoring",
    },
    "hamoa": {
        "cron_hour": 4,  # ~06:00 IST
        "description": "Daily tasks + morning brief",
    },
    "hakol": {
        "cron_hour": 5,  # ~07:00 IST
        "cron_weekday": 6,  # Sunday (0=Mon in Python, 6=Sun)
        "description": "Weekly marketing plan",
    },
    "hakis": {
        "cron_hour": 5,  # ~07:00 IST
        "description": "Revenue trend analysis (daily)",
    },
    "haozen": {
        "interval_hours": 48,
        "description": "Review analysis (every 48h)",
    },
    "hatavach": {
        "cron_hour": 6,  # ~08:00 IST
        "cron_weekday": 0,  # Monday
        "description": "Market trend detection (weekly)",
    },
}

# Agent instances (lazy-loaded)
_agents = {}


def _get_agent(name: str):
    """Lazy-load agent instances."""
    if name not in _agents:
        if name == "eyeni":
            from agents.eyeni_agent import EyeniAgent
            _agents[name] = EyeniAgent()
        elif name == "hamoa":
            from agents.hamoa_agent import HamoaAgent
            _agents[name] = HamoaAgent()
        elif name == "hakol":
            from agents.hakol_agent import HakolAgent
            _agents[name] = HakolAgent()
        elif name == "hakis":
            from agents.hakis_agent import HakisAgent
            _agents[name] = HakisAgent()
        elif name == "haozen":
            from agents.haozen_agent import HaozenAgent
            _agents[name] = HaozenAgent()
        elif name == "hatavach":
            from agents.hatavach_agent import HatavachAgent
            _agents[name] = HatavachAgent()
    return _agents.get(name)


def run_agent(name: str) -> dict:
    """Run an agent for all its eligible businesses."""
    agent = _get_agent(name)
    if not agent:
        return {"error": f"Unknown agent: {name}"}
    return agent.run()


def run_agent_single(name: str, business_id: str) -> dict:
    """Run an agent for a single business (manual trigger)."""
    agent = _get_agent(name)
    if not agent:
        return {"error": f"Unknown agent: {name}"}
    return agent.run_single(business_id)


def should_run_now(agent_name: str) -> bool:
    """Check if an agent should run based on its schedule."""
    config = AGENT_SCHEDULES.get(agent_name)
    if not config:
        return False

    now = datetime.now(timezone.utc)

    # Check weekday constraint
    if "cron_weekday" in config:
        if now.weekday() != config["cron_weekday"]:
            return False

    # Check hour constraint
    if "cron_hour" in config:
        if now.hour != config["cron_hour"]:
            return False
        # Only run in first 5 minutes of the hour
        if now.minute > 5:
            return False

    return True


def get_all_agent_info() -> list:
    """Get info about all agents for the settings page."""
    return [
        {
            "name": "eyeni",
            "display_name": "עיני",
            "emoji": "👁️",
            "description": "עוקב על השוק שלך — לידים ומתחרים",
            "plan_access": "paid",
            "schedule": "כל 30 דק׳ (PRO) / כל 2 שע׳ (GROWTH) / כל 6 שע׳ (STARTER)",
        },
        {
            "name": "hamoa",
            "display_name": "המוח",
            "emoji": "🧠",
            "description": "משימות יומיות, התראות חכמות וסיכום בוקר",
            "plan_access": "paid",
            "schedule": "כל יום ב-06:00",
        },
        {
            "name": "hakol",
            "display_name": "הקול",
            "emoji": "📢",
            "description": "תוכנית שיווק שבועית עם פוסטים מוכנים",
            "plan_access": "growth_pro",
            "schedule": "כל יום ראשון ב-07:00",
        },
        {
            "name": "hakis",
            "display_name": "הכיס",
            "emoji": "💰",
            "description": "ניתוח מגמות ואיתור סיכונים",
            "plan_access": "pro",
            "schedule": "כל יום ב-07:00",
        },
        {
            "name": "haozen",
            "display_name": "האוזן",
            "emoji": "👂",
            "description": "ניתוח ביקורות ומציאת הזדמנויות נסתרות",
            "plan_access": "pro",
            "schedule": "כל 48 שעות",
        },
        {
            "name": "hatavach",
            "display_name": "הטווח",
            "emoji": "🔭",
            "description": "זיהוי מגמות שוק לפני שהן מגיעות",
            "plan_access": "pro",
            "schedule": "כל יום שני ב-08:00",
        },
    ]
