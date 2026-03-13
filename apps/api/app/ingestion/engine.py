"""
Ingestion engine: runs search + RSS collection for a business, stores mentions with dedup.
"""

import asyncio
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.ingestion.adapters import MentionResult, RSSAdapter, SearchAdapter
from app.ingestion.source_rules import build_queries_for_business, get_rss_feeds_for_category
from app.models import AccessMethod, Business, Competitor, Mention, Source, SourceType

logger = logging.getLogger(__name__)


def _compute_dedup_hash(business_id: uuid.UUID, url: str, title: str) -> str:
    raw = f"{business_id}:{url}:{title}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _ensure_source(db: Session, name: str, stype: SourceType, method: AccessMethod) -> Source:
    """Get or create a source record."""
    source = db.query(Source).filter(Source.name == name, Source.type == stype).first()
    if not source:
        source = Source(name=name, type=stype, access_method=method, reliability_score=70)
        db.add(source)
        db.flush()
    return source


def _store_mentions(
    db: Session,
    business_id: uuid.UUID,
    source: Source,
    results: list[MentionResult],
) -> int:
    """Store mention results, deduplicating by hash. Returns count of new mentions."""
    created = 0
    for r in results:
        if not r.url and not r.title:
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


async def _run_search_ingestion(
    db: Session,
    business: Business,
    competitor_names: list[str],
) -> int:
    """Run search-based ingestion. Returns count of new mentions."""
    adapter = SearchAdapter()
    queries = build_queries_for_business(
        name=business.name,
        category=business.category,
        location=business.location_text,
        competitor_names=competitor_names,
    )

    source = _ensure_source(db, "Web Search", SourceType.SEARCH, AccessMethod.API)
    total_new = 0

    for query in queries:
        results = await adapter.search(query, max_results=3)
        total_new += _store_mentions(db, business.id, source, results)

    return total_new


async def _run_rss_ingestion(
    db: Session,
    business: Business,
) -> int:
    """Run RSS-based ingestion. Returns count of new mentions."""
    adapter = RSSAdapter()
    feeds = get_rss_feeds_for_category(business.category)
    total_new = 0

    for feed_info in feeds:
        source = _ensure_source(db, feed_info["name"], SourceType.RSS, AccessMethod.RSS)
        results = await adapter.fetch(feed_info["url"], feed_name=feed_info["name"], max_items=5)
        total_new += _store_mentions(db, business.id, source, results)

    return total_new


async def ingest_for_business(business_id: uuid.UUID) -> dict:
    """
    Main entry point: runs all ingestion adapters for one business.
    Returns summary dict with counts.
    """
    db = SessionLocal()
    try:
        business = db.get(Business, business_id)
        if not business:
            return {"error": "Business not found", "business_id": str(business_id)}

        competitors = db.query(Competitor).filter(Competitor.business_id == business_id).all()
        competitor_names = [c.name for c in competitors]

        search_new = await _run_search_ingestion(db, business, competitor_names)
        rss_new = await _run_rss_ingestion(db, business)

        db.commit()

        total = db.query(Mention).filter(Mention.business_id == business_id).count()

        return {
            "business_id": str(business_id),
            "business_name": business.name,
            "search_new": search_new,
            "rss_new": rss_new,
            "total_mentions": total,
        }
    except Exception:
        db.rollback()
        logger.exception("Ingestion failed for business %s", business_id)
        raise
    finally:
        db.close()


def ingest_for_business_sync(business_id: uuid.UUID) -> dict:
    """Synchronous wrapper for use in Celery tasks."""
    return asyncio.run(ingest_for_business(business_id))


async def ingest_all_businesses() -> list[dict]:
    """Run ingestion for all businesses. Used by the periodic Celery beat task."""
    db = SessionLocal()
    try:
        business_ids = [b.id for b in db.query(Business.id).all()]
    finally:
        db.close()

    results = []
    for bid in business_ids:
        result = await ingest_for_business(bid)
        results.append(result)

    return results
