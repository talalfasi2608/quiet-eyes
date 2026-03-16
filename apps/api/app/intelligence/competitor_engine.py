"""
Competitor Engine v1: detect changes in competitor messaging/offers.
Scans mentions that reference competitor names and detects offer-related keywords.
"""

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import (
    Business,
    Competitor,
    CompetitorEvent,
    CompetitorEventType,
    Mention,
)

logger = logging.getLogger(__name__)

# Patterns for different event types
OFFER_PATTERNS = [
    r"\b\d+%\s*(off|discount|sale)\b",
    r"\b(free delivery|free shipping)\b",
    r"\b(buy one get one|bogo)\b",
    r"\b(new price|price drop|price cut)\b",
    r"\b(special offer|limited time|flash sale)\b",
    r"\b(coupon|promo code|voucher)\b",
]

MESSAGE_PATTERNS = [
    r"\b(new (menu|product|service|feature|launch))\b",
    r"\b(now (offering|available|open))\b",
    r"\b(introducing|announcing|unveiling)\b",
    r"\b(rebrand|new look|redesign)\b",
]

CONTENT_PATTERNS = [
    r"\b(blog post|article|press release|announcement)\b",
    r"\b(social media|instagram|facebook|tiktok)\b",
    r"\b(campaign|advertisement|ad)\b",
    r"\b(review|testimonial|case study)\b",
]


def _classify_event(text: str) -> CompetitorEventType:
    """Classify competitor mention into event type."""
    text_lower = text.lower()

    for pattern in OFFER_PATTERNS:
        if re.search(pattern, text_lower):
            return CompetitorEventType.OFFER_CHANGE

    for pattern in MESSAGE_PATTERNS:
        if re.search(pattern, text_lower):
            return CompetitorEventType.MESSAGE_CHANGE

    for pattern in CONTENT_PATTERNS:
        if re.search(pattern, text_lower):
            return CompetitorEventType.CONTENT_CHANGE

    return CompetitorEventType.CONTENT_CHANGE


def _build_summary(competitor_name: str, event_type: CompetitorEventType, text: str) -> str:
    """Build a human-readable summary."""
    snippet = text[:200].strip()
    if event_type == CompetitorEventType.OFFER_CHANGE:
        return f"{competitor_name} appears to have a new offer or pricing change: \"{snippet}\""
    elif event_type == CompetitorEventType.MESSAGE_CHANGE:
        return f"{competitor_name} may have launched something new: \"{snippet}\""
    return f"New activity detected from {competitor_name}: \"{snippet}\""


def run_competitor_engine(db: Session, business_id: uuid.UUID) -> int:
    """
    Detect competitor activity changes from recent mentions.
    Returns count of new events created.
    """
    business = db.get(Business, business_id)
    if not business:
        return 0

    competitors = (
        db.query(Competitor)
        .filter(Competitor.business_id == business_id)
        .all()
    )
    if not competitors:
        return 0

    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=7)

    # Get recent mentions
    recent_mentions = (
        db.query(Mention)
        .filter(
            Mention.business_id == business_id,
            Mention.fetched_at >= lookback,
        )
        .all()
    )

    if not recent_mentions:
        return 0

    # Get existing competitor events from last 7 days to avoid duplicates
    existing_evidence = set()
    existing_events = (
        db.query(CompetitorEvent)
        .filter(
            CompetitorEvent.business_id == business_id,
            CompetitorEvent.created_at >= lookback,
        )
        .all()
    )
    for evt in existing_events:
        for url in (evt.evidence_urls or []):
            existing_evidence.add(url)

    created = 0
    for competitor in competitors:
        comp_name_lower = competitor.name.lower()
        comp_url_lower = (competitor.website_url or "").lower()

        matching_mentions = []
        for m in recent_mentions:
            text = f"{m.title or ''} {m.snippet or ''}"
            text_lower = text.lower()
            url_lower = (m.url or "").lower()

            # Check if mention references this competitor
            name_match = comp_name_lower in text_lower
            url_match = comp_url_lower and comp_url_lower in url_lower

            if name_match or url_match:
                matching_mentions.append(m)

        if not matching_mentions:
            continue

        # Group by event type and create events
        events_by_type: dict[CompetitorEventType, list[Mention]] = {}
        for m in matching_mentions:
            # Skip if we already have this URL as evidence
            if m.url and m.url in existing_evidence:
                continue
            text = f"{m.title or ''} {m.snippet or ''}"
            etype = _classify_event(text)
            if etype not in events_by_type:
                events_by_type[etype] = []
            events_by_type[etype].append(m)

        for etype, mentions in events_by_type.items():
            if not mentions:
                continue

            evidence_urls = [m.url for m in mentions if m.url][:5]
            if not evidence_urls:
                continue

            # Use the first mention text for summary
            first_text = f"{mentions[0].title or ''} {mentions[0].snippet or ''}"
            summary = _build_summary(competitor.name, etype, first_text)

            event = CompetitorEvent(
                business_id=business_id,
                competitor_id=competitor.id,
                event_type=etype,
                summary=summary,
                evidence_urls=evidence_urls,
                detected_at=now,
            )
            db.add(event)
            created += 1

    if created:
        db.flush()

    return created
