"""
Base Agent — Abstract class all Quieteyes agents extend.
Every agent: heartbeat, run logging, error isolation per user.
"""

import logging
import time
import threading
from abc import ABC, abstractmethod
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _get_supabase():
    """Get service-role Supabase client."""
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _get_claude():
    """Get Anthropic client."""
    try:
        import os
        from anthropic import Anthropic
        key = os.getenv("ANTHROPIC_API_KEY")
        if key:
            return Anthropic(api_key=key)
    except Exception:
        pass
    return None


class BaseAgent(ABC):
    """Abstract base class for all Quieteyes agents."""

    name: str = "unknown"
    display_name: str = "Unknown"
    emoji: str = "🤖"
    description: str = ""
    # Plans that can use this agent: "all", "paid", "growth_pro", "pro"
    plan_access: str = "paid"

    def __init__(self):
        self._heartbeat_thread = None
        self._running = False

    @abstractmethod
    def process_user(self, business_id: str, user_id: str, supabase) -> dict:
        """Process one user/business. Returns {items_found, tokens_used, ...}."""
        pass

    def get_eligible_businesses(self, supabase) -> list:
        """Get businesses eligible for this agent based on plan."""
        try:
            query = supabase.table("businesses").select(
                "id, user_id, subscription_plan"
            )
            result = query.execute()
            rows = result.data or []

            if self.plan_access == "all":
                return rows
            elif self.plan_access == "paid":
                return [r for r in rows if r.get("subscription_plan") not in (None, "free")]
            elif self.plan_access == "growth_pro":
                return [r for r in rows if r.get("subscription_plan") in ("growth", "pro", "business", "elite")]
            elif self.plan_access == "pro":
                return [r for r in rows if r.get("subscription_plan") in ("pro", "business", "elite")]
            return rows
        except Exception as e:
            logger.error(f"[{self.name}] Failed to get businesses: {e}")
            return []

    def run(self):
        """Main entry point — runs agent for all eligible users."""
        sb = _get_supabase()
        if not sb:
            logger.error(f"[{self.name}] No Supabase client")
            return {"error": "Database unavailable"}

        self._running = True
        self._start_heartbeat(sb)
        total_items = 0
        total_tokens = 0
        processed = 0
        errors = 0

        try:
            businesses = self.get_eligible_businesses(sb)
            logger.info(f"[{self.name}] Processing {len(businesses)} businesses")

            for biz in businesses:
                business_id = biz["id"]
                user_id = biz.get("user_id")
                run_id = self._log_run_start(sb, user_id)

                try:
                    result = self.process_user(business_id, user_id, sb)
                    self._log_run_complete(sb, run_id, result)
                    total_items += result.get("items_found", 0)
                    total_tokens += result.get("tokens_used", 0)
                    processed += 1
                except Exception as e:
                    logger.error(f"[{self.name}] Error for {business_id}: {e}")
                    self._log_run_failed(sb, run_id, str(e))
                    errors += 1
                    continue  # One user failing never stops others
        finally:
            self._running = False
            self._update_heartbeat(sb, "idle")

        return {
            "processed": processed,
            "errors": errors,
            "items_found": total_items,
            "tokens_used": total_tokens,
        }

    def run_single(self, business_id: str):
        """Run agent for a single business (manual trigger)."""
        sb = _get_supabase()
        if not sb:
            return {"error": "Database unavailable"}

        try:
            result = sb.table("businesses").select("user_id").eq("id", business_id).execute()
            user_id = result.data[0]["user_id"] if result.data else None
        except Exception:
            user_id = None

        run_id = self._log_run_start(sb, user_id)
        try:
            result = self.process_user(business_id, user_id, sb)
            self._log_run_complete(sb, run_id, result)
            return result
        except Exception as e:
            self._log_run_failed(sb, run_id, str(e))
            return {"error": str(e)}

    # ── Heartbeat ────────────────────────────────────────────

    def _start_heartbeat(self, supabase):
        self._update_heartbeat(supabase, "active")

        def heartbeat_loop():
            while self._running:
                try:
                    self._update_heartbeat(supabase, "active")
                except Exception:
                    pass
                time.sleep(30)

        self._heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

    def _update_heartbeat(self, supabase, status: str):
        try:
            supabase.table("agent_heartbeats").upsert({
                "agent_name": self.name,
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "status": status,
            }).execute()
        except Exception:
            pass

    # ── Run Logging ──────────────────────────────────────────

    def _log_run_start(self, supabase, user_id: str = None) -> str:
        try:
            result = supabase.table("agent_runs").insert({
                "agent_name": self.name,
                "user_id": user_id,
                "status": "running",
            }).execute()
            return result.data[0]["id"] if result.data else None
        except Exception:
            return None

    def _log_run_complete(self, supabase, run_id: str, result: dict):
        if not run_id:
            return
        try:
            supabase.table("agent_runs").update({
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed",
                "items_found": result.get("items_found", 0),
                "tokens_used": result.get("tokens_used", 0),
            }).eq("id", run_id).execute()
        except Exception:
            pass

    def _log_run_failed(self, supabase, run_id: str, error: str):
        if not run_id:
            return
        try:
            supabase.table("agent_runs").update({
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "status": "failed",
                "error_message": error[:500],
            }).eq("id", run_id).execute()
        except Exception:
            pass

    # ── Utilities ────────────────────────────────────────────

    def log_finding(self, supabase, user_id: str, finding_type: str, data: dict, score: int = 0):
        """Log a finding from this agent."""
        try:
            supabase.table("agent_findings").insert({
                "agent_name": self.name,
                "user_id": user_id,
                "finding_type": finding_type,
                "data": data,
                "score": score,
            }).execute()
        except Exception:
            pass

    def log_ai_usage(self, supabase, user_id: str, tokens: int):
        """Log AI token usage."""
        try:
            supabase.table("ai_usage").insert({
                "user_id": user_id,
                "agent_name": self.name,
                "tokens": tokens,
            }).execute()
        except Exception:
            pass

    def call_claude(self, system_prompt: str, user_prompt: str, supabase=None, user_id: str = None) -> str:
        """Call Claude and track usage."""
        client = _get_claude()
        if not client:
            raise RuntimeError("Anthropic client not available")

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = response.content[0].text if response.content else ""
        tokens = (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)

        if supabase and user_id:
            self.log_ai_usage(supabase, user_id, tokens)

        return text, tokens

    def send_whatsapp(self, phone: str, message: str):
        """Send WhatsApp message via Twilio."""
        try:
            import os
            from twilio.rest import Client
            sid = os.getenv("TWILIO_ACCOUNT_SID")
            token = os.getenv("TWILIO_AUTH_TOKEN")
            from_num = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
            if not sid or not token:
                logger.warning(f"[{self.name}] Twilio not configured")
                return False
            client = Client(sid, token)
            # Normalize phone
            if not phone.startswith("+"):
                phone = f"+{phone}"
            if not phone.startswith("whatsapp:"):
                phone = f"whatsapp:{phone}"
            client.messages.create(body=message, from_=from_num, to=phone)
            return True
        except Exception as e:
            logger.error(f"[{self.name}] WhatsApp send failed: {e}")
            return False

    def get_business_phone(self, supabase, business_id: str) -> str:
        """Get WhatsApp phone for a business owner."""
        try:
            result = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
            if not result.data:
                return None
            user_id = result.data[0]["user_id"]
            profile = supabase.table("profiles").select("phone").eq("id", user_id).execute()
            if profile.data and profile.data[0].get("phone"):
                return profile.data[0]["phone"]
            # Try notification preferences
            notif = supabase.table("notification_preferences").select("whatsapp_number").eq("workspace_id", business_id).execute()
            if notif.data and notif.data[0].get("whatsapp_number"):
                return notif.data[0]["whatsapp_number"]
        except Exception:
            pass
        return None

    def get_business_data(self, supabase, business_id: str) -> dict:
        """Get full business data."""
        try:
            result = supabase.table("businesses").select("*").eq("id", business_id).execute()
            return result.data[0] if result.data else {}
        except Exception:
            return {}
