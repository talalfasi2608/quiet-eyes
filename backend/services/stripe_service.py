"""
Stripe Payment Service for Quiet Eyes.

Handles Stripe Checkout, Portal, Webhooks, and subscription management.
Uses ILS currency with Hebrew locale for Israeli market.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import stripe

from config.plans import PLANS

logger = logging.getLogger(__name__)

# ── Stripe config ──
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Maps plan_id + billing_interval → Stripe Price ID.
# Populated by setup_stripe_products() or set manually.
STRIPE_PRICE_MAP: dict[str, str] = {}


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


# =============================================================================
# PRODUCT / PRICE SETUP (one-time)
# =============================================================================

def setup_stripe_products() -> dict:
    """
    Create Stripe Products and Prices for each paid plan.
    Run once to bootstrap. Returns the STRIPE_PRICE_MAP.
    """
    global STRIPE_PRICE_MAP

    for plan_id, plan in PLANS.items():
        if plan["price_monthly"] == 0:
            continue

        # Create or find product
        product = stripe.Product.create(
            name=f"QuietEyes {plan['name']}",
            metadata={"plan_id": plan_id},
        )

        # Monthly price
        monthly_price = stripe.Price.create(
            product=product.id,
            unit_amount=plan["price_monthly"] * 100,  # agorot
            currency="ils",
            recurring={"interval": "month"},
            metadata={"plan_id": plan_id, "interval": "monthly"},
        )
        STRIPE_PRICE_MAP[f"{plan_id}_monthly"] = monthly_price.id

        # Yearly price
        yearly_price = stripe.Price.create(
            product=product.id,
            unit_amount=plan["price_yearly"] * 100,  # agorot
            currency="ils",
            recurring={"interval": "year"},
            metadata={"plan_id": plan_id, "interval": "yearly"},
        )
        STRIPE_PRICE_MAP[f"{plan_id}_yearly"] = yearly_price.id

        logger.info(
            f"[Stripe] Created prices for {plan_id}: "
            f"monthly={monthly_price.id}, yearly={yearly_price.id}"
        )

    return STRIPE_PRICE_MAP


# =============================================================================
# CUSTOMER MANAGEMENT
# =============================================================================

def get_or_create_customer(user_id: str, email: str) -> Optional[str]:
    """
    Get existing Stripe customer ID from subscriptions table,
    or create a new one and store it.
    """
    supabase = _get_supabase()
    if not supabase:
        return None

    # Check for existing customer
    try:
        result = (
            supabase.table("subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data and result.data[0].get("stripe_customer_id"):
            return result.data[0]["stripe_customer_id"]
    except Exception as e:
        logger.debug(f"Customer lookup failed: {e}")

    # Create new Stripe customer
    try:
        customer = stripe.Customer.create(
            email=email,
            metadata={"user_id": user_id},
        )

        # Upsert into subscriptions
        supabase.table("subscriptions").upsert({
            "user_id": user_id,
            "stripe_customer_id": customer.id,
            "tier": "free",
            "plan_id": "free",
            "status": "active",
        }, on_conflict="user_id").execute()

        logger.info(f"[Stripe] Created customer {customer.id} for user {user_id}")
        return customer.id
    except Exception as e:
        logger.error(f"[Stripe] Customer creation failed: {e}")
        return None


# =============================================================================
# CHECKOUT SESSION
# =============================================================================

def create_checkout_session(
    customer_id: str,
    plan_id: str,
    billing: str,
    success_url: str,
    cancel_url: str,
    user_id: str,
) -> Optional[str]:
    """
    Create a Stripe Checkout Session for a subscription.
    Returns the checkout URL.
    """
    price_key = f"{plan_id}_{billing}"
    price_id = STRIPE_PRICE_MAP.get(price_key)

    if not price_id:
        logger.error(f"[Stripe] No price ID for {price_key}")
        return None

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            locale="he",
            currency="ils",
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={
                "trial_period_days": 14,
                "metadata": {
                    "user_id": user_id,
                    "plan_id": plan_id,
                    "billing": billing,
                },
            },
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "plan_id": plan_id,
            },
        )
        logger.info(f"[Stripe] Checkout session created: {session.id}")
        return session.url
    except Exception as e:
        logger.error(f"[Stripe] Checkout creation failed: {e}")
        return None


# =============================================================================
# BILLING PORTAL
# =============================================================================

def create_portal_session(customer_id: str, return_url: str) -> Optional[str]:
    """Create a Stripe Billing Portal session. Returns the portal URL."""
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
            locale="he",
        )
        return session.url
    except Exception as e:
        logger.error(f"[Stripe] Portal creation failed: {e}")
        return None


# =============================================================================
# WEBHOOK HANDLER
# =============================================================================

def handle_webhook_event(payload: bytes, sig_header: str) -> dict:
    """
    Verify Stripe webhook signature and process the event.
    Returns a dict with status and message.
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("[Stripe] Webhook signature verification failed")
        return {"status": "error", "message": "Invalid signature"}
    except Exception as e:
        logger.error(f"[Stripe] Webhook parsing error: {e}")
        return {"status": "error", "message": str(e)}

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info(f"[Stripe] Webhook received: {event_type}")

    supabase = _get_supabase()
    if not supabase:
        return {"status": "error", "message": "Database unavailable"}

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data, supabase)
    elif event_type == "invoice.payment_succeeded":
        _handle_payment_succeeded(data, supabase)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data, supabase)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data, supabase)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data, supabase)
    else:
        logger.debug(f"[Stripe] Unhandled event type: {event_type}")

    return {"status": "ok", "event_type": event_type}


