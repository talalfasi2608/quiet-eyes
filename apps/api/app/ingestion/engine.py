"""
Ingestion engine: runs all collection adapters for a business, stores mentions with dedup.

Adapters:
- Web Search (Tavily)
- RSS feeds
- Google Places reviews
- Reddit threads
- Yelp reviews
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


def _ensure_source(db: Session, name: str, stype: SourceType, method: AccessMethod, reliability: int = 70) -> Source:
    """Get or create a source record."""
    source = db.query(Source).filter(Source.name == name, Source.type == stype).first()
    if not source:
        source = Source(name=name, type=stype, access_method=method, reliability_score=reliability)
        db.add(source)
        db.flush()
    return source


# Minimum content length to be worth storing
MIN_CONTENT_LEN = 20

# URL patterns that are always noise (login pages, error pages, etc.)
NOISE_URL_PATTERNS = {
    "/login", "/signup", "/register", "/404", "/error",
    "/cookie", "/privacy-policy", "/terms",
}


def _is_noise_mention(r: MentionResult) -> bool:
    """Quick filter for obviously low-value mentions."""
    content = f"{r.title or ''} {r.snippet or ''}"
    if len(content.strip()) < MIN_CONTENT_LEN:
        return True

    # Filter out mentions that are just navigation/structural pages
    url_lower = (r.url or "").lower()
    for pattern in NOISE_URL_PATTERNS:
        if pattern in url_lower:
            return True

    return False


def _store_mentions(
    db: Session,
    business_id: uuid.UUID,
    source: Source,
    results: list[MentionResult],
) -> int:
    """Store mention results, deduplicating by hash and filtering noise. Returns count of new mentions."""
    created = 0
    for r in results:
        if not r.url and not r.title:
            continue
        if _is_noise_mention(r):
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


# ── Individual adapter runners ──


async def _run_search_ingestion(
    db: Session,
    business: Business,
    competitor_names: list[str],
) -> int:
    """Run Tavily search-based ingestion."""
    adapter = SearchAdapter()
    metadata = business.client_metadata or {}
    keywords = metadata.get("keywords", "")
    queries = build_queries_for_business(
        name=business.name,
        category=business.category,
        location=business.location_text,
        competitor_names=competitor_names,
        keywords=keywords,
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
    """Run RSS-based ingestion."""
    adapter = RSSAdapter()
    feeds = get_rss_feeds_for_category(business.category)
    total_new = 0

    for feed_info in feeds:
        source = _ensure_source(db, feed_info["name"], SourceType.RSS, AccessMethod.RSS)
        results = await adapter.fetch(feed_info["url"], feed_name=feed_info["name"], max_items=5)
        total_new += _store_mentions(db, business.id, source, results)

    return total_new


async def _run_google_places_ingestion(
    db: Session,
    business: Business,
    competitor_names: list[str],
) -> int:
    """Fetch Google Places reviews for business + competitors."""
    from app.ingestion.google_places_adapter import fetch_google_reviews

    results = await fetch_google_reviews(
        business_name=business.name,
        location=business.location_text,
        competitor_names=competitor_names,
    )
    if not results:
        return 0

    source = _ensure_source(
        db, "Google Places", SourceType.REVIEWS, AccessMethod.API, reliability=85
    )
    return _store_mentions(db, business.id, source, results)


async def _run_reddit_ingestion(
    db: Session,
    business: Business,
    competitor_names: list[str],
) -> int:
    """Fetch high-intent Reddit threads."""
    from app.ingestion.reddit_adapter import fetch_reddit_mentions

    metadata = business.client_metadata or {}
    results = await fetch_reddit_mentions(
        business_name=business.name,
        category=business.category,
        location=business.location_text,
        competitor_names=competitor_names,
        keywords=metadata.get("keywords"),
    )
    if not results:
        return 0

    source = _ensure_source(
        db, "Reddit", SourceType.SOCIAL, AccessMethod.API, reliability=65
    )
    return _store_mentions(db, business.id, source, results)


async def _run_yelp_ingestion(
    db: Session,
    business: Business,
    competitor_names: list[str],
) -> int:
    """Fetch Yelp reviews for business + competitors."""
    from app.ingestion.yelp_adapter import fetch_yelp_reviews

    results = await fetch_yelp_reviews(
        business_name=business.name,
        location=business.location_text,
        competitor_names=competitor_names,
    )
    if not results:
        return 0

    source = _ensure_source(
        db, "Yelp", SourceType.REVIEWS, AccessMethod.API, reliability=80
    )
    return _store_mentions(db, business.id, source, results)


async def _run_trustpilot_ingestion(
    db: Session,
    business: Business,
    competitor_names: list[str],
) -> int:
    """Fetch Trustpilot reviews via Tavily site search."""
    from app.ingestion.trustpilot_adapter import fetch_trustpilot_reviews

    results = await fetch_trustpilot_reviews(
        business_name=business.name,
        location=business.location_text,
        competitor_names=competitor_names,
    )
    if not results:
        return 0

    source = _ensure_source(
        db, "Trustpilot", SourceType.REVIEWS, AccessMethod.API, reliability=80
    )
    return _store_mentions(db, business.id, source, results)


# ── Main entry point ──


async def ingest_for_business(business_id: uuid.UUID) -> dict:
    """
    Main entry point: runs all ingestion adapters for one business.
    Returns summary dict with counts per source.
    """
    db = SessionLocal()
    try:
        business = db.get(Business, business_id)
        if not business:
            return {"error": "Business not found", "business_id": str(business_id)}

        competitors = db.query(Competitor).filter(Competitor.business_id == business_id).all()
        competitor_names = [c.name for c in competitors]

        # Run all adapters, catching errors per-adapter so one failure doesn't block others
        counts: dict[str, int] = {}

        try:
            counts["search_new"] = await _run_search_ingestion(db, business, competitor_names)
        except Exception:
            logger.exception("Search ingestion failed for %s", business_id)
            counts["search_new"] = 0

        try:
            counts["rss_new"] = await _run_rss_ingestion(db, business)
        except Exception:
            logger.exception("RSS ingestion failed for %s", business_id)
            counts["rss_new"] = 0

        try:
            counts["google_reviews_new"] = await _run_google_places_ingestion(db, business, competitor_names)
        except Exception:
            logger.exception("Google Places ingestion failed for %s", business_id)
            counts["google_reviews_new"] = 0

        try:
            counts["reddit_new"] = await _run_reddit_ingestion(db, business, competitor_names)
        except Exception:
            logger.exception("Reddit ingestion failed for %s", business_id)
            counts["reddit_new"] = 0

        try:
            counts["yelp_reviews_new"] = await _run_yelp_ingestion(db, business, competitor_names)
        except Exception:
            logger.exception("Yelp ingestion failed for %s", business_id)
            counts["yelp_reviews_new"] = 0

        try:
            counts["trustpilot_new"] = await _run_trustpilot_ingestion(db, business, competitor_names)
        except Exception:
            logger.exception("Trustpilot ingestion failed for %s", business_id)
            counts["trustpilot_new"] = 0

        db.commit()

        total = db.query(Mention).filter(Mention.business_id == business_id).count()

        return {
            "business_id": str(business_id),
            "business_name": business.name,
            **counts,
            "total_mentions": total,
            "error": None,
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
