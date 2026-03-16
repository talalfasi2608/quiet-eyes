import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped
from app.intelligence.prediction_engine import run_predictions
from app.models import Business, PredictiveEntityType, PredictiveScore
from app.schemas import PredictionRequest, PredictionRunOut, PredictiveScoreOut

router = APIRouter(tags=["predictions"])


@router.post("/businesses/{business_id}/predictions/run", response_model=PredictionRunOut)
def generate_predictions(
    body: PredictionRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    entity_type = body.entity_type.upper()
    if entity_type not in ("LEAD", "AUDIENCE", "CAMPAIGN"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid entity_type. Must be LEAD, AUDIENCE, or CAMPAIGN.")

    count = run_predictions(db, biz.id, entity_type, body.entity_ids)
    return PredictionRunOut(predictions_created=count, entity_type=entity_type)


@router.get("/businesses/{business_id}/predictions", response_model=list[PredictiveScoreOut])
def list_predictions(
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    limit: int = Query(50, le=100),
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    query = db.query(PredictiveScore).filter(PredictiveScore.business_id == biz.id)
    if entity_type:
        query = query.filter(PredictiveScore.entity_type == entity_type.upper())
    if entity_id:
        query = query.filter(PredictiveScore.entity_id == entity_id)
    return query.order_by(PredictiveScore.created_at.desc()).limit(limit).all()


@router.get("/businesses/{business_id}/predictions/lead/{lead_id}", response_model=PredictiveScoreOut | None)
def get_lead_prediction(
    lead_id: uuid.UUID,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(PredictiveScore)
        .filter(
            PredictiveScore.business_id == biz.id,
            PredictiveScore.entity_type == PredictiveEntityType.LEAD,
            PredictiveScore.entity_id == lead_id,
        )
        .order_by(PredictiveScore.created_at.desc())
        .first()
    )


@router.get("/businesses/{business_id}/predictions/campaign/{campaign_id}", response_model=PredictiveScoreOut | None)
def get_campaign_prediction(
    campaign_id: uuid.UUID,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(PredictiveScore)
        .filter(
            PredictiveScore.business_id == biz.id,
            PredictiveScore.entity_type == PredictiveEntityType.CAMPAIGN,
            PredictiveScore.entity_id == campaign_id,
        )
        .order_by(PredictiveScore.created_at.desc())
        .first()
    )
