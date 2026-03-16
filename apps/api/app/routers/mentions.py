import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.ingestion.engine import ingest_for_business
from app.models import Business, Mention, User
from app.quota import check_quota, increment_usage
from app.schemas import IngestionResultOut, MentionOut

router = APIRouter(tags=["mentions"])


@router.get("/businesses/{business_id}/mentions", response_model=list[MentionOut])
def list_mentions(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(Mention)
        .options(joinedload(Mention.source))
        .filter(Mention.business_id == biz.id)
        .order_by(Mention.fetched_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post(
    "/businesses/{business_id}/ingest",
    response_model=IngestionResultOut,
)
async def trigger_ingestion(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger ingestion for a single business."""
    check_quota(db, biz.org_id, "scan")
    result = await ingest_for_business(biz.id)
    increment_usage(db, biz.org_id, "scan")
    db.commit()
    return result