def _handle_checkout_completed(session_data: dict, supabase):
    """User completed checkout — activate their subscription."""
    user_id = session_data.get("metadata", {}).get("user_id")
    plan_id = session_data.get("metadata", {}).get("plan_id")
    subscription_id = session_data.get("subscription")
    customer_id = session_data.get("customer")

    if not user_id or not plan_id:
        logger.warning("[Stripe] checkout.session.completed missing metadata")
        return

    plan = PLANS.get(plan_id, PLANS["free"])
    now = datetime.now(timezone.utc).isoformat()

    try:
        supabase.table("subscriptions").upsert({
            "user_id": user_id,
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
            "plan_id": plan_id,
            "tier": plan_id,
            "tier_name": plan["name_he"],
            "credits_remaining": plan["credits"],
            "credits_monthly_limit": plan["credits"],
            "credits_used": 0,
            "status": "active",
            "has_stripe": True,
            "plan_started_at": now,
        }, on_conflict="user_id").execute()
        logger.info(f"[Stripe] Activated {plan_id} for user {user_id}")
    except Exception as e:
        logger.error(f"[Stripe] checkout.session.completed update failed: {e}")


def _handle_payment_succeeded(invoice_data: dict, supabase):
    """Invoice paid — reset monthly credits."""
    customer_id = invoice_data.get("customer")
    subscription_id = invoice_data.get("subscription")

    if not customer_id:
        return

    try:
        result = (
            supabase.table("subscriptions")
            .select("user_id, plan_id")
            .eq("stripe_customer_id", customer_id)
            .execute()
        )
        if not result.data:
            return

        sub = result.data[0]
        plan_id = sub.get("plan_id", "free")
        plan = PLANS.get(plan_id, PLANS["free"])

        supabase.table("subscriptions").update({
            "credits_remaining": plan["credits"],
            "credits_used": 0,
            "status": "active",
            "credits_reset_at": datetime.now(timezone.utc).isoformat(),
        }).eq("stripe_customer_id", customer_id).execute()

        logger.info(f"[Stripe] Credits reset for customer {customer_id}")
    except Exception as e:
        logger.error(f"[Stripe] payment_succeeded update failed: {e}")


def _handle_payment_failed(invoice_data: dict, supabase):
    """Payment failed — mark as past_due."""
    customer_id = invoice_data.get("customer")
    if not customer_id:
        return

    try:
        supabase.table("subscriptions").update({
            "status": "past_due",
        }).eq("stripe_customer_id", customer_id).execute()
        logger.warning(f"[Stripe] Payment failed for customer {customer_id}")
    except Exception as e:
        logger.error(f"[Stripe] payment_failed update failed: {e}")


