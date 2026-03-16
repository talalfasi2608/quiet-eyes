"""
Trend Engine v1: detect keyword/topic spikes from mentions.
Compares keyword frequency in the last 3 days vs the previous 14 days.
"""

import logging
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Business, Mention, Trend

logger = logging.getLogger(__name__)

# Common stopwords to ignore
STOPWORDS = {
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
}

# Minimum word length after stripping
MIN_WORD_LEN = 3


def _extract_keywords(text: str) -> list[str]:
    """Extract meaningful keywords from text."""
    words = re.findall(r"[a-zA-Z\u0590-\u05FF]{3,}", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) >= MIN_WORD_LEN]


def _extract_bigrams(text: str) -> list[str]:
    """Extract 2-word phrases for better topic detection."""
    words = re.findall(r"[a-zA-Z\u0590-\u05FF]{3,}", text.lower())
    words = [w for w in words if w not in STOPWORDS]
    bigrams = []
    for i in range(len(words) - 1):
        bigrams.append(f"{words[i]} {words[i+1]}")
    return bigrams


def run_trend_engine(db: Session, business_id: uuid.UUID) -> int:
    """
    Detect topic spikes for a business.
    Returns count of new trends created.
    """
    business = db.get(Business, business_id)
    if not business:
        return 0

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
        keywords = _extract_keywords(text) + _extract_bigrams(text)
        for kw in set(keywords):
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
        keywords = _extract_keywords(text) + _extract_bigrams(text)
        for kw in set(keywords):
            baseline_counts[kw] += 1

    # Compute spike score: ratio of recent frequency to baseline frequency
    # Normalize by window size: recent=3 days, baseline=14 days
    spikes: list[tuple[str, int]] = []
    for kw, recent_count in recent_counts.items():
        if recent_count < 2:
            continue  # need at least 2 mentions

        baseline_count = baseline_counts.get(kw, 0)
        # Normalize: recent rate per day vs baseline rate per day
        recent_rate = recent_count / 3.0
        baseline_rate = (baseline_count / 14.0) if baseline_count > 0 else 0.1

        ratio = recent_rate / baseline_rate
        # Convert ratio to a 0-100 spike score
        spike_score = min(100, int(ratio * 20))

        if spike_score >= 30:
            spikes.append((kw, spike_score))

    # Sort by spike score, take top 10
    spikes.sort(key=lambda x: x[1], reverse=True)
    top_spikes = spikes[:10]

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
    for topic, spike_score in top_spikes:
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
