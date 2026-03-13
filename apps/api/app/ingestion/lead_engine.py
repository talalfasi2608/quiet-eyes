"""
Lead Engine v1: converts mentions into scored leads with intent classification
and template-based suggested replies.
"""

import logging
import re
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.models import (
    Business,
    Lead,
    LeadIntent,
    LeadStatus,
    Mention,
    Source,
)

logger = logging.getLogger(__name__)

# ── Intent classification rules ──
# Each rule: (intent, weight, patterns)
# Patterns matched case-insensitively against title + snippet

INTENT_RULES: list[tuple[LeadIntent, int, list[str]]] = [
    (LeadIntent.PURCHASE, 90, [
        r"looking for\b", r"need a\b", r"want to buy", r"searching for",
        r"where (can|do) (i|we) (buy|get|find)", r"recommend .*(tool|service|product|platform)",
        r"best .* for", r"top \d+",
    ]),
    (LeadIntent.COMPARISON, 75, [
        r"\bvs\b", r"alternative to", r"compared to", r"switch from",
        r"migrate from", r"better than", r"competitor",
    ]),
    (LeadIntent.COMPLAINT, 70, [
        r"complaint", r"problem with", r"issue with", r"frustrated",
        r"terrible", r"worst", r"broken", r"bug", r"doesn't work",
        r"disappointed", r"awful",
    ]),
    (LeadIntent.RECOMMENDATION, 60, [
        r"recommend\b", r"love this", r"great (tool|service|product)",
        r"highly recommend", r"works great", r"amazing",
    ]),
    (LeadIntent.QUESTION, 50, [
        r"how (do|can|to)", r"what is", r"anyone know", r"help with",
        r"question about", r"\?$",
    ]),
]


def classify_intent(text: str) -> tuple[LeadIntent, int]:
    """
    Classify intent from mention text.
    Returns (intent, certainty_score 0-100).
    """
    text_lower = text.lower()
    best_intent = LeadIntent.OTHER
    best_weight = 20  # base weight for OTHER

    for intent, weight, patterns in INTENT_RULES:
        for pattern in patterns:
            if re.search(pattern, text_lower):
                if weight > best_weight:
                    best_intent = intent
                    best_weight = weight
                break  # one match per intent group is enough

    return best_intent, best_weight


# ── Scoring formula ──


def compute_score(
    intent_weight: int,
    geo_match: bool,
    published_at: datetime | None,
    source_reliability: int | None,
) -> int:
    """
    Score formula: intent_weight (0-100) * weights + geo + recency + source.
    Returns 0-100.
    """
    score = 0.0

    # Intent weight contributes 40%
    score += (intent_weight / 100) * 40

    # Geo match contributes 15%
    if geo_match:
        score += 15

    # Recency contributes 25% (within 7 days = full, decays to 0 at 30 days)
    if published_at:
        age = datetime.now(timezone.utc) - published_at.replace(tzinfo=timezone.utc) if published_at.tzinfo is None else datetime.now(timezone.utc) - published_at
        days = max(0, age.total_seconds() / 86400)
        if days <= 7:
            score += 25
        elif days <= 30:
            score += 25 * (1 - (days - 7) / 23)
    else:
        score += 12  # unknown date gets half credit

    # Source reliability contributes 20%
    reliability = source_reliability or 50
    score += (reliability / 100) * 20

    return min(100, max(0, int(round(score))))


def compute_confidence(
    source_reliability: int | None,
    intent_certainty: int,
    has_title: bool,
    has_snippet: bool,
    has_url: bool,
) -> int:
    """
    Confidence formula: how sure we are this lead is real.
    Returns 0-100.
    """
    conf = 0.0

    # Source reliability: 30%
    conf += ((source_reliability or 50) / 100) * 30

    # Intent certainty: 40%
    conf += (intent_certainty / 100) * 40

    # Text completeness: 30%
    completeness = 0
    if has_title:
        completeness += 40
    if has_snippet:
        completeness += 40
    if has_url:
        completeness += 20
    conf += (completeness / 100) * 30

    return min(100, max(0, int(round(conf))))


