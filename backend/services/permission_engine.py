"""
Permission Engine for Quiet Eyes.

Granular feature-level permission checking, usage tracking, and enforcement.
Uses config.plans as the single source of truth for plan limits.

Usage as FastAPI dependency:
    from services.permission_engine import require_feature

    @router.post("/leads/snipe/{business_id}")
    async def snipe(
        auth_user_id: str = Depends(require_auth),
        _=Depends(require_feature("leads_scans_per_month")),
    ):
        ...
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request

logger = logging.getLogger(__name__)


class PermissionEngine:
    """Singleton permission engine for checking plan limits and tracking usage."""

    def _get_supabase(self):
        """Get service-role Supabase client."""
        try:
            from supabase import create_client
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if url and key:
                return create_client(url, key)
        except Exception:
            pass
        return None

    def get_user_plan(self, user_id: str) -> dict:
        """
        Get the full plan dict for a user.
        Checks trial expiry and auto-downgrades expired trials.
        """
        from config.plans import PLANS

        sb = self._get_supabase()
        if not sb:
            return PLANS["free"]

        try:
            result = (
                sb.table("subscriptions")
                .select("plan_id, tier, status, trial_ends_at")
                .eq("user_id", user_id)
                .execute()
            )
            if not result.data or not result.data[0]:
                return PLANS["free"]

            sub = result.data[0]
            plan_id = sub.get("plan_id") or sub.get("tier") or "free"
            status = sub.get("status", "active")

            # Check trial expiry
            trial_ends = sub.get("trial_ends_at")
            if trial_ends and status == "trialing":
                try:
                    trial_dt = datetime.fromisoformat(
                        trial_ends.replace("Z", "+00:00")
                    )
                    if trial_dt < datetime.now(timezone.utc):
                        self.downgrade_to_free(user_id)
                        return PLANS["free"]
                except (ValueError, TypeError):
                    pass

            return PLANS.get(plan_id, PLANS["free"])

        except Exception as e:
            logger.debug(f"get_user_plan error: {e}")
            return PLANS["free"]

    def _get_plan_id(self, user_id: str) -> str:
        """Get just the plan_id string for a user."""
        sb = self._get_supabase()
        if not sb:
            return "free"
        try:
            result = (
                sb.table("subscriptions")
                .select("plan_id, tier")
                .eq("user_id", user_id)
                .execute()
            )
            if result.data and result.data[0]:
                return result.data[0].get("plan_id") or result.data[0].get("tier", "free")
        except Exception:
            pass
        return "free"

    def can_use(self, user_id: str, feature: str) -> dict:
        """
        Check if a user can use a feature.

        Returns:
            {
                "allowed": bool,
                "limit": int | bool | str,
                "used": int | None,
                "remaining": int | None,
                "upgrade_to": str | None,
                "upgrade_name": str | None,
                "upgrade_price": int | None,
            }
        """
        from config.plans import PLANS, get_upgrade_plan, PLAN_ORDER

        plan = self.get_user_plan(user_id)
        plan_id = self._get_plan_id(user_id)
        limits = plan.get("limits", {})
        limit = limits.get(feature)

        result = {
            "allowed": True,
            "limit": limit,
            "used": None,
            "remaining": None,
            "upgrade_to": None,
            "upgrade_name": None,
            "upgrade_price": None,
        }

        if limit is None:
            # Unknown feature — allow by default
            return result

        # String feature (e.g. support_level) — always allowed
        if isinstance(limit, str):
            return result

        # Boolean feature
        if isinstance(limit, bool):
            result["allowed"] = limit
            if not limit:
                upgrade_id = get_upgrade_plan(plan_id, feature)
                if upgrade_id:
                    up_plan = PLANS[upgrade_id]
                    result["upgrade_to"] = upgrade_id
                    result["upgrade_name"] = up_plan["name_he"]
                    result["upgrade_price"] = up_plan["price_monthly"]
            return result

        # Numeric feature
        if isinstance(limit, int):
            # Unlimited
            if limit == -1:
                result["remaining"] = -1
                return result

            used = self._get_usage(user_id, feature)
            result["used"] = used
            result["remaining"] = max(0, limit - used)
            result["allowed"] = used < limit

            if not result["allowed"]:
                upgrade_id = get_upgrade_plan(plan_id, feature)
                if upgrade_id:
                    up_plan = PLANS[upgrade_id]
                    result["upgrade_to"] = upgrade_id
                    result["upgrade_name"] = up_plan["name_he"]
                    result["upgrade_price"] = up_plan["price_monthly"]

            return result

        return result

    def track_usage(self, user_id: str, feature: str, business_id: Optional[str] = None):
        """Record a feature usage event in the usage_tracking table."""
        sb = self._get_supabase()
        if not sb:
            return

        now = datetime.now(timezone.utc)
        month_year = now.strftime("%Y-%m")

        try:
            row = {
                "user_id": user_id,
                "feature": feature,
                "month_year": month_year,
            }
            if business_id:
                row["business_id"] = business_id
            sb.table("usage_tracking").insert(row).execute()
        except Exception as e:
            logger.debug(f"track_usage insert failed: {e}")

    def downgrade_to_free(self, user_id: str):
        """Downgrade a user to the free plan (e.g. after trial expiry)."""
        from config.plans import PLANS

        sb = self._get_supabase()
        if not sb:
            return

        free = PLANS["free"]
        try:
            sb.table("subscriptions").update({
                "plan_id": "free",
                "tier": "free",
                "tier_name": free["name_he"],
                "credits_remaining": free["credits"],
                "credits_monthly_limit": free["credits"],
                "credits_used": 0,
                "status": "active",
            }).eq("user_id", user_id).execute()
            logger.info(f"Auto-downgraded user {user_id} to free (trial expired)")
        except Exception as e:
            logger.error(f"downgrade_to_free failed: {e}")

    def _get_usage(self, user_id: str, feature: str) -> int:
        """Get the current month's usage count for a feature."""
        sb = self._get_supabase()
        if not sb:
            return 0

        now = datetime.now(timezone.utc)
        month_year = now.strftime("%Y-%m")

        try:
            result = (
                sb.table("usage_tracking")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("feature", feature)
                .eq("month_year", month_year)
                .execute()
            )
            return result.count or 0
        except Exception:
            return 0

    def get_all_usage(self, user_id: str) -> dict:
        """Get usage counts for all features for the current month."""
        sb = self._get_supabase()
        if not sb:
            return {}

        now = datetime.now(timezone.utc)
        month_year = now.strftime("%Y-%m")

        try:
            result = (
                sb.table("usage_tracking")
                .select("feature")
                .eq("user_id", user_id)
                .eq("month_year", month_year)
                .execute()
            )
            counts: dict[str, int] = {}
            for row in result.data or []:
                feat = row.get("feature", "")
                counts[feat] = counts.get(feat, 0) + 1
            return counts
        except Exception:
            return {}


