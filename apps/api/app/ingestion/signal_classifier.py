"""
Signal classifier — classifies raw mentions into signal types before they become leads.

Signal types:
- HIGH_INTENT: purchasing signals, active search, switching intent
- REPUTATION: reviews, ratings, testimonials
- TREND: industry news, emerging topics
- COMPETITOR: competitor activity, pricing, launches
- NOISE: irrelevant content, generic articles, structural pages

This classifier runs on the raw mention text and source metadata to help
downstream agents prioritize signals.
"""

import re
from enum import Enum


class SignalType(str, Enum):
    HIGH_INTENT = "HIGH_INTENT"
    REPUTATION = "REPUTATION"
    TREND = "TREND"
    COMPETITOR = "COMPETITOR"
    NOISE = "NOISE"


# High-intent patterns (active buying/switching signals)
HIGH_INTENT_PATTERNS = [
    r"looking for\b",
    r"need (a|to find)\b",
    r"want to (buy|get|try|switch)",
    r"searching for\b",
    r"where (can|do) (i|we) (buy|get|find)",
    r"recommend .*(tool|service|product|platform|place|shop|restaurant)",
    r"best .* (for|in|near)\b",
    r"alternative to\b",
    r"switch(ing)? from\b",
    r"moving away from\b",
    r"anyone tried\b",
    r"suggestions for\b",
    r"what do you use\b",
    r"vs\b.*\bvs\b",
]

# Reputation patterns (review/rating signals)
REPUTATION_PATTERNS = [
    r"\b\d(\.\d)?\s*/\s*5\b",
    r"\b(1|2|3|4|5)\s*star",
    r"\breview(s|ed)?\b",
    r"\brated\b",
    r"\btestimonial\b",
    r"\bfeedback\b",
    r"\bcomplaint\b",
    r"\bdisappointed\b",
    r"\bhighly recommend\b",
    r"\bnot recommended\b",
    r"\bterrible\b",
    r"\bexcellent\b",
]

# Competitor patterns
COMPETITOR_PATTERNS = [
    r"\b(new|launch|announc|introducing|unveiling)\b",
    r"\b(price|pricing|discount|sale|promo)\b",
    r"\b(rebrand|redesign|new look)\b",
    r"\b(campaign|advertisement)\b",
]

# Noise patterns (generic/structural content)
NOISE_PATTERNS = [
    r"^(privacy policy|terms of service|cookie policy)",
    r"\b(sign up|log in|create account|forgot password)\b",
    r"^(404|page not found|error)",
    r"\b(unsubscribe|opt.out|manage preferences)\b",
]


def classify_signal(
    title: str,
    snippet: str,
    source_type: str | None = None,
    source_name: str | None = None,
    raw_json: dict | None = None,
    competitor_names: list[str] | None = None,
) -> tuple[SignalType, int]:
    """
    Classify a mention into a signal type with a priority score (0-100).

    Returns: (signal_type, priority_score)
    """
    text = f"{title} {snippet}".lower()
    raw = raw_json or {}
    competitor_names = competitor_names or []

    # Check noise first (early exit)
    for pattern in NOISE_PATTERNS:
        if re.search(pattern, text):
            return SignalType.NOISE, 0

    # Content too short = noise
    if len(text.strip()) < 20:
        return SignalType.NOISE, 0

    # Scoring accumulators
    scores: dict[SignalType, int] = {
        SignalType.HIGH_INTENT: 0,
        SignalType.REPUTATION: 0,
        SignalType.COMPETITOR: 0,
        SignalType.TREND: 0,
    }

    # High-intent patterns
    for pattern in HIGH_INTENT_PATTERNS:
        if re.search(pattern, text):
            scores[SignalType.HIGH_INTENT] += 30
            break

    # Reputation patterns
    for pattern in REPUTATION_PATTERNS:
        if re.search(pattern, text):
            scores[SignalType.REPUTATION] += 25
            break

    # Review source boost
    if source_type in ("REVIEWS",):
        scores[SignalType.REPUTATION] += 20
    if source_name and any(s in (source_name or "").lower() for s in ("google places", "yelp", "trustpilot")):
        scores[SignalType.REPUTATION] += 15

    # Rating in raw_json
    rating = raw.get("rating")
    if rating is not None:
        scores[SignalType.REPUTATION] += 20
        if isinstance(rating, (int, float)) and rating <= 2:
            scores[SignalType.HIGH_INTENT] += 15  # Low rating = switching opportunity

    # Competitor mention check
    for comp in competitor_names:
        if comp.lower() in text:
            scores[SignalType.COMPETITOR] += 25
            # Competitor + complaint = HIGH_INTENT (switching signal)
            if scores[SignalType.REPUTATION] > 0 or "complaint" in text or "frustrated" in text:
                scores[SignalType.HIGH_INTENT] += 20
            break

    # Competitor patterns
    for pattern in COMPETITOR_PATTERNS:
        if re.search(pattern, text):
            scores[SignalType.COMPETITOR] += 10
            break

    # Social source boost for intent
    if source_type == "SOCIAL":
        scores[SignalType.HIGH_INTENT] += 10

    # Reddit-specific boosts
    if source_name and "reddit" in source_name.lower():
        scores[SignalType.HIGH_INTENT] += 5

    # Default: if nothing matches well, it's a trend signal
    if all(v < 15 for v in scores.values()):
        scores[SignalType.TREND] = 20

    # Pick the highest-scoring signal type
    best_type = max(scores, key=lambda k: scores[k])
    best_score = scores[best_type]

    # Normalize priority to 0-100
    priority = min(100, best_score)

    return best_type, priority
