"""
Billing Router.

Endpoints:
  GET  /billing/status      — subscription tier, credits, plan details
  GET  /billing/tiers       — available plans with ILS prices
  GET  /billing/permissions  — user's plan limits + current usage (for frontend usePlan hook)
  POST /billing/checkout    — create Stripe checkout session
  POST /billing/portal      — create Stripe billing portal session
  POST /billing/webhook     — Stripe webhook handler (no auth)
  GET  /billing/usage       — credit usage history
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from routers._auth_helper import require_auth, get_supabase_client
from config.plans import PLANS, PLAN_ORDER

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


# =============================================================================
# GET /billing/status
# =============================================================================

@router.get("/status")
async def billing_status(request: Request, auth_user_id: str = Depends(require_auth)):
    """Return subscription tier, credit balance, and plan details for the authenticated user."""
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

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
                "plan_id": sub.get("plan_id", "free"),
                "billing_interval": sub.get("billing_interval", "monthly"),
                "trial_ends_at": sub.get("trial_ends_at"),
            }
    except Exception as e:
        logger.debug(f"Subscription lookup failed: {e}")

    return {
        "tier": "free",
        "tier_name": "Free",
        "credits_remaining": 10,
        "credits_monthly_limit": 10,
        "credits_reset_at": None,
        "status": "active",
        "has_stripe": False,
        "plan_id": "free",
        "billing_interval": "monthly",
        "trial_ends_at": None,
    }


# =============================================================================
# GET /billing/tiers
# =============================================================================

@router.get("/tiers")
async def billing_tiers():
    """Return available plan definitions with ILS prices and features."""
    from services.credit_guard import CreditCost

    tiers = []
    for plan_id in PLAN_ORDER:
        plan = PLANS[plan_id]
        tiers.append({
            "id": plan_id,
            "name": plan["name"],
            "nameHe": plan["name_he"],
            "price": plan["price_monthly"],
            "price_monthly": plan["price_monthly"],
            "price_yearly": plan["price_yearly"],
            "credits": plan["credits"],
            "features": plan.get("features_list", []),
            "badge": plan.get("badge"),
        })

    return {
        "tiers": tiers,
        "credit_costs": {
            "lead_snipe": CreditCost.LEAD_SNIPE,
            "competitor_scan": CreditCost.COMPETITOR_SCAN,
            "market_discovery": CreditCost.MARKET_DISCOVERY,
            "ai_analysis": CreditCost.AI_ANALYSIS,
            "pdf_report": CreditCost.PDF_REPORT,
        },
    }


# =============================================================================
# GET /billing/permissions
# =============================================================================

@router.get("/permissions")
async def billing_permissions(request: Request, auth_user_id: str = Depends(require_auth)):
    """Return user's plan limits + current usage counts for all features (for frontend usePlan hook)."""
    from services.permission_engine import permissions

    plan = permissions.get_user_plan(auth_user_id)
    plan_id = permissions._get_plan_id(auth_user_id)
    limits = plan.get("limits", {})
    usage = permissions.get_all_usage(auth_user_id)

    return {
        "plan_id": plan_id,
        "plan_name": plan.get("name_he", ""),
        "limits": limits,
        "usage": usage,
    }


# =============================================================================
# POST /billing/checkout
# =============================================================================

class CheckoutRequest(BaseModel):
    tier: str
    billing: str = "monthly"
    success_url: str
    cancel_url: str


@router.post("/checkout")
async def billing_checkout(
    payload: CheckoutRequest,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """Create a Stripe Checkout Session for subscription."""
    from services.stripe_service import (
        STRIPE_PRICE_MAP,
        get_or_create_customer, create_checkout_session,
    )

    if payload.tier not in PLANS or payload.tier == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    if payload.billing not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="Invalid billing interval")

    # Check if Stripe is configured
    if not os.getenv("STRIPE_SECRET_KEY"):
        raise HTTPException(status_code=503, detail="Stripe not configured")

    price_key = f"{payload.tier}_{payload.billing}"
    if not STRIPE_PRICE_MAP.get(price_key):
        raise HTTPException(
            status_code=503,
            detail="Stripe prices not initialized. Run setup_stripe_products() first.",
        )

    # Get user email from Supabase
    email = None
    try:
        supabase = _get_service_client()
        if supabase:
            user_resp = supabase.auth.admin.get_user_by_id(auth_user_id)
            if user_resp and user_resp.user:
                email = user_resp.user.email
    except Exception:
        pass
    email = email or f"{auth_user_id}@quieteyes.app"

    customer_id = get_or_create_customer(auth_user_id, email)
    if not customer_id:
        raise HTTPException(status_code=500, detail="Failed to create customer")

    url = create_checkout_session(
        customer_id=customer_id,
        plan_id=payload.tier,
        billing=payload.billing,
        success_url=payload.success_url,
        cancel_url=payload.cancel_url,
        user_id=auth_user_id,
    )

    if not url:
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

    return {"url": url, "message": "Checkout session created"}


