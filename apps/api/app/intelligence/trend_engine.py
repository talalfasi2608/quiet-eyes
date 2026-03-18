"""
Trend Engine v2: detect relevant keyword/topic spikes from mentions.

Improvements over v1:
- Extended stopword list covering generic web/review phrases
- Business relevance scoring against category and keywords
- Bigram quality filtering
- Noise suppression for common fragments
- Clustering of related topics
"""

import logging
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Business, Mention, Trend

logger = logging.getLogger(__name__)

# ── Stopwords: core English + generic web/review/business noise ──

STOPWORDS = {
    # Core English
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "because", "but", "and",
    "or", "if", "while", "that", "this", "it", "its", "i", "me", "my",
    "we", "our", "you", "your", "he", "she", "they", "them", "their",
    "what", "which", "who", "whom", "about", "up", "down", "also",
    # Web / review noise
    "http", "https", "www", "com", "org", "net", "html", "php",
    "review", "reviews", "photos", "photo", "phone", "number",
    "see", "unbiased", "rated", "tripadvisor", "yelp", "google",
    "restaurant", "menu", "hours", "open", "closed", "map", "directions",
    "read", "write", "post", "posted", "share", "click", "view",
    "website", "page", "site", "link", "online", "search",
    "updated", "march", "february", "january", "april", "june", "july",
    "august", "september", "october", "november", "december", "2026", "2025", "2024",
    # Generic sentiment / quality words (not trends)
    "great", "good", "nice", "best", "better", "worst", "bad",
    "perfect", "excellent", "amazing", "wonderful", "terrible", "awful",
    "love", "like", "enjoy", "hate", "recommend", "recommended",
    "free", "new", "old", "big", "small", "really", "quite",
    "experience", "service", "quality", "price", "value", "staff",
    "definitely", "absolutely", "basically", "actually", "probably",
    # Structural web phrases
    "overview", "news", "similar", "companies", "company", "offers",
    "information", "details", "description", "contact", "address",
    "friendly", "simple", "makes", "including", "provides",
}

# Bigram stopwords: specific meaningless bigram combos
BIGRAM_STOPWORDS = {
    "photos phone", "phone number", "reviews photos", "overview news",
    "similar companies", "news similar", "friendly simple",
    "read reviews", "write review", "see photos", "view photos",
    "rated tripadvisor", "hours open", "open closed",
    "updated march", "updated february", "updated january",
}

MIN_WORD_LEN = 3
MIN_SPIKE_SCORE = 35
MIN_MENTIONS_FOR_TREND = 2
MAX_TRENDS = 10


def _extract_keywords(text: str) -> list[str]:
    """Extract meaningful keywords from text."""
    words = re.findall(r"[a-zA-Z\u0590-\u05FF]{3,}", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) >= MIN_WORD_LEN]


def _extract_bigrams(text: str) -> list[str]:
    """Extract quality 2-word phrases."""
    words = re.findall(r"[a-zA-Z\u0590-\u05FF]{3,}", text.lower())
    words = [w for w in words if w not in STOPWORDS]
    bigrams = []
    for i in range(len(words) - 1):
        bg = f"{words[i]} {words[i+1]}"
        if bg not in BIGRAM_STOPWORDS:
            bigrams.append(bg)
    return bigrams


def _compute_relevance(
    topic: str,
    business_name: str,
    category: str | None,
    keywords: str | None,
    competitor_names: list[str],
) -> float:
    """
    Score 0.0-1.0 for how relevant a topic is to this business.

    High relevance:
    - Topic contains business name or competitor name
    - Topic matches a keyword from onboarding
    - Topic relates to the business category

    Low relevance:
    - Generic phrases unrelated to the business
    """
    topic_lower = topic.lower()
    score = 0.0

    # Business name match: very relevant
    if business_name and business_name.lower() in topic_lower:
        score += 1.0
        return min(1.0, score)

    # Competitor name match: very relevant
    for comp in competitor_names:
        if comp.lower() in topic_lower:
            score += 0.9
            return min(1.0, score)

    # Keyword match from onboarding
    if keywords:
        kw_list = [k.strip().lower() for k in keywords.split(",") if k.strip()]
        for kw in kw_list:
            if kw in topic_lower or topic_lower in kw:
                score += 0.7
                return min(1.0, score)
            # Partial word overlap
            for word in kw.split():
                if word in topic_lower.split():
                    score += 0.3
                    break

    # Category match
    if category:
        cat_lower = category.lower().replace("_", " ")
        cat_words = set(cat_lower.split())
        topic_words = set(topic_lower.split())
        if cat_words & topic_words:
            score += 0.4

    # Location-related terms get a small boost
    # (locations are inherently relevant to local businesses)
    if score == 0.0:
        # If nothing matches at all, it's noise
        score = 0.1

    return min(1.0, score)


