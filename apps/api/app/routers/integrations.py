import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user, require_permission
from app.models import (
    AuditLog,
    Business,
    Integration,
    IntegrationEvent,
    IntegrationEventStatus,
    IntegrationType,
    Lead,
    LeadStatus,
    Permission,
    User,
)
from app.schemas import (
    IntegrationCreateRequest,
    IntegrationEventOut,
    IntegrationOut,
    IntegrationTestOut,
    IntegrationUpdateRequest,
    MetaIntegrationCreateRequest,
    MetaIntegrationUpdateRequest,
)

router = APIRouter(tags=["integrations"])


# ── CRUD ──


@router.post(
    "/businesses/{business_id}/integrations",
    response_model=IntegrationOut,
    status_code=201,
)
def create_integration(
    body: IntegrationCreateRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    config = {
        "webhook_url": body.webhook_url,
    }
    if body.secret_header:
        config["secret_header"] = body.secret_header
    if body.secret_token:
        config["secret_token"] = body.secret_token

    integration = Integration(
        business_id=biz.id,
        type=IntegrationType.WEBHOOK,
        name=body.name,
        config=config,
        is_enabled=True,
    )
    db.add(integration)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="INTEGRATION_CREATED",
        entity_type="integration",
        entity_id=integration.id,
        meta={"name": body.name, "type": "WEBHOOK"},
    ))

    db.commit()
    db.refresh(integration)
    return integration


@router.get(
    "/businesses/{business_id}/integrations",
    response_model=list[IntegrationOut],
)
def list_integrations(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(Integration)
        .filter(Integration.business_id == biz.id)
        .order_by(Integration.created_at.desc())
        .all()
    )


@router.patch(
    "/integrations/{integration_id}",
    response_model=IntegrationOut,
)
def update_integration(
    integration_id: uuid.UUID,
    body: IntegrationUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    integ = db.get(Integration, integration_id)
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    biz = db.get(Business, integ.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    if body.name is not None:
        integ.name = body.name
    if body.is_enabled is not None:
        integ.is_enabled = body.is_enabled

    config = dict(integ.config or {})
    if body.webhook_url is not None:
        config["webhook_url"] = body.webhook_url
    if body.secret_header is not None:
        config["secret_header"] = body.secret_header
    if body.secret_token is not None:
        config["secret_token"] = body.secret_token
    integ.config = config

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="INTEGRATION_UPDATED",
        entity_type="integration",
        entity_id=integ.id,
        meta={"name": integ.name, "type": integ.type.value},
    ))

    db.commit()
    db.refresh(integ)
    return integ


@router.get(
    "/businesses/{business_id}/integration-events",
    response_model=list[IntegrationEventOut],
)
def list_integration_events(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(IntegrationEvent)
        .filter(IntegrationEvent.business_id == biz.id)
        .order_by(IntegrationEvent.created_at.desc())
        .limit(50)
        .all()
    )


# ── Test ──


