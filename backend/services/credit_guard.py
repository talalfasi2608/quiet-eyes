"""
API Credit Guard for Quiet Eyes.

Pre-check before any AI/Scraping task to ensure the workspace has enough
credits. If not, returns a 402 with an upgrade message.

Usage as a FastAPI dependency:
    from services.credit_guard import require_credits, CreditCost

    @router.post("/leads/snipe/{business_id}")
    async def snipe(business_id: str, _=Depends(require_credits(CreditCost.LEAD_SNIPE))):
        ...

Usage as a direct function call (from GlobalRadar / background jobs):
    from services.credit_guard import check_and_deduct_credits

    ok = check_and_deduct_credits(business_id, CreditCost.LEAD_SNIPE, "lead_snipe")
    if not ok:
        return  # insufficient credits
"""

import logging
from fastapi import HTTPException
from typing import Optional

from services.system_logger import get_system_logger

logger = logging.getLogger(__name__)


# =============================================================================
# CREDIT COST TABLE
# =============================================================================

class CreditCost:
    """Credit costs for each operation type."""
    LEAD_SNIPE = 2
    COMPETITOR_SCAN = 1
    MARKET_DISCOVERY = 1
    AI_ANALYSIS = 1
    PDF_REPORT = 1
    CRM_PUSH = 0       # Free — already paid for the lead
    WHATSAPP_ALERT = 0  # Free — notification only


# =============================================================================
# TIER CREDIT LIMITS (monthly)
# =============================================================================

TIER_LIMITS = {
    "free": 10,
    "basic": 100,
    "pro": 500,
    "elite": 5000,
}


# =============================================================================
# CORE LOGIC
# =============================================================================

def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _get_workspace_for_business(business_id: str, supabase) -> Optional[str]:
    """Look up the workspace_id for a business."""
    try:
        biz = (
            supabase.table("businesses")
            .select("workspace_id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        return (biz.data or {}).get("workspace_id")
    except Exception:
        return None


def _get_subscription(workspace_id: str, supabase) -> Optional[dict]:
    """Fetch the subscription row for a workspace."""
    try:
        sub = (
            supabase.table("subscriptions")
            .select("id, tier, credits_remaining, credits_used, credits_monthly_limit")
            .eq("workspace_id", workspace_id)
            .maybe_single()
            .execute()
        )
        return sub.data
    except Exception:
        return None


def check_credits(business_id: str, cost: int) -> dict:
    """
    Check if a business's workspace has enough credits.

    Returns:
        {
            "allowed": bool,
            "credits_remaining": int,
            "tier": str,
            "workspace_id": str | None,
        }
    """
    supabase = _get_supabase()
    if not supabase:
        # If DB is unavailable, allow the operation (fail-open for dev)
        return {"allowed": True, "credits_remaining": -1, "tier": "unknown", "workspace_id": None}

    workspace_id = _get_workspace_for_business(business_id, supabase)
    if not workspace_id:
        return {"allowed": True, "credits_remaining": -1, "tier": "unknown", "workspace_id": None}

    sub = _get_subscription(workspace_id, supabase)
    if not sub:
        # No subscription row → treat as free tier with default credits
        return {"allowed": cost <= TIER_LIMITS["free"], "credits_remaining": TIER_LIMITS["free"], "tier": "free", "workspace_id": workspace_id}

    remaining = sub.get("credits_remaining", 0)
    tier = sub.get("tier", "free")

    return {
        "allowed": remaining >= cost,
        "credits_remaining": remaining,
        "tier": tier,
        "workspace_id": workspace_id,
    }


def deduct_credits(workspace_id: str, cost: int, operation: str) -> bool:
    """
    Deduct credits from a workspace's subscription.
    Returns True on success, False on failure.
    """
    if cost <= 0:
        return True

    supabase = _get_supabase()
    if not supabase or not workspace_id:
        return True  # fail-open

    try:
        sub = _get_subscription(workspace_id, supabase)
        if not sub:
            return False

        new_remaining = max(0, (sub.get("credits_remaining", 0)) - cost)
        new_used = (sub.get("credits_used", 0)) + cost

        supabase.table("subscriptions").update({
            "credits_remaining": new_remaining,
            "credits_used": new_used,
        }).eq("id", sub["id"]).execute()

        logger.info(
            f"[CreditGuard] Deducted {cost} credits for {operation} "
            f"(workspace {workspace_id}): {new_remaining} remaining"
        )
        return True
    except Exception as e:
        logger.error(f"[CreditGuard] Deduction failed: {e}")
        return False


def check_and_deduct_credits(
    business_id: str, cost: int, operation: str
) -> bool:
    """
    Combined check + deduct for background jobs (non-HTTP context).
    Returns True if credits were sufficient and deducted.
    Logs to system_logs if insufficient.
    """
    if cost <= 0:
        return True

    result = check_credits(business_id, cost)

    if not result["allowed"]:
        sys_logger = get_system_logger()
        sys_logger.log(
            "warning",
            "credit_guard",
            f"Insufficient credits for {operation}",
            details={
                "business_id": business_id,
                "workspace_id": result["workspace_id"],
                "credits_remaining": result["credits_remaining"],
                "credits_required": cost,
                "tier": result["tier"],
            },
            notify_admin=False,
        )
        logger.warning(
            f"[CreditGuard] Insufficient credits for {operation} "
            f"(business {business_id}): {result['credits_remaining']} < {cost}"
        )
        return False

    return deduct_credits(result["workspace_id"], cost, operation)


# =============================================================================
# FASTAPI DEPENDENCY FACTORY
# =============================================================================

def require_credits(cost: int, operation: str = "api_call"):
    """
    FastAPI dependency factory. Returns a dependency function that
    checks credits before the endpoint runs.

    Usage:
        @router.post("/leads/snipe/{business_id}")
        async def snipe(
            business_id: str,
            _=Depends(require_credits(CreditCost.LEAD_SNIPE, "lead_snipe"))
        ):
            ...

    For endpoints where business_id is in the request body instead of the path,
    use check_and_deduct_credits() directly inside the endpoint.
    """

    async def _guard(business_id: str) -> None:
        if cost <= 0:
            return

        result = check_credits(business_id, cost)

        if not result["allowed"]:
            tier = result["tier"]
            remaining = result["credits_remaining"]

            sys_logger = get_system_logger()
            sys_logger.log(
                "warning",
                "credit_guard",
                f"API credit limit reached for {operation}",
                details={
                    "business_id": business_id,
                    "workspace_id": result["workspace_id"],
                    "credits_remaining": remaining,
                    "credits_required": cost,
                    "tier": tier,
                },
            )

            raise HTTPException(
                status_code=402,
                detail={
                    "error": "insufficient_credits",
                    "message": (
                        f"Not enough credits. You have {remaining} credits "
                        f"remaining on the {tier} plan. This operation requires "
                        f"{cost} credits."
                    ),
                    "message_he": (
                        f"אין מספיק קרדיטים. נותרו {remaining} קרדיטים "
                        f"בתוכנית {tier}. פעולה זו דורשת {cost} קרדיטים."
                    ),
                    "upgrade_url": "/dashboard/billing",
                    "credits_remaining": remaining,
                    "credits_required": cost,
                    "tier": tier,
                },
            )

        # Credits are sufficient — deduct them
        deduct_credits(result["workspace_id"], cost, operation)

    return _guard
