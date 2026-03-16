"""Billing — Stripe checkout, webhook, subscription management, usage."""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_permission
from app.models import AuditLog, Org, Permission, PlanTier, Subscription, SubscriptionStatus, User
from app.cost_tracker import AI_CALL_LIMITS
from app.quota import PLAN_LIMITS, get_month_usage, get_org_plan, get_today_usage
from app.schemas import CheckoutOut, CheckoutRequest, SubscriptionOut, UsageOut

router = APIRouter(tags=["billing"])

# Stripe price IDs — configure via env
PLAN_PRICE_IDS: dict[PlanTier, str] = {
    PlanTier.STARTER: os.environ.get("STRIPE_PRICE_STARTER", "price_starter_placeholder"),
    PlanTier.PRO: os.environ.get("STRIPE_PRICE_PRO", "price_pro_placeholder"),
    PlanTier.PREMIUM: os.environ.get("STRIPE_PRICE_PREMIUM", "price_premium_placeholder"),
}


def _get_stripe():
    """Lazy-import stripe so it's only required when actually used."""
    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        return stripe
    except ImportError:
        raise HTTPException(status_code=501, detail="Stripe SDK not installed")


# ── Current subscription ──


@router.get("/billing/subscription", response_model=SubscriptionOut)
def get_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Subscription)
        .filter(Subscription.org_id == user.org_id)
        .first()
    )
    if not sub:
        # Create default STARTER subscription
        sub = Subscription(org_id=user.org_id, plan=PlanTier.STARTER)
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


# ── Usage ──


@router.get("/billing/usage", response_model=UsageOut)
def get_usage(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = get_org_plan(db, user.org_id)
    limits = PLAN_LIMITS[plan]
    today = get_today_usage(db, user.org_id)
    month = get_month_usage(db, user.org_id)

    return UsageOut(
        scans_count=today.scans_count,
        chat_tokens=today.chat_tokens,
        exports_count=month["exports_count"],
        approvals_count=month["approvals_count"],
        ai_calls_count=today.ai_calls_count,
        ingestion_count=today.ingestion_count,
        estimated_cost_usd=round(today.estimated_cost_usd, 4),
        scans_limit=limits["scans_per_day"],
        chat_limit=limits["chat_per_day"],
        exports_limit=limits["exports_per_month"],
        approvals_limit=limits["approvals_per_month"],
        ai_calls_limit=AI_CALL_LIMITS.get(plan, 50),
        plan=plan,
    )


# ── Checkout ──


@router.post("/billing/checkout", response_model=CheckoutOut)
def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(require_permission(Permission.MANAGE_BILLING)),
    db: Session = Depends(get_db),
):
    if not settings.STRIPE_SECRET_KEY:
        # Stub mode: return a fake checkout URL
        return CheckoutOut(checkout_url=f"/billing?stub_plan={body.plan.value}")

    stripe = _get_stripe()
    price_id = PLAN_PRICE_IDS.get(body.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # Get or create Stripe customer
    sub = db.query(Subscription).filter(Subscription.org_id == user.org_id).first()
    customer_id = sub.stripe_customer_id if sub else None

    if not customer_id:
        customer = stripe.Customer.create(email=user.email, metadata={"org_id": str(user.org_id)})
        customer_id = customer.id
        if sub:
            sub.stripe_customer_id = customer_id
        else:
            sub = Subscription(
                org_id=user.org_id,
                plan=PlanTier.STARTER,
                stripe_customer_id=customer_id,
            )
            db.add(sub)
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"org_id": str(user.org_id), "plan": body.plan.value},
    )

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="BILLING_CHECKOUT_CREATED",
        entity_type="subscription",
        entity_id=sub.id if sub else None,
        meta={"plan": body.plan.value},
    ))
    db.commit()

    return CheckoutOut(checkout_url=session.url)


# ── Webhook ──


@router.post("/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.STRIPE_SECRET_KEY:
        return {"status": "stub_mode"}

    stripe = _get_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type in (
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _handle_subscription_event(db, event_type, data)

    return {"status": "ok"}


def _handle_subscription_event(db: Session, event_type: str, data: dict) -> None:
    """Update subscription status based on Stripe webhook events."""
    customer_id = data.get("customer")
    if not customer_id:
        return

    sub = (
        db.query(Subscription)
        .filter(Subscription.stripe_customer_id == customer_id)
        .first()
    )
    if not sub:
        return

    if event_type == "checkout.session.completed":
        # Session completed — update plan from metadata
        metadata = data.get("metadata", {})
        plan_str = metadata.get("plan", "STARTER")
        try:
            sub.plan = PlanTier(plan_str)
        except ValueError:
            sub.plan = PlanTier.STARTER
        stripe_sub_id = data.get("subscription")
        if stripe_sub_id:
            sub.stripe_subscription_id = stripe_sub_id
        sub.status = SubscriptionStatus.ACTIVE

    elif event_type == "customer.subscription.updated":
        status = data.get("status", "")
        if status == "active":
            sub.status = SubscriptionStatus.ACTIVE
        elif status == "past_due":
            sub.status = SubscriptionStatus.PAST_DUE
        elif status in ("canceled", "unpaid"):
            sub.status = SubscriptionStatus.CANCELED

        period_end = data.get("current_period_end")
        if period_end:
            sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

    elif event_type == "customer.subscription.deleted":
        sub.status = SubscriptionStatus.CANCELED
        sub.plan = PlanTier.STARTER

    db.add(AuditLog(
        org_id=sub.org_id,
        user_id=None,
        event_type="BILLING_SUBSCRIPTION_CHANGED",
        entity_type="subscription",
        entity_id=sub.id,
        meta={"stripe_event": event_type, "plan": sub.plan.value, "status": sub.status.value},
    ))

    db.commit()
