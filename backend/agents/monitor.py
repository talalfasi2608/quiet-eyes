"""
Agent Monitor — Checks heartbeats, alerts admin on failures.
Runs every 2 minutes.
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from agents.base_agent import _get_supabase

logger = logging.getLogger(__name__)

ALL_AGENTS = ["eyeni", "hamoa", "hakol", "hakis", "haozen", "hatavach"]


def check_agent_health():
    """Check all agent heartbeats, alert if any are silent."""
    sb = _get_supabase()
    if not sb:
        return

    try:
        heartbeats = sb.table("agent_heartbeats").select("*").execute()
        hb_map = {h["agent_name"]: h for h in (heartbeats.data or [])}

        now = datetime.now(timezone.utc)
        problems = []

        for agent_name in ALL_AGENTS:
            hb = hb_map.get(agent_name)
            if not hb:
                continue  # Agent hasn't been started yet — not an error

            last_seen = hb.get("last_seen")
            if last_seen:
                last_dt = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                gap_minutes = (now - last_dt).total_seconds() / 60

                if gap_minutes > 2 and hb.get("status") == "active":
                    problems.append(f"🚨 {agent_name} לא מדווח מזה {int(gap_minutes)} דקות")

        if problems:
            _alert_admin("\n".join(problems))

    except Exception as e:
        logger.error(f"[monitor] Health check failed: {e}")


def get_agent_status():
    """Get status of all agents for dashboard display."""
    sb = _get_supabase()
    if not sb:
        return []

    try:
        heartbeats = sb.table("agent_heartbeats").select("*").execute()
        hb_map = {h["agent_name"]: h for h in (heartbeats.data or [])}

        # Get last run for each agent
        runs = sb.table("agent_runs").select(
            "agent_name, status, items_found, started_at, finished_at"
        ).order("started_at", desc=True).limit(30).execute()

        last_runs = {}
        for r in (runs.data or []):
            name = r["agent_name"]
            if name not in last_runs:
                last_runs[name] = r

        # Get today's stats
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        today_runs = sb.table("agent_runs").select(
            "agent_name, items_found, status"
        ).gte("started_at", today_start).execute()

        today_stats = {}
        for r in (today_runs.data or []):
            name = r["agent_name"]
            if name not in today_stats:
                today_stats[name] = {"runs": 0, "items": 0, "errors": 0}
            today_stats[name]["runs"] += 1
            today_stats[name]["items"] += r.get("items_found", 0)
            if r.get("status") == "failed":
                today_stats[name]["errors"] += 1

        agent_info = {
            "eyeni": {"display_name": "עיני", "emoji": "👁️", "description": "עוקב על השוק שלך"},
            "hamoa": {"display_name": "המוח", "emoji": "🧠", "description": "משימות יומיות וסיכום בוקר"},
            "hakol": {"display_name": "הקול", "emoji": "📢", "description": "תוכנית שיווק שבועית"},
            "hakis": {"display_name": "הכיס", "emoji": "💰", "description": "ניתוח מגמות"},
            "haozen": {"display_name": "האוזן", "emoji": "👂", "description": "ניתוח ביקורות"},
            "hatavach": {"display_name": "הטווח", "emoji": "🔭", "description": "מגמות שוק"},
        }

        result = []
        for name in ALL_AGENTS:
            info = agent_info.get(name, {})
            hb = hb_map.get(name, {})
            lr = last_runs.get(name, {})
            ts = today_stats.get(name, {"runs": 0, "items": 0, "errors": 0})

            result.append({
                "name": name,
                "display_name": info.get("display_name", name),
                "emoji": info.get("emoji", "🤖"),
                "description": info.get("description", ""),
                "status": hb.get("status", "idle"),
                "last_seen": hb.get("last_seen"),
                "last_run_status": lr.get("status"),
                "last_run_at": lr.get("started_at"),
                "last_run_items": lr.get("items_found", 0),
                "today_runs": ts["runs"],
                "today_items": ts["items"],
                "today_errors": ts["errors"],
            })

        return result

    except Exception as e:
        logger.error(f"[monitor] Status check failed: {e}")
        return []


def get_recent_runs(agent_name: str = None, limit: int = 20):
    """Get recent agent runs for admin dashboard."""
    sb = _get_supabase()
    if not sb:
        return []

    try:
        query = sb.table("agent_runs").select("*").order("started_at", desc=True).limit(limit)
        if agent_name:
            query = query.eq("agent_name", agent_name)
        result = query.execute()
        return result.data or []
    except Exception:
        return []


def get_today_token_usage():
    """Get total tokens used today by all agents."""
    sb = _get_supabase()
    if not sb:
        return 0

    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        result = sb.table("ai_usage").select("tokens").gte("created_at", today_start).execute()
        return sum(r.get("tokens", 0) for r in (result.data or []))
    except Exception:
        return 0


def _alert_admin(message: str):
    """Send WhatsApp alert to admin."""
    admin_phone = os.getenv("ADMIN_PHONE")
    if not admin_phone:
        logger.warning("[monitor] ADMIN_PHONE not set")
        return

    try:
        from twilio.rest import Client
        sid = os.getenv("TWILIO_ACCOUNT_SID")
        token = os.getenv("TWILIO_AUTH_TOKEN")
        from_num = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
        if sid and token:
            client = Client(sid, token)
            if not admin_phone.startswith("+"):
                admin_phone = f"+{admin_phone}"
            client.messages.create(
                body=message,
                from_=from_num,
                to=f"whatsapp:{admin_phone}",
            )
    except Exception as e:
        logger.error(f"[monitor] Admin alert failed: {e}")
