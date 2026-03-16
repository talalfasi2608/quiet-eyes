import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import (
    Business,
    GlobalConfig,
    Org,
    Partner,
    PartnerOrg,
    PartnerReferral,
    PartnerStatus,
    PartnerUser,
    ReferralStatus,
    RegionalConfig,
    Subscription,
    SubscriptionStatus,
    User,
)
from app.schemas import (
    GlobalConfigCreateRequest,
    GlobalConfigOut,
    GlobalConfigUpdateRequest,
    PartnerAnalyticsOut,
    PartnerCreateRequest,
    PartnerOrgOut,
    PartnerOut,
    PartnerReferralCreateRequest,
    PartnerReferralOut,
    PartnerUpdateRequest,
    PartnerUserOut,
    RegionalConfigCreateRequest,
    RegionalConfigOut,
    RegionalConfigUpdateRequest,
)

router = APIRouter(tags=["partners"])


# ── Helper: get partner for current user ──

def _get_partner_for_user(db: Session, user: User) -> Partner:
    """Resolve the partner entity that the current user belongs to."""
    pu = db.query(PartnerUser).filter(PartnerUser.user_id == user.id).first()
    if not pu:
        raise HTTPException(status_code=403, detail="Not a partner user")
    partner = db.get(Partner, pu.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


# ═══════════════════════════════════════════
#  Partner CRUD (admin-level)
# ═══════════════════════════════════════════


@router.post("/partners", response_model=PartnerOut, status_code=201)
def create_partner(
    body: PartnerCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(Partner).filter(Partner.contact_email == body.contact_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Partner with this email already exists")

    partner = Partner(
        name=body.name,
        contact_email=body.contact_email,
        contact_name=body.contact_name,
        region=body.region,
        tier=body.tier,
        commission_pct=body.commission_pct,
        status=PartnerStatus.ACTIVE,
    )
    db.add(partner)
    db.flush()

    # Auto-link the creating user as partner admin
    pu = PartnerUser(partner_id=partner.id, user_id=user.id, role="admin")
    db.add(pu)

    db.commit()
    db.refresh(partner)
    return partner


@router.get("/partners/me", response_model=PartnerOut)
def get_my_partner(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _get_partner_for_user(db, user)


@router.patch("/partners/{partner_id}", response_model=PartnerOut)
def update_partner(
    partner_id: uuid.UUID,
    body: PartnerUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(partner, key, val)

    db.commit()
    db.refresh(partner)
    return partner


# ═══════════════════════════════════════════
#  Partner → Org management
# ═══════════════════════════════════════════


@router.post("/partners/{partner_id}/orgs/{org_id}", response_model=PartnerOrgOut, status_code=201)
def link_org_to_partner(
    partner_id: uuid.UUID,
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    org = db.get(Org, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing = db.query(PartnerOrg).filter(
        PartnerOrg.partner_id == partner_id,
        PartnerOrg.org_id == org_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already linked")

    link = PartnerOrg(partner_id=partner_id, org_id=org_id)
    db.add(link)
    org.partner_id = partner_id
    db.commit()
    db.refresh(link)
    return link


@router.get("/partners/{partner_id}/orgs", response_model=list[PartnerOrgOut])
def list_partner_orgs(
    partner_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")
    return db.query(PartnerOrg).filter(PartnerOrg.partner_id == partner_id).all()


@router.delete("/partners/{partner_id}/orgs/{org_id}", status_code=204)
def unlink_org_from_partner(
    partner_id: uuid.UUID,
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    link = db.query(PartnerOrg).filter(
        PartnerOrg.partner_id == partner_id,
        PartnerOrg.org_id == org_id,
    ).first()
    if link:
        db.delete(link)
        org = db.get(Org, org_id)
        if org and org.partner_id == partner_id:
            org.partner_id = None
        db.commit()


# ═══════════════════════════════════════════
#  Partner team users
# ═══════════════════════════════════════════


@router.post("/partners/{partner_id}/users/{user_id}", response_model=PartnerUserOut, status_code=201)
def add_partner_user(
    partner_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str = Query("member"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(PartnerUser).filter(
        PartnerUser.partner_id == partner_id,
        PartnerUser.user_id == user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already linked")

    pu = PartnerUser(partner_id=partner_id, user_id=user_id, role=role)
    db.add(pu)
    db.commit()
    db.refresh(pu)
    return pu


@router.get("/partners/{partner_id}/users", response_model=list[PartnerUserOut])
def list_partner_users(
    partner_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")
    return db.query(PartnerUser).filter(PartnerUser.partner_id == partner_id).all()


# ═══════════════════════════════════════════
#  Referral system
# ═══════════════════════════════════════════


@router.post("/partners/{partner_id}/referrals", response_model=PartnerReferralOut, status_code=201)
def create_referral(
    partner_id: uuid.UUID,
    body: PartnerReferralCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    code = f"ref-{secrets.token_urlsafe(8)}"
    referral = PartnerReferral(
        partner_id=partner_id,
        referral_code=code,
        invitee_email=body.invitee_email,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)
    return referral


@router.get("/partners/{partner_id}/referrals", response_model=list[PartnerReferralOut])
def list_referrals(
    partner_id: uuid.UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    query = db.query(PartnerReferral).filter(PartnerReferral.partner_id == partner_id)
    if status:
        query = query.filter(PartnerReferral.status == status.upper())
    return query.order_by(PartnerReferral.created_at.desc()).all()


@router.post("/referrals/{referral_code}/accept", response_model=PartnerReferralOut)
def accept_referral(
    referral_code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Called by a business user to accept a partner referral."""
    referral = db.query(PartnerReferral).filter(PartnerReferral.referral_code == referral_code).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    if referral.status != ReferralStatus.PENDING:
        raise HTTPException(status_code=400, detail="Referral is not pending")

    referral.status = ReferralStatus.ACCEPTED
    referral.org_id = user.org_id
    referral.accepted_at = datetime.now(timezone.utc)

    # Link org to partner
    existing_link = db.query(PartnerOrg).filter(
        PartnerOrg.partner_id == referral.partner_id,
        PartnerOrg.org_id == user.org_id,
    ).first()
    if not existing_link:
        db.add(PartnerOrg(partner_id=referral.partner_id, org_id=user.org_id))
        org = db.get(Org, user.org_id)
        if org:
            org.partner_id = referral.partner_id

    db.commit()
    db.refresh(referral)
    return referral


# ═══════════════════════════════════════════
#  Partner analytics
# ═══════════════════════════════════════════


@router.get("/partners/{partner_id}/analytics", response_model=PartnerAnalyticsOut)
def partner_analytics(
    partner_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    org_links = db.query(PartnerOrg).filter(PartnerOrg.partner_id == partner_id).all()
    org_ids = [link.org_id for link in org_links]

    total_businesses = 0
    active_subs = 0
    if org_ids:
        total_businesses = db.query(Business).filter(Business.org_id.in_(org_ids)).count()
        active_subs = db.query(Subscription).filter(
            Subscription.org_id.in_(org_ids),
            Subscription.status == SubscriptionStatus.ACTIVE,
        ).count()

    total_referrals = db.query(PartnerReferral).filter(PartnerReferral.partner_id == partner_id).count()
    accepted = db.query(PartnerReferral).filter(
        PartnerReferral.partner_id == partner_id,
        PartnerReferral.status == ReferralStatus.ACCEPTED,
    ).count()

    # Rough revenue estimate: active_subs * average plan price * commission
    avg_monthly_revenue = active_subs * 49.0  # assume Pro average
    estimated_revenue = avg_monthly_revenue * (partner.commission_pct or 10.0) / 100.0

    return PartnerAnalyticsOut(
        total_orgs=len(org_ids),
        total_businesses=total_businesses,
        total_referrals=total_referrals,
        accepted_referrals=accepted,
        active_subscriptions=active_subs,
        estimated_revenue=round(estimated_revenue, 2),
    )


# ═══════════════════════════════════════════
#  Partner portfolio (businesses overview)
# ═══════════════════════════════════════════


@router.get("/partners/{partner_id}/portfolio")
def partner_portfolio(
    partner_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    partner = _get_partner_for_user(db, user)
    if partner.id != partner_id:
        raise HTTPException(status_code=403, detail="Not your partner account")

    org_links = db.query(PartnerOrg).filter(PartnerOrg.partner_id == partner_id).all()
    org_ids = [link.org_id for link in org_links]

    results = []
    for org_id in org_ids:
        org = db.get(Org, org_id)
        if not org:
            continue
        businesses = db.query(Business).filter(Business.org_id == org_id).all()
        sub = db.query(Subscription).filter(Subscription.org_id == org_id).first()
        results.append({
            "org_id": str(org_id),
            "org_name": org.name,
            "display_name": org.display_name,
            "business_count": len(businesses),
            "businesses": [
                {"id": str(b.id), "name": b.name, "category": b.category, "region": b.region}
                for b in businesses
            ],
            "subscription_status": sub.status.value if sub else None,
            "plan": sub.plan.value if sub else None,
        })

    return results


# ═══════════════════════════════════════════
#  Regional configuration
# ═══════════════════════════════════════════


@router.post("/config/regions", response_model=RegionalConfigOut, status_code=201)
def create_regional_config(
    body: RegionalConfigCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(RegionalConfig).filter(RegionalConfig.region_code == body.region_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Region already configured")

    rc = RegionalConfig(**body.model_dump())
    db.add(rc)
    db.commit()
    db.refresh(rc)
    return rc


@router.get("/config/regions", response_model=list[RegionalConfigOut])
def list_regional_configs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(RegionalConfig).order_by(RegionalConfig.region_code).all()


@router.get("/config/regions/{region_code}", response_model=RegionalConfigOut)
def get_regional_config(
    region_code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rc = db.query(RegionalConfig).filter(RegionalConfig.region_code == region_code).first()
    if not rc:
        raise HTTPException(status_code=404, detail="Region not found")
    return rc


@router.patch("/config/regions/{region_code}", response_model=RegionalConfigOut)
def update_regional_config(
    region_code: str,
    body: RegionalConfigUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rc = db.query(RegionalConfig).filter(RegionalConfig.region_code == region_code).first()
    if not rc:
        raise HTTPException(status_code=404, detail="Region not found")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(rc, key, val)

    db.commit()
    db.refresh(rc)
    return rc


# ═══════════════════════════════════════════
#  Global configuration
# ═══════════════════════════════════════════


@router.post("/config/global", response_model=GlobalConfigOut, status_code=201)
def create_global_config(
    body: GlobalConfigCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(GlobalConfig).filter(
        GlobalConfig.config_type == body.config_type,
        GlobalConfig.config_key == body.config_key,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Config already exists")

    gc = GlobalConfig(**body.model_dump())
    db.add(gc)
    db.commit()
    db.refresh(gc)
    return gc


@router.get("/config/global", response_model=list[GlobalConfigOut])
def list_global_configs(
    config_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(GlobalConfig)
    if config_type:
        query = query.filter(GlobalConfig.config_type == config_type)
    return query.order_by(GlobalConfig.config_type, GlobalConfig.config_key).all()


@router.patch("/config/global/{config_id}", response_model=GlobalConfigOut)
def update_global_config(
    config_id: uuid.UUID,
    body: GlobalConfigUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    gc = db.get(GlobalConfig, config_id)
    if not gc:
        raise HTTPException(status_code=404, detail="Config not found")

    now = datetime.now(timezone.utc)
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(gc, key, val)
    gc.updated_at = now

    db.commit()
    db.refresh(gc)
    return gc


@router.delete("/config/global/{config_id}", status_code=204)
def delete_global_config(
    config_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    gc = db.get(GlobalConfig, config_id)
    if gc:
        db.delete(gc)
        db.commit()