def _handle_subscription_updated(sub_data: dict, supabase):
    """Subscription changed (plan upgrade/downgrade)."""
    customer_id = sub_data.get("customer")
    status = sub_data.get("status")
    plan_id = sub_data.get("metadata", {}).get("plan_id")
    trial_end = sub_data.get("trial_end")

    if not customer_id:
        return

    update_data: dict = {"status": status or "active"}

    if plan_id and plan_id in PLANS:
        plan = PLANS[plan_id]
        update_data.update({
            "plan_id": plan_id,
            "tier": plan_id,
            "tier_name": plan["name_he"],
            "credits_monthly_limit": plan["credits"],
        })

    if trial_end:
        update_data["trial_ends_at"] = datetime.fromtimestamp(
            trial_end, tz=timezone.utc
        ).isoformat()

    # Get price to determine billing interval
    items = sub_data.get("items", {}).get("data", [])
    if items:
        price = items[0].get("price", {})
        interval = price.get("recurring", {}).get("interval")
        if interval:
            update_data["billing_interval"] = "yearly" if interval == "year" else "monthly"
        update_data["stripe_price_id"] = price.get("id")

    try:
        supabase.table("subscriptions").update(
            update_data
        ).eq("stripe_customer_id", customer_id).execute()
        logger.info(f"[Stripe] Subscription updated for customer {customer_id}")
    except Exception as e:
        logger.error(f"[Stripe] subscription_updated failed: {e}")


def _handle_subscription_deleted(sub_data: dict, supabase):
    """Subscription canceled — downgrade to free."""
    customer_id = sub_data.get("customer")
    if not customer_id:
        return

    free_plan = PLANS["free"]
    try:
        supabase.table("subscriptions").update({
            "plan_id": "free",
            "tier": "free",
            "tier_name": free_plan["name_he"],
            "credits_remaining": free_plan["credits"],
            "credits_monthly_limit": free_plan["credits"],
            "credits_used": 0,
            "status": "active",
            "has_stripe": False,
            "stripe_subscription_id": None,
            "stripe_price_id": None,
            "billing_interval": "monthly",
            "trial_ends_at": None,
        }).eq("stripe_customer_id", customer_id).execute()
        logger.info(f"[Stripe] Downgraded to free for customer {customer_id}")
    except Exception as e:
        logger.error(f"[Stripe] subscription_deleted failed: {e}")


# =============================================================================
# REVENUE METRICS
# =============================================================================

def get_revenue_metrics() -> dict:
    """
    Pull subscription data and calculate revenue metrics.
    Returns MRR, ARR, active count, trial count.
    """
    supabase = _get_supabase()
    if not supabase:
        return {"mrr": 0, "arr": 0, "active": 0, "trials": 0}

    try:
        result = (
            supabase.table("subscriptions")
            .select("plan_id, billing_interval, status, trial_ends_at")
            .neq("plan_id", "free")
            .execute()
        )
        if not result.data:
            return {"mrr": 0, "arr": 0, "active": 0, "trials": 0}

        mrr = 0
        active = 0
        trials = 0
        now = datetime.now(timezone.utc)

        for sub in result.data:
            plan = PLANS.get(sub.get("plan_id"), None)
            if not plan:
                continue

            if sub.get("status") not in ("active", "trialing"):
                continue

            # Check if in trial
            trial_end = sub.get("trial_ends_at")
            if trial_end:
                try:
                    trial_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
                    if trial_dt > now:
                        trials += 1
                        continue  # Don't count trial revenue
                except (ValueError, TypeError):
                    pass

            active += 1
            interval = sub.get("billing_interval", "monthly")
            if interval == "yearly":
                mrr += plan["price_yearly"] / 12
            else:
                mrr += plan["price_monthly"]

        return {
            "mrr": round(mrr),
            "arr": round(mrr * 12),
            "active": active,
            "trials": trials,
        }
    except Exception as e:
        logger.error(f"[Stripe] Revenue metrics failed: {e}")
        return {"mrr": 0, "arr": 0, "active": 0, "trials": 0}