# ── Reply templates ──

REPLY_TEMPLATES: dict[LeadIntent, str] = {
    LeadIntent.PURCHASE: (
        "Hi! I noticed you're looking for {category_or_solution}. "
        "At {business_name}, we specialize in exactly that. "
        "Would you like to learn how we can help? Happy to share more details."
    ),
    LeadIntent.COMPARISON: (
        "Hi! I saw you're comparing options in this space. "
        "{business_name} offers a unique approach — I'd love to share "
        "what makes us different. Want me to send a quick comparison?"
    ),
    LeadIntent.COMPLAINT: (
        "I'm sorry to hear about your experience. At {business_name}, "
        "we take a different approach to ensure customer satisfaction. "
        "Would you be open to giving us a try?"
    ),
    LeadIntent.RECOMMENDATION: (
        "Thanks for the kind words about solutions in this space! "
        "At {business_name}, we're always working to be the best. "
        "Would love to connect and hear your thoughts."
    ),
    LeadIntent.QUESTION: (
        "Great question! At {business_name}, we deal with this regularly. "
        "I'd be happy to share our perspective and help out. "
        "Want me to follow up with some details?"
    ),
    LeadIntent.OTHER: (
        "Hi! I came across your post and thought {business_name} "
        "might be relevant. Would you be interested in learning more?"
    ),
}


def generate_reply(intent: LeadIntent, business_name: str, category: str | None) -> str:
    """Generate a template-based suggested reply."""
    template = REPLY_TEMPLATES.get(intent, REPLY_TEMPLATES[LeadIntent.OTHER])
    return template.format(
        business_name=business_name,
        category_or_solution=category or "a solution like ours",
    )


# ── Main entry: generate leads from unprocessed mentions ──


def generate_leads_for_business(db: Session, business_id: uuid.UUID) -> dict:
    """
    Process all mentions that don't yet have leads.
    Returns summary with count of leads created.
    """
    business = db.get(Business, business_id)
    if not business:
        return {"error": "Business not found", "leads_created": 0}

    # Find mentions without leads
    existing_mention_ids = (
        db.query(Lead.mention_id)
        .filter(Lead.business_id == business_id, Lead.mention_id.isnot(None))
        .subquery()
    )
    unprocessed = (
        db.query(Mention)
        .filter(
            Mention.business_id == business_id,
            ~Mention.id.in_(existing_mention_ids),
        )
        .all()
    )

    if not unprocessed:
        total = db.query(Lead).filter(Lead.business_id == business_id).count()
        return {"leads_created": 0, "total_leads": total, "mentions_processed": 0}

    created = 0
    for mention in unprocessed:
        text = f"{mention.title or ''} {mention.snippet or ''}"
        if len(text.strip()) < 5:
            continue

        intent, intent_certainty = classify_intent(text)

        # Check geo match
        geo_match = False
        if business.location_text and mention.snippet:
            geo_match = business.location_text.lower() in mention.snippet.lower()

        # Get source reliability
        source_reliability = None
        if mention.source_id:
            source = db.get(Source, mention.source_id)
            if source:
                source_reliability = source.reliability_score

        score = compute_score(intent, geo_match, mention.published_at, source_reliability)
        confidence = compute_confidence(
            source_reliability, intent_certainty,
            bool(mention.title), bool(mention.snippet), bool(mention.url),
        )
        reply = generate_reply(intent, business.name, business.category)

        lead = Lead(
            business_id=business_id,
            mention_id=mention.id,
            intent=intent,
            score=score,
            confidence=confidence,
            status=LeadStatus.NEW,
            suggested_reply=reply,
        )
        db.add(lead)
        created += 1

    db.commit()

    total = db.query(Lead).filter(Lead.business_id == business_id).count()
    return {
        "leads_created": created,
        "total_leads": total,
        "mentions_processed": len(unprocessed),
    }
