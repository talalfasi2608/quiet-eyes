"""
Plan Feature Enforcer for Quiet Eyes.

Complements credit_guard.py by enforcing feature-based plan limits
(e.g., max competitors, AI reports access) rather than just credit counts.

Usage as a FastAPI dependency:
    from middleware.plan_enforcer import require_plan_feature

    @router.post("/competitors/add/{business_id}")
    async def add_competitor(
        business_id: str,
        auth_user_id: str = Depends(require_auth),
        _=Depends(require_plan_feature("max_competitors")),
    ):
        ...
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, Request, Depends

logger = logging.getLogger(__name__)


# =============================================================================
# PLAN FEATURE LIMITS
# =============================================================================

PLAN_FEATURES = {
    "free": {
        "max_competitors": 1,
        "lead_scans_per_month": 5,
        "cities": 1,
        "ai_reports": False,
        "whatsapp_alerts": False,
        "team_members": 1,
        "automation": False,
        "api_access": False,
    },
    "starter": {
        "max_competitors": 3,
        "lead_scans_per_month": 30,
        "cities": 1,
        "ai_reports": True,
        "whatsapp_alerts": False,
        "team_members": 1,
        "automation": False,
        "api_access": False,
    },
    "pro": {
        "max_competitors": 10,
        "lead_scans_per_month": 200,
        "cities": 3,
        "ai_reports": True,
        "whatsapp_alerts": True,
        "team_members": 3,
        "automation": True,
        "api_access": False,
    },
    "business": {
        "max_competitors": 999,
        "lead_scans_per_month": 9999,
        "cities": 999,
        "ai_reports": True,
        "whatsapp_alerts": True,
        "team_members": 999,
        "automation": True,
        "api_access": True,
    },
    # Backward compat aliases
    "basic": {
        "max_competitors": 3,
        "lead_scans_per_month": 30,
        "cities": 1,
        "ai_reports": True,
        "whatsapp_alerts": False,
        "team_members": 1,
        "automation": False,
        "api_access": False,
    },
    "elite": {
        "max_competitors": 999,
        "lead_scans_per_month": 9999,
        "cities": 999,
        "ai_reports": True,
        "whatsapp_alerts": True,
        "team_members": 999,
        "automation": True,
        "api_access": True,
    },
}

# Hebrew feature names for error messages
FEATURE_NAMES_HE = {
    "max_competitors": "מתחרים",
    "lead_scans_per_month": "סריקות לידים",
    "cities": "ערים",
    "ai_reports": "דוחות AI",
    "whatsapp_alerts": "התראות WhatsApp",
    "team_members": "חברי צוות",
    "automation": "אוטומציות",
    "api_access": "גישת API",
}


# =============================================================================
# HELPERS
# =============================================================================

def _get_supabase():
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


def _get_user_plan(user_id: str) -> str:
    """Get the plan_id for a user from the subscriptions table."""
    supabase = _get_supabase()
    if not supabase:
        return "free"

    try:
        result = (
            supabase.table("subscriptions")
            .select("plan_id, tier")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data and result.data[0]:
            return result.data[0].get("plan_id") or result.data[0].get("tier", "free")
    except Exception:
        pass
    return "free"


# =============================================================================
# FEATURE USAGE TRACKING
# =============================================================================

def get_feature_usage(user_id: str, feature: str) -> int:
    """
    Get the current month's usage count for a feature from usage_tracking table.
    """
    supabase = _get_supabase()
    if not supabase:
        return 0

    now = datetime.now(timezone.utc)
    month_year = now.strftime("%Y-%m")

    try:
        result = (
            supabase.table("usage_tracking")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("feature", feature)
            .eq("month_year", month_year)
            .execute()
        )
        return result.count or 0
    except Exception:
        return 0


def record_feature_usage(user_id: str, feature: str, business_id: Optional[str] = None):
    """Record a feature usage event."""
    supabase = _get_supabase()
    if not supabase:
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

        supabase.table("usage_tracking").insert(row).execute()
    except Exception as e:
        logger.debug(f"Usage tracking insert failed: {e}")


# =============================================================================
# FEATURE CHECK
# =============================================================================

def check_plan_feature(user_id: str, feature: str) -> dict:
    """
    Check if a user's plan allows a feature.

    For boolean features (ai_reports, whatsapp_alerts, etc.):
        Returns {"allowed": True/False}

    For numeric features (max_competitors, lead_scans_per_month, etc.):
        Checks current usage against the plan limit.
        Returns {"allowed": bool, "current": int, "limit": int}
    """
    plan_id = _get_user_plan(user_id)
    features = PLAN_FEATURES.get(plan_id, PLAN_FEATURES["free"])
    limit = features.get(feature)

    if limit is None:
        # Unknown feature → allow by default
        return {"allowed": True}

    # Boolean feature
    if isinstance(limit, bool):
        return {"allowed": limit, "plan_id": plan_id}

    # Numeric feature — check usage
    current = get_feature_usage(user_id, feature)
    return {
        "allowed": current < limit,
        "current": current,
        "limit": limit,
        "plan_id": plan_id,
    }


# =============================================================================
# FASTAPI DEPENDENCY FACTORY
# =============================================================================

def require_plan_feature(feature: str):
    """
    FastAPI dependency factory for plan feature enforcement.
    Returns 403 with Hebrew message + upgrade_url if feature not available.

    Usage:
        @router.post("/some-endpoint")
        async def endpoint(
            auth_user_id: str = Depends(require_auth),
            _=Depends(require_plan_feature("ai_reports")),
        ):
            ...
    """
    from routers._auth_helper import require_auth

    async def _guard(request: Request, auth_user_id: str = Depends(require_auth)):
        result = check_plan_feature(auth_user_id, feature)

        if not result["allowed"]:
            feature_name = FEATURE_NAMES_HE.get(feature, feature)
            plan_id = result.get("plan_id", "free")

            detail = {
                "error": "plan_feature_unavailable",
                "feature": feature,
                "message": f"Your {plan_id} plan does not include {feature}. Please upgrade.",
                "message_he": f"התוכנית שלך ({plan_id}) לא כוללת {feature_name}. שדרגו כדי להשתמש בתכונה זו.",
                "upgrade_url": "/dashboard/billing",
            }

            if "limit" in result:
                detail["current"] = result["current"]
                detail["limit"] = result["limit"]
                detail["message_he"] = (
                    f"הגעת למגבלת {feature_name} בתוכנית שלך "
                    f"({result['current']}/{result['limit']}). שדרגו לתוכנית גבוהה יותר."
                )

            raise HTTPException(status_code=403, detail=detail)

    return _guard
