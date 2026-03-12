import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.models import Business, Competitor, User
from app.schemas import (
    BusinessCreate,
    BusinessOut,
    BusinessUpdate,
    CompetitorBulkRequest,
    CompetitorOut,
)

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.post("/", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    body: BusinessCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    biz = Business(org_id=user.org_id, **body.model_dump())
    db.add(biz)
    db.commit()
    db.refresh(biz)
    return biz


@router.get("/", response_model=list[BusinessOut])
def list_businesses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(Business).filter(Business.org_id == user.org_id).all()


@router.get("/{business_id}", response_model=BusinessOut)
def get_business(biz: Business = Depends(get_business_scoped)):
    return biz


@router.patch("/{business_id}", response_model=BusinessOut)
def update_business(
    body: BusinessUpdate,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(biz, field, value)
    db.commit()
    db.refresh(biz)
    return biz


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    db.delete(biz)
    db.commit()


@router.post(
    "/{business_id}/competitors", response_model=list[CompetitorOut], status_code=201
)
def bulk_add_competitors(
    body: CompetitorBulkRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    created = []
    for c in body.competitors:
        comp = Competitor(business_id=biz.id, name=c.name, website_url=c.website_url)
        db.add(comp)
        created.append(comp)
    db.commit()
    for c in created:
        db.refresh(c)
    return created


@router.get("/{business_id}/competitors", response_model=list[CompetitorOut])
def list_competitors(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return db.query(Competitor).filter(Competitor.business_id == biz.id).all()
