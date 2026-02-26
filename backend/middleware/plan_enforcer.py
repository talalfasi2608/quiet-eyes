"""
Plan Feature Enforcer for Quiet Eyes.

Thin backward-compatible wrapper around services.permission_engine.
Kept for backward compatibility with existing code that imports from here.

Usage as a FastAPI dependency:
    from middleware.plan_enforcer import require_plan_feature

    @router.post("/competitors/add/{business_id}")
    async def add_competitor(
        business_id: str,
        auth_user_id: str = Depends(require_auth),
        _=Depends(require_plan_feature("competitors_tracked")),
    ):
        ...
"""

import logging
from typing import Optional

from config.plans import PLANS, FEATURE_NAMES_HE
from services.permission_engine import permissions

logger = logging.getLogger(__name__)


# ── Backward-compatible exports ──

# Legacy mapping: old feature names → new feature names
_LEGACY_FEATURE_MAP = {
    "max_competitors": "competitors_tracked",
    "lead_scans_per_month": "leads_scans_per_month",
    "ai_reports": "weekly_report",
    "automation": "auto_review_response",
}


def _get_user_plan(user_id: str) -> str:
    """Get the plan_id for a user from the subscriptions table."""
    return permissions._get_plan_id(user_id)


def get_feature_usage(user_id: str, feature: str) -> int:
    """Get the current month's usage count for a feature."""
    mapped = _LEGACY_FEATURE_MAP.get(feature, feature)
    return permissions._get_usage(user_id, mapped)


def record_feature_usage(user_id: str, feature: str, business_id: Optional[str] = None):
    """Record a feature usage event."""
    mapped = _LEGACY_FEATURE_MAP.get(feature, feature)
    permissions.track_usage(user_id, mapped, business_id)


def check_plan_feature(user_id: str, feature: str) -> dict:
    """
    Check if a user's plan allows a feature.
    Delegates to permissions.can_use() with legacy result format.
    """
    mapped = _LEGACY_FEATURE_MAP.get(feature, feature)
    result = permissions.can_use(user_id, mapped)

    plan_id = permissions._get_plan_id(user_id)
    legacy = {
        "allowed": result["allowed"],
        "plan_id": plan_id,
    }
    if result.get("used") is not None:
        legacy["current"] = result["used"]
    if result.get("limit") is not None and isinstance(result["limit"], int):
        legacy["limit"] = result["limit"]

    return legacy


def require_plan_feature(feature: str):
    """
    FastAPI dependency factory for plan feature enforcement.
    Delegates to the permission engine's require_feature.
    """
    mapped = _LEGACY_FEATURE_MAP.get(feature, feature)

    from services.permission_engine import require_feature
    return require_feature(mapped)
