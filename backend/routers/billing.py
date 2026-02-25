"""
Billing Router.

GET /billing/status — returns subscription tier, credits, and status.
Uses the user's JWT to identify the user and look up their subscription.
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["Billing"])


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


@router.get("/status")
async def billing_status(request: Request, auth_user_id: str = Depends(require_auth)):
    """Return subscription tier and credit balance for the authenticated user."""
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Try to find subscription for this user
    try:
        result = (
            supabase.table("subscriptions")
            .select("*")
            .eq("user_id", auth_user_id)
            .execute()
        )
        if result.data and len(result.data) > 0:
            sub = result.data[0]
            return {
                "tier": sub.get("tier", "free"),
                "tier_name": sub.get("tier_name", "Free"),
                "credits_remaining": sub.get("credits_remaining", 10),
                "credits_monthly_limit": sub.get("credits_monthly_limit", 10),
                "credits_reset_at": sub.get("credits_reset_at"),
                "status": sub.get("status", "active"),
                "has_stripe": sub.get("has_stripe", False),
            }
    except Exception as e:
        logger.debug(f"Subscription lookup failed: {e}")

    # Default free tier
    return {
        "tier": "free",
        "tier_name": "Free",
        "credits_remaining": 10,
        "credits_monthly_limit": 10,
        "credits_reset_at": None,
        "status": "active",
        "has_stripe": False,
    }
