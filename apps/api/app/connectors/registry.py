"""
Meta Connector Registry — manages Facebook and Instagram connector lifecycle.

Handles:
- Connector instantiation from Integration config
- Health checking
- Data sync orchestration
- Result normalization into Mentions
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.connectors.facebook_page import FacebookPageAdapter
from app.connectors.instagram_business import InstagramBusinessAdapter
from app.ingestion.adapters import MentionResult
from app.models import (
    AccessMethod,
    Integration,
    IntegrationType,
    Mention,
    Source,
    SourceType,
)

logger = logging.getLogger(__name__)


def _ensure_source(db: Session, name: str, stype: SourceType) -> Source:
    """Get or create a source record."""
    source = db.query(Source).filter(Source.name == name, Source.type == stype).first()
    if not source:
        source = Source(
            name=name, type=stype, access_method=AccessMethod.API, reliability_score=85
        )
        db.add(source)
        db.flush()
    return source


def _compute_dedup_hash(business_id: uuid.UUID, url: str, title: str) -> str:
    import hashlib
    raw = f"{business_id}:{url}:{title}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _store_results(
    db: Session,
    business_id: uuid.UUID,
    source: Source,
    results: list[MentionResult],
) -> int:
    """Store MentionResults with dedup. Returns count of new mentions."""
    created = 0
    for r in results:
        if not r.url and not r.title:
            continue
        if len(f"{r.title or ''} {r.snippet or ''}".strip()) < 10:
            continue

        dedup = _compute_dedup_hash(business_id, r.url or "", r.title or "")
        exists = db.query(Mention.id).filter(Mention.dedup_hash == dedup).first()
        if exists:
            continue

        mention = Mention(
            business_id=business_id,
            source_id=source.id,
            title=(r.title or "")[:500],
            snippet=(r.snippet or "")[:2000],
            url=(r.url or "")[:2048],
            published_at=r.published_at,
            fetched_at=datetime.now(timezone.utc),
            raw_json=r.raw_json,
            dedup_hash=dedup,
        )
        db.add(mention)
        created += 1

    return created


def get_adapter_for_integration(integration: Integration):
    """Instantiate the right adapter based on integration type."""
    config = integration.config or {}

    if integration.type == IntegrationType.FACEBOOK_PAGE:
        return FacebookPageAdapter(config)
    elif integration.type == IntegrationType.INSTAGRAM:
        return InstagramBusinessAdapter(config)
    elif integration.type == IntegrationType.META:
        # Legacy META type — treat as Facebook Page if page_id present
        if config.get("page_id"):
            return FacebookPageAdapter(config)
        return None
    return None


async def check_connector_health(integration: Integration) -> dict:
    """Check health of a Meta connector."""
    adapter = get_adapter_for_integration(integration)
    if not adapter:
        return {"status": "unsupported", "message": f"No adapter for type {integration.type.value}"}
    return await adapter.check_health()


async def sync_connector(
    db: Session,
    integration: Integration,
    business_id: uuid.UUID,
) -> dict:
    """
    Run a full sync for a Meta connector.
    Returns summary with counts.
    """
    adapter = get_adapter_for_integration(integration)
    if not adapter:
        return {
            "status": "error",
            "message": f"No adapter for type {integration.type.value}",
            "mentions_created": 0,
        }

    # Determine source name and type
    if isinstance(adapter, FacebookPageAdapter):
        source_name = "Facebook Page"
        source_type = SourceType.SOCIAL
    elif isinstance(adapter, InstagramBusinessAdapter):
        source_name = "Instagram"
        source_type = SourceType.SOCIAL
    else:
        source_name = "Meta"
        source_type = SourceType.SOCIAL

    source = _ensure_source(db, source_name, source_type)

    try:
        results = await adapter.fetch_all()
        mentions_created = _store_results(db, business_id, source, results)

        # Update integration config with sync metadata
        config = dict(integration.config or {})
        config["last_sync"] = datetime.now(timezone.utc).isoformat()
        config["last_sync_status"] = "ok"
        config["last_sync_items"] = len(results)
        config["last_sync_new"] = mentions_created
        integration.config = config

        # Get engagement summary if available
        engagement = None
        if isinstance(adapter, FacebookPageAdapter) and hasattr(adapter, "get_engagement_summary"):
            posts = await adapter.fetch_recent_posts(10)
            engagement = adapter.get_engagement_summary(posts)
        elif isinstance(adapter, InstagramBusinessAdapter):
            media = await adapter.fetch_recent_media(10)
            engagement = adapter.get_engagement_summary(media)

        return {
            "status": "ok",
            "connector_type": integration.type.value,
            "is_live": adapter.is_configured,
            "mentions_created": mentions_created,
            "total_fetched": len(results),
            "engagement": engagement,
        }
    except Exception as e:
        logger.exception("Sync failed for integration %s", integration.id)
        config = dict(integration.config or {})
        config["last_sync"] = datetime.now(timezone.utc).isoformat()
        config["last_sync_status"] = "error"
        config["last_sync_error"] = str(e)
        integration.config = config

        return {
            "status": "error",
            "message": str(e),
            "mentions_created": 0,
        }
