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
    Competitor,
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
        r"anyone tried", r"suggestions for", r"what do you use",
    ]),
    (LeadIntent.COMPARISON, 75, [
        r"\bvs\b", r"alternative to", r"compared to", r"switch from",
        r"migrate from", r"better than", r"competitor",
        r"moving away from", r"leaving .* for", r"thinking of switching",
    ]),
    (LeadIntent.COMPLAINT, 80, [
        r"complaint", r"problem with", r"issue with", r"frustrated",
        r"terrible", r"worst", r"broken", r"bug", r"doesn't work",
        r"disappointed", r"awful", r"overpriced", r"rip.?off",
        r"never again", r"stay away", r"avoid\b", r"waste of",
        r"not recommended", r"don't recommend", r"wouldn't recommend",
        r"1 star", r"one star", r"0 star",
        r"bad (service|food|experience|quality)", r"poor (service|quality)",
    ]),
    (LeadIntent.RECOMMENDATION, 60, [
        r"recommend\b", r"love this", r"great (tool|service|product)",
        r"highly recommend", r"works great", r"amazing",
        r"5 star", r"five star", r"excellent", r"outstanding",
        r"best .* ever", r"must try", r"go-to place",
    ]),
    (LeadIntent.QUESTION, 50, [
        r"how (do|can|to)", r"what is", r"anyone know", r"help with",
        r"question about", r"\?$",
        r"is it worth", r"should i\b", r"has anyone",
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
    source_type: str | None = None,
    is_competitor_mention: bool = False,
    raw_rating: int | None = None,
) -> int:
    """
    Score formula: intent_weight (0-100) * weights + geo + recency + source + boosts.
    Returns 0-100.
    """
    score = 0.0

    # Intent weight contributes 35%
    score += (intent_weight / 100) * 35

    # Geo match contributes 12%
    if geo_match:
        score += 12

    # Recency contributes 20% (within 7 days = full, decays to 0 at 30 days)
    if published_at:
        age = datetime.now(timezone.utc) - published_at.replace(tzinfo=timezone.utc) if published_at.tzinfo is None else datetime.now(timezone.utc) - published_at
        days = max(0, age.total_seconds() / 86400)
        if days <= 7:
            score += 20
        elif days <= 30:
            score += 20 * (1 - (days - 7) / 23)
    else:
        score += 10  # unknown date gets half credit

    # Source reliability contributes 15%
    reliability = source_reliability or 50
    score += (reliability / 100) * 15

    # Review source boost: +8 for reviews (Google, Yelp, Tripadvisor)
    if source_type in ("REVIEWS", "SOCIAL"):
        score += 8

    # Competitor dissatisfaction boost: +10 when a complaint is about a competitor
    if is_competitor_mention and intent_weight >= 70:
        score += 10

    # Low-rating review boost: 1-2 star reviews from competitors are gold
    if raw_rating is not None and raw_rating <= 2:
        score += 5

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


def generate_reply(intent: LeadIntent, business_name: str, category: str | None, metadata: dict | None = None) -> str:
    """Generate suggested reply. Uses OpenAI when available, falls back to templates."""
    from app.ai import chat_completion

    metadata = metadata or {}
    tone = metadata.get("tone", "")
    tone_instruction = f" Use a {tone} tone." if tone else ""

    system_parts = (
        f"You are a helpful sales representative for {business_name} "
        f"in the {category or 'general'} industry. Write a short, friendly, "
        f"non-pushy reply (2-3 sentences) to engage this potential lead.{tone_instruction}"
    )

    user_parts = (
        f"The lead showed {intent.value} intent about {category or 'our services'}. "
        f"Write a conversational reply from {business_name} that addresses their intent "
        "and encourages further engagement."
    )
    if metadata.get("services"):
        user_parts += f"\nOur services/products: {metadata['services']}"
    if metadata.get("differentiation"):
        user_parts += f"\nWhat makes us different: {metadata['differentiation']}"

    ai_reply = chat_completion(
        system_prompt=system_parts,
        user_message=user_parts,
        max_tokens=200,
        temperature=0.7,
    )
    if ai_reply:
        return ai_reply

    # Fallback to templates
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

    # Pre-load competitor names (once, not per-mention)
    competitor_names = [
        c.name.lower()
        for c in db.query(Competitor).filter(Competitor.business_id == business_id).all()
    ]

    # Pre-load keywords for relevance checking
    biz_keywords = set()
    biz_name_lower = business.name.lower()
    if business.category:
        biz_keywords.add(business.category.lower())
    biz_metadata = business.client_metadata or {}
    if biz_metadata.get("keywords"):
        for kw in biz_metadata["keywords"].split(","):
            kw = kw.strip().lower()
            if kw:
                biz_keywords.add(kw)
                for word in kw.split():
                    if len(word) > 3:
                        biz_keywords.add(word)

    created = 0
    skipped_irrelevant = 0
    for mention in unprocessed:
        text = f"{mention.title or ''} {mention.snippet or ''}"
        if len(text.strip()) < 15:
            continue

        # Get source type for relevance filtering
        source_reliability = None
        source_type = None
        if mention.source_id:
            source = db.get(Source, mention.source_id)
            if source:
                source_reliability = source.reliability_score
                source_type = source.type.value if source.type else None

        # Relevance filtering by source type
        text_lower = text.lower()
        has_biz_name = biz_name_lower in text_lower
        has_keyword = any(kw in text_lower for kw in biz_keywords)
        has_competitor = any(cn in text_lower for cn in competitor_names)
        has_relevance = has_biz_name or has_keyword or has_competitor

        # RSS: must be relevant (no generic articles)
        if source_type == "RSS" and not has_relevance:
            skipped_irrelevant += 1
            continue

        intent, intent_certainty = classify_intent(text)

        # For non-review sources: skip OTHER intent if also irrelevant
        if source_type not in ("REVIEWS",) and intent == LeadIntent.OTHER:
            if not has_relevance and len(text.strip()) < 100:
                skipped_irrelevant += 1
                continue

        # Check geo match
        geo_match = False
        if business.location_text and mention.snippet:
            geo_match = business.location_text.lower() in mention.snippet.lower()

        # Check if this is a competitor mention
        is_competitor_mention = False
        if source_type != "RSS":
            text_lower = text.lower()
        for comp_name in competitor_names:
            if comp_name in text_lower:
                is_competitor_mention = True
                break

        # Extract rating from raw_json if from a review source
        raw_rating = None
        if mention.raw_json and isinstance(mention.raw_json, dict):
            raw_rating = mention.raw_json.get("rating")

        # ── Community intent analysis ──
        from app.ingestion.community_intent import analyze_community_intent, CommunitySignal

        community = analyze_community_intent(
            text=text,
            source_type=source_type,
            source_name=(source.name if mention.source_id and source else None),
            business_category=business.category,
            business_location=business.location_text,
            business_keywords=biz_metadata.get("keywords"),
            competitor_names=competitor_names,
            raw_json=mention.raw_json,
        )

        # Community intent boosts
        community_boost = 0
        if community.signal == CommunitySignal.HIGH_INTENT:
            community_boost = 12
        elif community.signal == CommunitySignal.RECOMMENDATION_REQUEST:
            community_boost = 10
        elif community.signal == CommunitySignal.SWITCHING_SIGNAL:
            community_boost = 11
        elif community.signal == CommunitySignal.COMPLAINT_OPPORTUNITY:
            community_boost = 9
        elif community.signal == CommunitySignal.LOCAL_DISCOVERY:
            community_boost = 8

        # Urgency adds extra boost
        if community.urgency >= 20:
            community_boost += min(5, community.urgency // 5)

        # Skip true noise from community analysis if also low-intent
        if community.signal == CommunitySignal.NOISE and intent == LeadIntent.OTHER:
            if community.business_fit < 40:
                skipped_irrelevant += 1
                continue

        score = compute_score(
            intent_certainty,
            geo_match or community.location_relevant,
            mention.published_at,
            source_reliability,
            source_type=source_type,
            is_competitor_mention=is_competitor_mention,
            raw_rating=raw_rating,
        )
        # Apply community boost
        score = min(100, score + community_boost)

        confidence = compute_confidence(
            source_reliability, intent_certainty,
            bool(mention.title), bool(mention.snippet), bool(mention.url),
        )

        reply = generate_reply(intent, business.name, business.category, biz_metadata)

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

    if skipped_irrelevant:
        logger.info("Skipped %d irrelevant mentions for business %s", skipped_irrelevant, business_id)

    db.commit()

    total = db.query(Lead).filter(Lead.business_id == business_id).count()
    return {
        "leads_created": created,
        "total_leads": total,
        "mentions_processed": len(unprocessed),
        "skipped_irrelevant": skipped_irrelevant,
    }
