"""AI cost optimization — caching, fallback rules, and budget gates.

Reduces unnecessary LLM calls by:
1. Caching recent AI results with content-hash keys
2. Providing rule-based fallbacks that skip AI when possible
3. Checking AI budget before making calls
"""

import hashlib
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# Simple in-memory cache (TTL-based)
# In production, replace with Redis cache
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _cache_key(prefix: str, content: str) -> str:
    """Generate a cache key from prefix + content hash."""
    content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
    return f"{prefix}:{content_hash}"


def get_cached(prefix: str, content: str) -> Any | None:
    """Get a cached result if available and not expired."""
    key = _cache_key(prefix, content)
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, value = entry
    if time.time() - ts > CACHE_TTL_SECONDS:
        del _cache[key]
        return None
    return value


def set_cached(prefix: str, content: str, value: Any) -> None:
    """Cache a result."""
    key = _cache_key(prefix, content)
    _cache[key] = (time.time(), value)

    # Evict old entries if cache grows too large (simple LRU-ish)
    if len(_cache) > 10000:
        cutoff = time.time() - CACHE_TTL_SECONDS
        expired = [k for k, (ts, _) in _cache.items() if ts < cutoff]
        for k in expired:
            del _cache[k]


def clear_cache() -> int:
    """Clear the entire cache. Returns number of entries cleared."""
    count = len(_cache)
    _cache.clear()
    return count


# ── Rule-based fallbacks ──


def can_skip_lead_scoring(mention_snippet: str | None) -> bool:
    """Determine if we can skip AI-based lead scoring and use rules instead.

    Returns True if the mention is clearly low-value and can be scored with rules.
    """
    if not mention_snippet:
        return True  # No content = no AI needed

    snippet = mention_snippet.lower()
    low_value_indicators = [
        "job posting", "hiring", "career", "we are hiring",
        "press release", "stock price", "earnings report",
        "cookie policy", "privacy policy", "terms of service",
    ]
    return any(indicator in snippet for indicator in low_value_indicators)


def rule_based_lead_score(mention_snippet: str | None) -> dict:
    """Generate a basic lead score without AI. Used as fallback."""
    if not mention_snippet:
        return {"score": 10, "confidence": 30, "intent": "OTHER", "source": "rule_fallback"}

    snippet = mention_snippet.lower()

    # Simple keyword-based scoring
    high_intent_words = ["recommend", "looking for", "need", "searching", "anyone know", "suggestion"]
    medium_intent_words = ["review", "compared", "alternative", "vs", "versus", "opinion"]
    negative_words = ["complaint", "terrible", "worst", "scam", "avoid"]

    score = 30  # baseline
    intent = "OTHER"

    if any(w in snippet for w in high_intent_words):
        score = 70
        intent = "PURCHASE"
    elif any(w in snippet for w in medium_intent_words):
        score = 50
        intent = "COMPARISON"
    elif any(w in snippet for w in negative_words):
        score = 60
        intent = "COMPLAINT"

    return {
        "score": score,
        "confidence": 40,
        "intent": intent,
        "source": "rule_fallback",
    }


def should_use_ai(db, org_id, operation: str) -> bool:
    """Gate: decide whether to use AI or fall back to rules.

    Considers: AI budget remaining, operation priority, plan tier.
    """
    from app.cost_tracker import check_ai_budget

    if not check_ai_budget(db, org_id):
        logger.info("AI budget exhausted for org %s, falling back to rules for %s", org_id, operation)
        return False

    return True
