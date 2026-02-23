"""
System Logger Service for Quiet Eyes.

Writes structured error/event logs to the `system_logs` Supabase table
and optionally notifies the super-admin via WhatsApp.

Table schema (system_logs):
  id            uuid   PK default gen_random_uuid()
  created_at    timestamptz default now()
  level         text   ('info' | 'warning' | 'error' | 'critical')
  source        text   (e.g. 'crm_push', 'whatsapp', 'credit_guard', 'pdf_generator')
  message       text
  details       jsonb  (extra context: business_id, workspace_id, stack trace, etc.)
  notified      bool   default false
"""

import os
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

SUPER_ADMIN_UID = os.getenv("SUPER_ADMIN_UID", "")


class SystemLogger:
    """Writes structured logs to system_logs table and notifies super-admin."""

    def __init__(self):
        self._supabase = None

    @property
    def supabase(self):
        if self._supabase is None:
            try:
                from config import supabase
                self._supabase = supabase
            except ImportError:
                logger.warning("Supabase not available for system logger")
        return self._supabase

    def log(
        self,
        level: str,
        source: str,
        message: str,
        details: Optional[dict] = None,
        notify_admin: bool = False,
    ):
        """
        Write a log entry to the system_logs table.

        Args:
            level: 'info', 'warning', 'error', 'critical'
            source: Component name (e.g. 'crm_push', 'whatsapp', 'credit_guard')
            message: Human-readable summary
            details: Extra JSON context (business_id, error trace, etc.)
            notify_admin: If True, send WhatsApp notification to super-admin
        """
        # Always log to Python logger too
        py_level = getattr(logging, level.upper(), logging.ERROR)
        logger.log(py_level, f"[{source}] {message}")

        row = {
            "level": level,
            "source": source,
            "message": message,
            "details": details or {},
            "notified": False,
        }

        # Write to database
        if self.supabase:
            try:
                self.supabase.table("system_logs").insert(row).execute()
            except Exception as e:
                logger.error(f"Failed to write system_log: {e}")

        # Notify super-admin for critical/error events if requested
        if notify_admin and level in ("error", "critical"):
            self._notify_super_admin(source, message, details)

    def log_error(
        self,
        source: str,
        message: str,
        exception: Optional[Exception] = None,
        details: Optional[dict] = None,
        notify_admin: bool = True,
    ):
        """Convenience method for logging errors with exception trace."""
        if details is None:
            details = {}
        if exception:
            details["exception"] = str(exception)
            details["traceback"] = traceback.format_exc()

        self.log("error", source, message, details=details, notify_admin=notify_admin)

    def log_critical(
        self,
        source: str,
        message: str,
        details: Optional[dict] = None,
    ):
        """Convenience method for critical events — always notifies admin."""
        self.log("critical", source, message, details=details, notify_admin=True)

    def _notify_super_admin(
        self, source: str, message: str, details: Optional[dict] = None
    ):
        """Send a WhatsApp alert to the super-admin about a system error."""
        if not self.supabase or not SUPER_ADMIN_UID:
            return

        try:
            # Look up super-admin's WhatsApp phone
            profile = (
                self.supabase.table("profiles")
                .select("phone")
                .eq("id", SUPER_ADMIN_UID)
                .maybe_single()
                .execute()
            )
            phone = (profile.data or {}).get("phone", "")
            if not phone:
                # Try notification_preferences via workspace membership
                member = (
                    self.supabase.table("workspace_members")
                    .select("workspace_id")
                    .eq("user_id", SUPER_ADMIN_UID)
                    .limit(1)
                    .execute()
                )
                ws_id = ((member.data or [{}])[0]).get("workspace_id") if member.data else None
                if ws_id:
                    prefs = (
                        self.supabase.table("notification_preferences")
                        .select("whatsapp_phone")
                        .eq("workspace_id", ws_id)
                        .maybe_single()
                        .execute()
                    )
                    phone = (prefs.data or {}).get("whatsapp_phone", "")

            if not phone:
                return

            from services.whatsapp import send_whatsapp_message

            biz_id = (details or {}).get("business_id", "N/A")
            alert_msg = (
                f"[SYSTEM ALERT] {source}\n"
                f"{message}\n"
                f"Business: {biz_id}"
            )
            send_whatsapp_message(phone, alert_msg)

            # Mark as notified
            if self.supabase:
                try:
                    self.supabase.table("system_logs").update(
                        {"notified": True}
                    ).eq("source", source).eq("message", message).order(
                        "created_at", desc=True
                    ).limit(1).execute()
                except Exception:
                    pass

        except ImportError:
            logger.debug("WhatsApp service not available for admin notification")
        except Exception as e:
            logger.error(f"Failed to notify super-admin: {e}")


# =============================================================================
# SINGLETON
# =============================================================================

_instance: Optional[SystemLogger] = None


def get_system_logger() -> SystemLogger:
    global _instance
    if _instance is None:
        _instance = SystemLogger()
    return _instance