def _cluster_topics(
    spikes: list[tuple[str, int, float]],
) -> list[tuple[str, int, float, list[str]]]:
    """
    Cluster related topics by shared root words.

    Groups all topics that share a significant word (e.g., all "cafelix *"
    merge under the highest-scoring "cafelix" topic).

    Returns: [(topic, spike_score, relevance, merged_topics)]
    """
    if not spikes:
        return []

    # Build a word → topics mapping
    word_to_topics: dict[str, list[int]] = {}
    for idx, (topic, spike, relevance) in enumerate(spikes):
        for word in topic.split():
            if len(word) >= 4:  # Only cluster on meaningful words
                if word not in word_to_topics:
                    word_to_topics[word] = []
                word_to_topics[word].append(idx)

    # Find clusters: groups of topics sharing a word
    consumed: set[int] = set()
    clusters: list[tuple[str, int, float, list[str]]] = []

    # Sort words by cluster size (largest first = most important root word)
    sorted_words = sorted(word_to_topics.items(), key=lambda x: -len(x[1]))

    for root_word, topic_indices in sorted_words:
        # Only cluster if there are multiple related topics
        unclaimed = [i for i in topic_indices if i not in consumed]
        if len(unclaimed) < 2:
            continue

        # Find the best topic to represent this cluster
        best_idx = max(unclaimed, key=lambda i: (spikes[i][2], spikes[i][1]))
        best_topic, best_spike, best_rel = spikes[best_idx]

        merged_names = []
        for i in unclaimed:
            consumed.add(i)
            merged_names.append(spikes[i][0])
            best_spike = max(best_spike, spikes[i][1])
            best_rel = max(best_rel, spikes[i][2])

        # Use the root word as the cluster label if it's cleaner
        if len(merged_names) >= 3:
            cluster_label = root_word
        else:
            cluster_label = best_topic

        clusters.append((cluster_label, best_spike, best_rel, merged_names))

    # Add unclaimed standalone topics
    for idx, (topic, spike, relevance) in enumerate(spikes):
        if idx not in consumed:
            clusters.append((topic, spike, relevance, [topic]))

    # Sort by relevance first, then spike score
    clusters.sort(key=lambda x: (-x[2], -x[1]))
    return clusters


def run_trend_engine(db: Session, business_id: uuid.UUID) -> int:
    """
    Detect relevant topic spikes for a business.
    Filters noise, scores relevance, and clusters related topics.
    Returns count of new trends created.
    """
    business = db.get(Business, business_id)
    if not business:
        return 0

    metadata = business.client_metadata or {}
    keywords = metadata.get("keywords", "")
    from app.models import Competitor
    competitors = db.query(Competitor).filter(Competitor.business_id == business_id).all()
    competitor_names = [c.name for c in competitors]

    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=3)
    baseline_start = now - timedelta(days=17)

    # Get recent mentions (last 3 days)
    recent_mentions = (
        db.query(Mention)
        .filter(
            Mention.business_id == business_id,
            Mention.fetched_at >= recent_cutoff,
        )
        .all()
    )

    # Get baseline mentions (days 4-17)
    baseline_mentions = (
        db.query(Mention)
        .filter(
            Mention.business_id == business_id,
            Mention.fetched_at >= baseline_start,
            Mention.fetched_at < recent_cutoff,
        )
        .all()
    )

    if not recent_mentions:
        return 0

    # Count keywords in both windows
    recent_counts: Counter[str] = Counter()
    recent_urls: dict[str, list[str]] = {}
    recent_times: dict[str, tuple[datetime, datetime]] = {}

    for m in recent_mentions:
        text = f"{m.title or ''} {m.snippet or ''}"
        kws = _extract_keywords(text) + _extract_bigrams(text)
        for kw in set(kws):
            recent_counts[kw] += 1
            if kw not in recent_urls:
                recent_urls[kw] = []
            if m.url and m.url not in recent_urls[kw] and len(recent_urls[kw]) < 5:
                recent_urls[kw].append(m.url)
            ts = m.fetched_at
            if kw not in recent_times:
                recent_times[kw] = (ts, ts)
            else:
                first, last = recent_times[kw]
                recent_times[kw] = (min(first, ts), max(last, ts))

    baseline_counts: Counter[str] = Counter()
    for m in baseline_mentions:
        text = f"{m.title or ''} {m.snippet or ''}"
        kws = _extract_keywords(text) + _extract_bigrams(text)
        for kw in set(kws):
            baseline_counts[kw] += 1

    # Compute spike scores with relevance filtering
    spikes: list[tuple[str, int, float]] = []
    for kw, recent_count in recent_counts.items():
        if recent_count < MIN_MENTIONS_FOR_TREND:
            continue

        baseline_count = baseline_counts.get(kw, 0)
        recent_rate = recent_count / 3.0
        baseline_rate = (baseline_count / 14.0) if baseline_count > 0 else 0.1

        ratio = recent_rate / baseline_rate
        spike_score = min(100, int(ratio * 20))

        if spike_score < MIN_SPIKE_SCORE:
            continue

        # Compute business relevance
        relevance = _compute_relevance(
            kw, business.name, business.category, keywords, competitor_names
        )

        # Skip very low relevance topics
        if relevance < 0.15:
            continue

        # Boost spike score by relevance (relevant trends get priority)
        adjusted_spike = int(spike_score * (0.5 + 0.5 * relevance))
        spikes.append((kw, adjusted_spike, relevance))

    # Cluster related topics
    clustered = _cluster_topics(spikes)

    # Take top N
    top_trends = clustered[:MAX_TRENDS]

    # Deduplicate against existing trends from last 7 days
    recent_trend_topics = set(
        t[0] for t in
        db.query(Trend.topic)
        .filter(
            Trend.business_id == business_id,
            Trend.created_at >= now - timedelta(days=7),
        )
        .all()
    )

    created = 0
    for topic, spike_score, relevance, merged in top_trends:
        if topic in recent_trend_topics:
            continue

        first_seen, last_seen = recent_times.get(topic, (now, now))
        trend = Trend(
            business_id=business_id,
            topic=topic,
            spike_score=spike_score,
            window_days=7,
            evidence_urls=recent_urls.get(topic, []),
            first_seen_at=first_seen,
            last_seen_at=last_seen,
        )
        db.add(trend)
        created += 1

    if created:
        db.flush()

    return created