# Global singleton
permissions = PermissionEngine()


# ── FastAPI dependency ──

def require_feature(feature: str):
    """
    FastAPI dependency factory for granular feature enforcement.
    On success: tracks usage.
    On failure: raises 403 with Hebrew message + upgrade info.
    """
    from routers._auth_helper import require_auth

    async def _guard(request: Request, auth_user_id: str = Depends(require_auth)):
        result = permissions.can_use(auth_user_id, feature)

        if not result["allowed"]:
            from config.plans import FEATURE_NAMES_HE
            feature_name = FEATURE_NAMES_HE.get(feature, feature)

            detail = {
                "error": "plan_feature_unavailable",
                "feature": feature,
                "message_he": (
                    f"\u05d4\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05e9\u05dc\u05da \u05dc\u05d0 \u05db\u05d5\u05dc\u05dc\u05ea {feature_name}. "
                    f"\u05e9\u05d3\u05e8\u05d2\u05d5 \u05db\u05d3\u05d9 \u05dc\u05d4\u05e9\u05ea\u05de\u05e9 \u05d1\u05ea\u05db\u05d5\u05e0\u05d4 \u05d6\u05d5."
                ),
                "upgrade_url": "/dashboard/billing",
            }

            if result.get("used") is not None and result.get("limit") is not None:
                detail["used"] = result["used"]
                detail["limit"] = result["limit"]
                detail["message_he"] = (
                    f"\u05d4\u05d2\u05e2\u05ea \u05dc\u05de\u05d2\u05d1\u05dc\u05ea {feature_name} \u05d1\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05e9\u05dc\u05da "
                    f"({result['used']}/{result['limit']}). "
                    f"\u05e9\u05d3\u05e8\u05d2\u05d5 \u05dc\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d2\u05d1\u05d5\u05d4\u05d4 \u05d9\u05d5\u05ea\u05e8."
                )

            if result.get("upgrade_to"):
                detail["upgrade_to"] = result["upgrade_to"]
                detail["upgrade_name"] = result["upgrade_name"]
                detail["upgrade_price"] = result["upgrade_price"]

            raise HTTPException(status_code=403, detail=detail)

        # Track usage for count-based features
        limit = result.get("limit")
        if isinstance(limit, int) and limit != 0:
            permissions.track_usage(auth_user_id, feature)

    return _guard