@router.post(
    "/integrations/{integration_id}/test",
    response_model=IntegrationTestOut,
)
def test_integration(
    integration_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    integ = db.get(Integration, integration_id)
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    biz = db.get(Business, integ.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    config = integ.config or {}
    webhook_url = config.get("webhook_url")
    if not webhook_url:
        return IntegrationTestOut(success=False, error="No webhook URL configured")

    test_payload = _build_test_payload(biz)

    try:
        status_code = _post_webhook(config, test_payload)
        success = 200 <= status_code < 300
        return IntegrationTestOut(success=success, status_code=status_code)
    except Exception as e:
        return IntegrationTestOut(success=False, error=str(e))


# ── Retry ──


@router.post(
    "/integration-events/{event_id}/retry",
    response_model=IntegrationEventOut,
)
def retry_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event = db.get(IntegrationEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    biz = db.get(Business, event.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Event not found")

    integ = db.get(Integration, event.integration_id)
    if not integ or not integ.config:
        raise HTTPException(status_code=400, detail="Integration not configured")

    try:
        status_code = _post_webhook(integ.config, event.payload or {})
        if 200 <= status_code < 300:
            event.status = IntegrationEventStatus.SENT
            event.sent_at = datetime.now(timezone.utc)
            event.error_message = None
        else:
            event.status = IntegrationEventStatus.FAILED
            event.error_message = f"HTTP {status_code}"
    except Exception as e:
        event.status = IntegrationEventStatus.FAILED
        event.error_message = str(e)

    db.commit()
    db.refresh(event)
    return event


# ── Webhook execution (called from approval flow) ──


def _post_webhook(config: dict, payload: dict) -> int:
    """POST payload to webhook URL. Returns HTTP status code."""
    webhook_url = config["webhook_url"]
    headers: dict[str, str] = {"Content-Type": "application/json"}
    secret_header = config.get("secret_header")
    secret_token = config.get("secret_token")
    if secret_header and secret_token:
        headers[secret_header] = secret_token

    with httpx.Client(timeout=10.0) as client:
        resp = client.post(webhook_url, json=payload, headers=headers)
        return resp.status_code


def _build_test_payload(biz: Business) -> dict:
    return {
        "event_type": "test.ping",
        "business": {"id": str(biz.id), "name": biz.name},
        "lead": {
            "id": "00000000-0000-0000-0000-000000000000",
            "score": 85,
            "confidence": 70,
            "intent": "PURCHASE",
            "evidence_url": "https://example.com/test",
            "snippet": "This is a test event from QuietEyes",
            "suggested_reply": "Test reply",
        },
        "meta": {
            "source": "quieteyes",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


def build_lead_payload(biz: Business, lead: Lead) -> dict:
    """Build the stable payload contract for a lead event."""
    mention = lead.mention
    return {
        "event_type": "lead.created",
        "business": {"id": str(biz.id), "name": biz.name},
        "lead": {
            "id": str(lead.id),
            "score": lead.score,
            "confidence": lead.confidence,
            "intent": lead.intent.value,
            "evidence_url": mention.url if mention else None,
            "snippet": mention.snippet if mention else None,
            "suggested_reply": lead.suggested_reply,
        },
        "meta": {
            "source": mention.source.name if mention and mention.source else "unknown",
            "timestamps": {
                "lead_created": lead.created_at.isoformat() if lead.created_at else None,
                "mention_fetched": mention.fetched_at.isoformat() if mention else None,
            },
        },
    }


# ── Meta Integration CRUD ──


@router.post(
    "/businesses/{business_id}/integrations/meta",
    response_model=IntegrationOut,
    status_code=201,
)
def create_meta_integration(
    body: MetaIntegrationCreateRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    config: dict = {}
    if body.access_token:
        config["access_token"] = body.access_token
    if body.ad_account_id:
        config["ad_account_id"] = body.ad_account_id
    if body.page_id:
        config["page_id"] = body.page_id

    integration = Integration(
        business_id=biz.id,
        type=IntegrationType.META,
        name=body.name,
        config=config,
        is_enabled=True,
    )
    db.add(integration)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="INTEGRATION_CREATED",
        entity_type="integration",
        entity_id=integration.id,
        meta={"name": body.name, "type": "META"},
    ))

    db.commit()
    db.refresh(integration)
    return integration


@router.patch(
    "/integrations/{integration_id}/meta",
    response_model=IntegrationOut,
)
def update_meta_integration(
    integration_id: uuid.UUID,
    body: MetaIntegrationUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    integ = db.get(Integration, integration_id)
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    biz = db.get(Business, integ.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    if integ.type != IntegrationType.META:
        raise HTTPException(status_code=400, detail="Not a Meta integration")

    if body.name is not None:
        integ.name = body.name
    if body.is_enabled is not None:
        integ.is_enabled = body.is_enabled

    config = dict(integ.config or {})
    if body.access_token is not None:
        config["access_token"] = body.access_token
    if body.ad_account_id is not None:
        config["ad_account_id"] = body.ad_account_id
    if body.page_id is not None:
        config["page_id"] = body.page_id
    integ.config = config

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="INTEGRATION_UPDATED",
        entity_type="integration",
        entity_id=integ.id,
        meta={"name": integ.name, "type": "META"},
    ))

    db.commit()
    db.refresh(integ)
    return integ


def execute_crm_sync(db: Session, biz: Business, user: User, action_payload: dict) -> None:
    """Execute CRM sync: post lead data to all enabled webhook integrations."""
    lead_id_str = action_payload.get("lead_id")
    if not lead_id_str:
        return

    lead = db.get(Lead, uuid.UUID(lead_id_str))
    if not lead:
        return

    integrations = (
        db.query(Integration)
        .filter(
            Integration.business_id == biz.id,
            Integration.is_enabled.is_(True),
            Integration.type == IntegrationType.WEBHOOK,
        )
        .all()
    )

    if not integrations:
        return

    payload = build_lead_payload(biz, lead)
    now = datetime.now(timezone.utc)

    for integ in integrations:
        config = integ.config or {}
        event = IntegrationEvent(
            business_id=biz.id,
            integration_id=integ.id,
            event_type="lead.created",
            payload=payload,
            status=IntegrationEventStatus.PENDING,
        )
        db.add(event)
        db.flush()

        try:
            status_code = _post_webhook(config, payload)
            if 200 <= status_code < 300:
                event.status = IntegrationEventStatus.SENT
                event.sent_at = now
            else:
                event.status = IntegrationEventStatus.FAILED
                event.error_message = f"HTTP {status_code}"
        except Exception as e:
            event.status = IntegrationEventStatus.FAILED
            event.error_message = str(e)

    # Mark lead as SENT
    lead.status = LeadStatus.SENT

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="CRM_SYNC_EXECUTED",
        entity_type="lead",
        entity_id=lead.id,
        meta={
            "integrations_count": len(integrations),
            "lead_id": str(lead.id),
        },
    ))

    db.commit()


# ── Facebook / Instagram Connectors ──


@router.post(
    "/businesses/{business_id}/integrations/facebook",
    response_model=IntegrationOut,
    status_code=201,
)
def connect_facebook_page(
    body: dict,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    """Connect a Facebook Page for ingestion."""
    config = {
        "access_token": body.get("access_token", ""),
        "page_id": body.get("page_id", ""),
        "page_name": body.get("page_name", "Facebook Page"),
    }

    integration = Integration(
        business_id=biz.id,
        type=IntegrationType.FACEBOOK_PAGE,
        name=body.get("name", f"Facebook: {config['page_name']}"),
        config=config,
        is_enabled=True,
    )
    db.add(integration)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="INTEGRATION_CREATED",
        entity_type="integration",
        entity_id=integration.id,
        meta={"name": integration.name, "type": "FACEBOOK_PAGE"},
    ))

    db.commit()
    db.refresh(integration)
    return integration


@router.post(
    "/businesses/{business_id}/integrations/instagram",
    response_model=IntegrationOut,
    status_code=201,
)
def connect_instagram_account(
    body: dict,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    """Connect an Instagram Business account for ingestion."""
    config = {
        "access_token": body.get("access_token", ""),
        "ig_user_id": body.get("ig_user_id", ""),
        "account_name": body.get("account_name", "Instagram Account"),
    }

    integration = Integration(
        business_id=biz.id,
        type=IntegrationType.INSTAGRAM,
        name=body.get("name", f"Instagram: @{config['account_name']}"),
        config=config,
        is_enabled=True,
    )
    db.add(integration)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="INTEGRATION_CREATED",
        entity_type="integration",
        entity_id=integration.id,
        meta={"name": integration.name, "type": "INSTAGRAM"},
    ))

    db.commit()
    db.refresh(integration)
    return integration


@router.post("/integrations/{integration_id}/sync")
async def sync_integration(
    integration_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_INTEGRATIONS)),
):
    """Manually trigger a sync for a Facebook/Instagram connector."""
    integ = db.get(Integration, integration_id)
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    biz = db.get(Business, integ.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    if integ.type not in (IntegrationType.FACEBOOK_PAGE, IntegrationType.INSTAGRAM, IntegrationType.META):
        raise HTTPException(status_code=400, detail="Sync only supported for Facebook/Instagram connectors")

    from app.connectors.registry import sync_connector
    result = await sync_connector(db, integ, biz.id)
    db.commit()
    return result


@router.get("/integrations/{integration_id}/health")
async def connector_health(
    integration_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Check health of a Facebook/Instagram connector."""
    integ = db.get(Integration, integration_id)
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    biz = db.get(Business, integ.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Integration not found")

    from app.connectors.registry import check_connector_health
    health = await check_connector_health(integ)

    config = integ.config or {}
    return {
        "integration_id": str(integ.id),
        "type": integ.type.value,
        "name": integ.name,
        "is_enabled": integ.is_enabled,
        "health": health,
        "last_sync": config.get("last_sync"),
        "last_sync_status": config.get("last_sync_status"),
        "last_sync_items": config.get("last_sync_items"),
        "last_sync_new": config.get("last_sync_new"),
    }
