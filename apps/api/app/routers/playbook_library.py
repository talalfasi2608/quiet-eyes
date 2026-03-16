"""
Playbook Library & Template Marketplace API endpoints.

Endpoints:
- GET  /playbook-library                        — browse public/org playbooks
- GET  /playbook-library/{id}                    — playbook detail with versions
- POST /playbook-library/{id}/install            — install playbook to a business
- POST /playbook-library/{id}/clone              — clone & customize a playbook
- POST /businesses/{id}/playbooks/{id}/publish   — publish a business playbook to library
- GET  /template-assets                          — browse template assets
- POST /template-assets                          — create a template asset
- POST /playbook-library/seed                    — seed system library (admin)
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.intelligence.seed_library import seed_playbook_library
from app.models import (
    AuditLog,
    Business,
    Playbook,
    PlaybookInstall,
    PlaybookVersion,
    TemplateAsset,
    User,
)
from app.schemas import (
    PlaybookInstallOut,
    PlaybookInstallRequest,
    PlaybookLibraryOut,
    PlaybookOut,
    PlaybookPublishRequest,
    PlaybookVersionOut,
    TemplateAssetCreateRequest,
    TemplateAssetOut,
)

router = APIRouter(tags=["playbook-library"])


# ── Browse Library ──


@router.get(
    "/playbook-library",
    response_model=list[PlaybookLibraryOut],
)
def browse_library(
    vertical: str | None = Query(None),
    category: str | None = Query(None),
    tag: str | None = Query(None),
    creator_type: str | None = Query(None),
    q: str | None = Query(None, description="Search name/description"),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Playbook).filter(
        or_(
            Playbook.visibility == "public",
            Playbook.creator_org_id == user.org_id,
        )
    )
    if vertical:
        query = query.filter(Playbook.vertical == vertical)
    if category:
        query = query.filter(Playbook.category == category)
    if tag:
        query = query.filter(Playbook.tags.any(tag))
    if creator_type:
        query = query.filter(Playbook.creator_type == creator_type)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            or_(Playbook.name.ilike(pattern), Playbook.description.ilike(pattern))
        )

    return (
        query
        .order_by(Playbook.install_count.desc(), Playbook.created_at.desc())
        .limit(limit)
        .all()
    )


# ── Playbook Detail ──


@router.get(
    "/playbook-library/{playbook_id}",
    response_model=PlaybookOut,
)
def get_library_playbook(
    playbook_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if pb.visibility == "private" and pb.creator_org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return pb


@router.get(
    "/playbook-library/{playbook_id}/versions",
    response_model=list[PlaybookVersionOut],
)
def list_playbook_versions(
    playbook_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if pb.visibility == "private" and pb.creator_org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return (
        db.query(PlaybookVersion)
        .filter(PlaybookVersion.playbook_id == playbook_id)
        .order_by(PlaybookVersion.version.desc())
        .all()
    )


# ── Install Playbook ──


@router.post(
    "/playbook-library/{playbook_id}/install",
    response_model=PlaybookInstallOut,
    status_code=201,
)
def install_playbook(
    playbook_id: uuid.UUID,
    body: PlaybookInstallRequest,
    business_id: uuid.UUID = Query(..., description="Business to install into"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if pb.visibility == "private" and pb.creator_org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Playbook not found")

    biz = db.get(Business, business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Business not found")

    # Check if already installed
    existing = (
        db.query(PlaybookInstall)
        .filter(
            PlaybookInstall.playbook_id == playbook_id,
            PlaybookInstall.business_id == business_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Playbook already installed for this business")

    install = PlaybookInstall(
        playbook_id=playbook_id,
        business_id=business_id,
        installed_version=pb.version,
        config_overrides=body.config_overrides,
        installed_by=user.id,
    )
    db.add(install)

    pb.install_count = (pb.install_count or 0) + 1

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="PLAYBOOK_INSTALLED",
        entity_type="playbook",
        entity_id=pb.id,
        meta={"playbook_name": pb.name, "business_id": str(business_id)},
    ))

    db.commit()
    db.refresh(install)
    return install


# ── Clone Playbook ──


@router.post(
    "/playbook-library/{playbook_id}/clone",
    response_model=PlaybookOut,
    status_code=201,
)
def clone_playbook(
    playbook_id: uuid.UUID,
    business_id: uuid.UUID = Query(..., description="Business to clone into"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if pb.visibility == "private" and pb.creator_org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Playbook not found")

    biz = db.get(Business, business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Business not found")

    clone = Playbook(
        business_id=business_id,
        name=f"{pb.name} (copy)",
        description=pb.description,
        trigger_conditions=pb.trigger_conditions,
        suggested_actions=pb.suggested_actions,
        approval_policy=pb.approval_policy,
        campaign_template=pb.campaign_template,
        audience_template=pb.audience_template,
        category=pb.category,
        vertical=pb.vertical,
        tags=pb.tags,
        creator_type="user",
        visibility="private",
        version=1,
        creator_org_id=user.org_id,
        creator_user_id=user.id,
        metadata_={"cloned_from": str(playbook_id)},
    )
    db.add(clone)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="PLAYBOOK_CLONED",
        entity_type="playbook",
        entity_id=pb.id,
        meta={"source_playbook": pb.name, "business_id": str(business_id)},
    ))

    db.commit()
    db.refresh(clone)
    return clone


# ── Publish Business Playbook to Library ──


@router.post(
    "/businesses/{business_id}/playbooks/{playbook_id}/publish",
    response_model=PlaybookOut,
)
def publish_playbook(
    playbook_id: uuid.UUID,
    body: PlaybookPublishRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pb = db.get(Playbook, playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    if pb.business_id != biz.id:
        raise HTTPException(status_code=404, detail="Playbook not found")

    if body.visibility not in ("public", "organization"):
        raise HTTPException(status_code=400, detail="Visibility must be 'public' or 'organization'")

    pb.visibility = body.visibility
    pb.creator_org_id = biz.org_id
    pb.creator_user_id = user.id
    if body.category:
        pb.category = body.category
    if body.vertical:
        pb.vertical = body.vertical
    if body.tags:
        pb.tags = body.tags

    # Create a version snapshot
    pb.version = (pb.version or 0) + 1
    version = PlaybookVersion(
        playbook_id=pb.id,
        version=pb.version,
        snapshot={
            "name": pb.name,
            "description": pb.description,
            "trigger_conditions": pb.trigger_conditions,
            "suggested_actions": pb.suggested_actions,
            "approval_policy": pb.approval_policy,
            "campaign_template": pb.campaign_template,
            "audience_template": pb.audience_template,
        },
        change_notes=f"Published as {body.visibility}",
    )
    db.add(version)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="PLAYBOOK_PUBLISHED",
        entity_type="playbook",
        entity_id=pb.id,
        meta={"visibility": body.visibility, "version": pb.version},
    ))

    db.commit()
    db.refresh(pb)
    return pb


# ── Business Installs ──


@router.get(
    "/businesses/{business_id}/playbook-installs",
    response_model=list[PlaybookInstallOut],
)
def list_business_installs(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(PlaybookInstall)
        .filter(PlaybookInstall.business_id == biz.id)
        .order_by(PlaybookInstall.installed_at.desc())
        .all()
    )


@router.delete(
    "/playbook-installs/{install_id}",
    status_code=204,
)
def uninstall_playbook(
    install_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    install = db.get(PlaybookInstall, install_id)
    if not install:
        raise HTTPException(status_code=404, detail="Install not found")
    biz = db.get(Business, install.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Install not found")

    # Decrement install count
    pb = db.get(Playbook, install.playbook_id)
    if pb and pb.install_count and pb.install_count > 0:
        pb.install_count -= 1

    db.delete(install)
    db.commit()


# ── Template Assets ──


@router.get(
    "/template-assets",
    response_model=list[TemplateAssetOut],
)
def browse_template_assets(
    asset_type: str | None = Query(None, alias="type"),
    vertical: str | None = Query(None),
    tag: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(TemplateAsset).filter(
        or_(
            TemplateAsset.visibility == "public",
            TemplateAsset.creator_org_id == user.org_id,
        )
    )
    if asset_type:
        query = query.filter(TemplateAsset.type == asset_type)
    if vertical:
        query = query.filter(TemplateAsset.vertical == vertical)
    if tag:
        query = query.filter(TemplateAsset.tags.any(tag))

    return query.order_by(TemplateAsset.created_at.desc()).limit(limit).all()


@router.post(
    "/template-assets",
    response_model=TemplateAssetOut,
    status_code=201,
)
def create_template_asset(
    body: TemplateAssetCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    asset = TemplateAsset(
        type=body.type,
        name=body.name,
        description=body.description,
        vertical=body.vertical,
        content=body.content,
        tags=body.tags,
        creator_type="user",
        creator_org_id=user.org_id,
        visibility="organization",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


# ── Seed Library (Admin) ──


@router.post("/playbook-library/seed")
def seed_library(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = seed_playbook_library(db)
    return result
