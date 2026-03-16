import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.intelligence.competitor_engine import run_competitor_engine
from app.intelligence.reputation_engine import run_reputation_engine
from app.intelligence.trend_engine import run_trend_engine
from app.models import (
    Business,
    CompetitorEvent,
    Review,
    Trend,
    User,
)
from app.schemas import (
    CompetitorEventOut,
    IntelligenceRunOut,
    ReviewOut,
    TrendOut,
)

router = APIRouter(tags=["intelligence"])


# ── Run all engines ──


@router.post(
    "/businesses/{business_id}/intelligence/run",
    response_model=IntelligenceRunOut,
)
def run_intelligence(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run all intelligence engines for a business."""
    trends_created = run_trend_engine(db, biz.id)
    competitor_events_created = run_competitor_engine(db, biz.id)
    reviews_created = run_reputation_engine(db, biz.id)

    db.commit()

    return IntelligenceRunOut(
        trends_created=trends_created,
        competitor_events_created=competitor_events_created,
        reviews_created=reviews_created,
    )


# ── Trends ──


@router.get(
    "/businesses/{business_id}/trends",
    response_model=list[TrendOut],
)
def list_trends(
    days: int = Query(30, le=90),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        db.query(Trend)
        .filter(Trend.business_id == biz.id, Trend.created_at >= cutoff)
        .order_by(Trend.spike_score.desc())
        .limit(50)
        .all()
    )


# ── Competitor Events ──


@router.get(
    "/businesses/{business_id}/competitor-events",
    response_model=list[CompetitorEventOut],
)
def list_competitor_events(
    days: int = Query(30, le=90),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        db.query(CompetitorEvent)
        .filter(CompetitorEvent.business_id == biz.id, CompetitorEvent.created_at >= cutoff)
        .order_by(CompetitorEvent.detected_at.desc())
        .limit(50)
        .all()
    )


# ── Reviews ──


@router.get(
    "/businesses/{business_id}/reviews",
    response_model=list[ReviewOut],
)
def list_reviews(
    days: int = Query(30, le=90),
    sentiment: str | None = None,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = (
        db.query(Review)
        .filter(Review.business_id == biz.id, Review.created_at >= cutoff)
    )
    if sentiment:
        query = query.filter(Review.sentiment == sentiment)
    return query.order_by(Review.created_at.desc()).limit(50).all()
