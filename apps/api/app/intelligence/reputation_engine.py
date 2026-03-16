"""
Reputation Engine v1: identify reviews/complaints from mentions.
For negative sentiment, auto-creates a REPLY_DRAFT action + approval.
"""

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    Mention,
    Review,
    ReviewSentiment,
    RiskLevel,
)

logger = logging.getLogger(__name__)

# Negative sentiment patterns
NEG_PATTERNS = [
    r"\b(not recommended|don't recommend|wouldn't recommend)\b",
    r"\b(bad service|terrible service|poor service|awful service)\b",
    r"\b(worst experience|horrible experience)\b",
    r"\b(refund|money back|rip off|scam)\b",
    r"\b(disappointed|frustrat|disgust)\b",
    r"\b(1 star|one star|0 star|zero star)\b",
    r"\b(never again|stay away|avoid)\b",
    r"\b(complaint|complain)\b",
    r"\b(worst|horrible|terrible|awful|disgusting)\b",
]

# Positive sentiment patterns
POS_PATTERNS = [
    r"\b(highly recommend|strongly recommend)\b",
    r"\b(great service|excellent service|amazing service)\b",
    r"\b(best experience|wonderful experience)\b",
    r"\b(5 star|five star)\b",
    r"\b(love this|love it|loved it)\b",
    r"\b(fantastic|outstanding|superb|brilliant)\b",
    r"\b(thank you|thanks so much)\b",
]

# Review-like indicators (suggests the mention IS a review)
REVIEW_INDICATORS = [
    r"\b(review|rating|rated|stars?)\b",
    r"\b(experience with|visited|ordered from|bought from)\b",
    r"\b(customer service|support team)\b",
    r"\b(would recommend|wouldn't recommend)\b",
    r"\b(pros? and cons?|my honest)\b",
]

# Star rating extraction
STAR_PATTERN = re.compile(r"(\d)\s*(out of\s*\d+\s*)?(star|\/5|\/10)", re.IGNORECASE)


def _is_review_like(text: str) -> bool:
    """Check if mention looks like a review."""
    text_lower = text.lower()
    for pattern in REVIEW_INDICATORS:
        if re.search(pattern, text_lower):
            return True
    # Also count negative/positive patterns as review-like
    for pattern in NEG_PATTERNS + POS_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def _classify_sentiment(text: str) -> ReviewSentiment:
    """Classify sentiment from review text."""
    text_lower = text.lower()

    neg_score = sum(1 for p in NEG_PATTERNS if re.search(p, text_lower))
    pos_score = sum(1 for p in POS_PATTERNS if re.search(p, text_lower))

    if neg_score > pos_score:
        return ReviewSentiment.NEG
    if pos_score > neg_score:
        return ReviewSentiment.POS
    return ReviewSentiment.NEU


def _extract_rating(text: str) -> int | None:
    """Try to extract a star rating from text."""
    match = STAR_PATTERN.search(text)
    if match:
        rating = int(match.group(1))
        if 0 <= rating <= 5:
            return rating
    return None


def _generate_reply_draft(business_name: str, review_text: str) -> str:
    """Generate a professional reply draft for a negative review."""
    snippet = review_text[:100].strip()
    return (
        f"Dear customer, thank you for sharing your feedback with {business_name}. "
        f"We sincerely apologize for the experience you described. "
        f"Your satisfaction is our top priority, and we would like to make this right. "
        f"Please reach out to us directly so we can address your concerns personally. "
        f"We appreciate the opportunity to improve."
    )


def run_reputation_engine(db: Session, business_id: uuid.UUID) -> int:
    """
    Scan recent mentions for reviews/complaints.
    Creates Review records. For NEG reviews, auto-creates REPLY_DRAFT approvals.
    Returns count of reviews created.
    """
    business = db.get(Business, business_id)
    if not business:
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

    # Get existing review URLs to avoid duplicates
    existing_urls = set(
        r[0] for r in
        db.query(Review.url)
        .filter(
            Review.business_id == business_id,
            Review.url.isnot(None),
        )
        .all()
    )

    created = 0
    for m in recent_mentions:
        text = f"{m.title or ''} {m.snippet or ''}"
        if len(text.strip()) < 10:
            continue

        if not _is_review_like(text):
            continue

        # Skip if we already have this URL as a review
        if m.url and m.url in existing_urls:
            continue

        sentiment = _classify_sentiment(text)
        rating = _extract_rating(text)

        review = Review(
            business_id=business_id,
            source_id=m.source_id,
            rating=rating,
            author=None,
            text=text.strip()[:2000],
            url=m.url,
            published_at=m.published_at,
            sentiment=sentiment,
        )
        db.add(review)
        db.flush()
        created += 1

        if m.url:
            existing_urls.add(m.url)

        # For negative reviews, auto-create a reply draft action + approval
        if sentiment == ReviewSentiment.NEG:
            reply_text = _generate_reply_draft(business.name, text)

            action = Action(
                business_id=business_id,
                type=ActionType.REPLY_DRAFT,
                payload={
                    "review_id": str(review.id),
                    "reply_text": reply_text,
                    "confidence": 60,
                    "source": "reputation_engine",
                    "evidence_url": m.url,
                },
            )
            db.add(action)
            db.flush()

            approval = Approval(
                business_id=business_id,
                action_id=action.id,
                status=ApprovalStatus.PENDING,
                risk=RiskLevel.MEDIUM,
                cost_impact=0,
                confidence=60,
                requires_human=True,
            )
            db.add(approval)

            db.add(AuditLog(
                org_id=business.org_id,
                event_type="REPUTATION_REPLY_DRAFTED",
                entity_type="review",
                entity_id=review.id,
                meta={
                    "sentiment": sentiment.value,
                    "business_id": str(business_id),
                },
            ))

    if created:
        db.flush()

    return created
