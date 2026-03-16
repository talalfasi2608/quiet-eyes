"""Adaptive scan frequency — adjusts source scan intervals based on yield.

Rules:
- If a source returns results, decrease interval (more frequent scans).
- If a source returns nothing, increase interval (less frequent scans).
- Protect against expensive repeated scans on dead sources.
- Priority score influences scan order.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Source

logger = logging.getLogger(__name__)

# Interval bounds (minutes)
MIN_INTERVAL = 15
MAX_INTERVAL = 1440   # 24 hours
DEFAULT_INTERVAL = 60  # 1 hour

# After this many consecutive empty scans, slow down aggressively
SLOW_DOWN_THRESHOLD = 5


def should_scan_source(source: Source) -> bool:
    """Determine if a source is due for scanning based on its adaptive interval."""
    if not hasattr(source, "scan_interval_minutes"):
        return True

    # If no health record with last_run_at, always scan
    if not hasattr(source, "health") or not source.health:
        return True

    # Check based on health record timing
    from app.models import SourceHealth
    # Caller should check: if time since last scan >= scan_interval_minutes
    return True  # Default: always eligible, caller filters by time


def update_scan_frequency(db: Session, source: Source, results_count: int) -> None:
    """Update a source's scan frequency based on the results yielded."""
    if results_count > 0:
        # Source is productive — decrease interval, reset empty counter
        source.consecutive_empty_scans = 0
        source.last_hit_count = results_count

        # Decrease interval by 20%, but not below minimum
        new_interval = max(MIN_INTERVAL, int(source.scan_interval_minutes * 0.8))
        source.scan_interval_minutes = new_interval

        # Increase priority for productive sources
        source.priority_score = min(100, source.priority_score + 5)
    else:
        # Source returned nothing
        source.consecutive_empty_scans += 1

        if source.consecutive_empty_scans >= SLOW_DOWN_THRESHOLD:
            # Aggressively slow down
            new_interval = min(MAX_INTERVAL, source.scan_interval_minutes * 2)
        else:
            # Gradually slow down — increase interval by 25%
            new_interval = min(MAX_INTERVAL, int(source.scan_interval_minutes * 1.25))

        source.scan_interval_minutes = new_interval

        # Decrease priority for unproductive sources
        source.priority_score = max(1, source.priority_score - 3)

    db.flush()


def get_sources_due_for_scan(db: Session, business_id=None) -> list[Source]:
    """Get sources that are due for scanning, ordered by priority."""
    query = db.query(Source)

    sources = query.order_by(Source.priority_score.desc()).all()

    # Filter by sources that haven't been scanned within their interval
    # For now, return all sources ordered by priority; the caller
    # should check SourceHealth.last_run_at vs scan_interval_minutes
    due = []
    for s in sources:
        from app.models import SourceHealth
        health = db.query(SourceHealth).filter(SourceHealth.source_id == s.id).first()
        if not health or not health.last_run_at:
            due.append(s)
            continue

        next_scan_at = health.last_run_at + timedelta(minutes=s.scan_interval_minutes)
        if datetime.now(timezone.utc) >= next_scan_at:
            due.append(s)

    return due


def get_scan_stats(db: Session) -> dict:
    """Get scan frequency statistics for monitoring."""
    from sqlalchemy import func

    total_sources = db.query(func.count(Source.id)).scalar() or 0
    avg_interval = db.query(func.avg(Source.scan_interval_minutes)).scalar() or 0
    sources_at_max = (
        db.query(func.count(Source.id))
        .filter(Source.scan_interval_minutes >= MAX_INTERVAL)
        .scalar()
    ) or 0
    sources_at_min = (
        db.query(func.count(Source.id))
        .filter(Source.scan_interval_minutes <= MIN_INTERVAL)
        .scalar()
    ) or 0

    return {
        "total_sources": total_sources,
        "avg_interval_minutes": round(float(avg_interval), 1),
        "sources_at_max_interval": sources_at_max,
        "sources_at_min_interval": sources_at_min,
    }