# =============================================================================
# POST /billing/portal
# =============================================================================

class PortalRequest(BaseModel):
    return_url: str


@router.post("/portal")
async def billing_portal(
    payload: PortalRequest,
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """Create a Stripe Billing Portal session for the authenticated user."""
    from services.stripe_service import create_portal_session

    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Get customer ID
    try:
        result = (
            supabase.table("subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", auth_user_id)
            .execute()
        )
        customer_id = (result.data[0] if result.data else {}).get("stripe_customer_id")
    except Exception:
        customer_id = None

    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")

    url = create_portal_session(customer_id, payload.return_url)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to create portal session")

    return {"url": url, "message": "Portal session created"}


# =============================================================================
# POST /billing/webhook  (NO AUTH — Stripe signature verification only)
# =============================================================================

@router.post("/webhook")
async def billing_webhook(request: Request):
    """Handle Stripe webhook events. No JWT auth — uses Stripe signature."""
    from services.stripe_service import handle_webhook_event

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    result = handle_webhook_event(payload, sig_header)

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    return result


# =============================================================================
# GET /billing/usage
# =============================================================================

@router.get("/usage")
async def billing_usage(
    request: Request,
    auth_user_id: str = Depends(require_auth),
):
    """Return credit usage history for the authenticated user."""
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        return {"usage": []}

    try:
        result = (
            supabase.table("credit_logs")
            .select("id, action, credits_used, endpoint, created_at")
            .eq("user_id", auth_user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return {"usage": result.data or []}
    except Exception:
        # credit_logs table might not exist yet — return empty
        return {"usage": []}


# =============================================================================
# GET /billing/trial-status
# =============================================================================

@router.get("/trial-status")
async def trial_status(request: Request, auth_user_id: str = Depends(require_auth)):
    """Return detailed trial status with stats for the upgrade page."""
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        return {"in_trial": False, "days_remaining": 0}

    # Get subscription
    trial_ends_at = None
    tier = "free"
    try:
        sub = (
            supabase.table("subscriptions")
            .select("tier, trial_ends_at, trial_touchpoints_sent")
            .eq("user_id", auth_user_id)
            .maybe_single()
            .execute()
        )
        if sub.data:
            trial_ends_at = sub.data.get("trial_ends_at")
            tier = sub.data.get("tier", "free")
    except Exception:
        pass

    # Get business
    biz_id = None
    biz_name = ""
    created_at = None
    try:
        biz = (
            supabase.table("businesses")
            .select("id, business_name, created_at")
            .eq("user_id", auth_user_id)
            .maybe_single()
            .execute()
        )
        if biz.data:
            biz_id = biz.data["id"]
            biz_name = biz.data.get("business_name", "")
            created_at = biz.data.get("created_at")
    except Exception:
        pass

    # Calculate trial days
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)

    if trial_ends_at:
        try:
            trial_end = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
        except Exception:
            trial_end = now
    elif created_at:
        try:
            created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            trial_end = created_dt + timedelta(days=14)
        except Exception:
            trial_end = now
    else:
        trial_end = now

    days_remaining = max(0, (trial_end - now).days)
    in_trial = days_remaining > 0 and tier == "free"
    expired = days_remaining == 0 and tier == "free"

    # Get stats if business exists
    stats = {}
    if biz_id:
        try:
            from services.trial_conversion import get_trial_conversion
            stats = get_trial_conversion()._get_trial_stats(biz_id, supabase)
        except Exception:
            pass

    return {
        "in_trial": in_trial,
        "expired": expired,
        "days_remaining": days_remaining,
        "trial_end": trial_end.isoformat(),
        "tier": tier,
        "business_name": biz_name,
        "stats": {
            "leads_found": stats.get("leads_count", 0),
            "competitors_tracked": stats.get("competitors_count", 0),
            "competitor_changes": stats.get("competitor_changes", 0),
            "alerts_sent": stats.get("alerts_sent", 0),
            "health_score": stats.get("health_score", 65),
        },
    }
