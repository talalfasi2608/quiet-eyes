import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import get_db
from app.deps import get_current_user, require_role
from app.models import (
    Approval,
    ApprovalStatus,
    AuditLog,
    Business,
    BusinessAccess,
    Campaign,
    CampaignStatus,
    Digest,
    Lead,
    LeadStatus,
    Org,
    User,
    UserRole,
)
from app.schemas import (
    AgencyBusinessSummary,
    AgencyOverviewOut,
    BusinessAccessCreateRequest,
    BusinessAccessOut,
    DigestOut,
    InviteMemberRequest,
    OrgBrandingUpdate,
    OrgMemberOut,
    OrgOut,
)

router = APIRouter(tags=["agency"])


# ── Org / Branding ──


@router.get("/org", response_model=OrgOut)
def get_org(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.get(Org, user.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return org


@router.patch("/org/branding", response_model=OrgOut)
def update_branding(
    body: OrgBrandingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
):
    org = db.get(Org, user.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")

    if body.display_name is not None:
        org.display_name = body.display_name
    if body.logo_url is not None:
        org.logo_url = body.logo_url
    if body.primary_color is not None:
        org.primary_color = body.primary_color

    db.add(AuditLog(
        org_id=org.id,
        user_id=user.id,
        event_type="ORG_BRANDING_UPDATED",
        entity_type="org",
        entity_id=org.id,
    ))

    db.commit()
    db.refresh(org)
    return org


# ── Agency Overview ──


@router.get("/agency/overview", response_model=AgencyOverviewOut)
def agency_overview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    businesses = (
        db.query(Business)
        .filter(Business.org_id == user.org_id)
        .order_by(Business.created_at.desc())
        .all()
    )

    biz_ids = [b.id for b in businesses]
    if not biz_ids:
        return AgencyOverviewOut()

    # Aggregate counts per business
    pending_counts = dict(
        db.query(Approval.business_id, func.count(Approval.id))
        .filter(Approval.business_id.in_(biz_ids), Approval.status == ApprovalStatus.PENDING)
        .group_by(Approval.business_id)
        .all()
    )

    new_lead_counts = dict(
        db.query(Lead.business_id, func.count(Lead.id))
        .filter(Lead.business_id.in_(biz_ids), Lead.status == LeadStatus.NEW)
        .group_by(Lead.business_id)
        .all()
    )

    total_lead_counts = dict(
        db.query(Lead.business_id, func.count(Lead.id))
        .filter(Lead.business_id.in_(biz_ids))
        .group_by(Lead.business_id)
        .all()
    )

    active_statuses = {CampaignStatus.DRAFT, CampaignStatus.APPROVED, CampaignStatus.EXECUTED,
                       CampaignStatus.READY_TO_PUBLISH, CampaignStatus.PUBLISH_PENDING}
    active_campaign_counts = dict(
        db.query(Campaign.business_id, func.count(Campaign.id))
        .filter(Campaign.business_id.in_(biz_ids), Campaign.status.in_(active_statuses))
        .group_by(Campaign.business_id)
        .all()
    )

    published_campaign_counts = dict(
        db.query(Campaign.business_id, func.count(Campaign.id))
        .filter(Campaign.business_id.in_(biz_ids), Campaign.status == CampaignStatus.PUBLISHED)
        .group_by(Campaign.business_id)
        .all()
    )

    summaries = []
    total_pending = 0
    total_new_leads = 0
    total_active = 0

    for b in businesses:
        pending = pending_counts.get(b.id, 0)
        new_leads = new_lead_counts.get(b.id, 0)
        active = active_campaign_counts.get(b.id, 0)
        total_pending += pending
        total_new_leads += new_leads
        total_active += active

        summaries.append(AgencyBusinessSummary(
            business_id=b.id,
            business_name=b.name,
            category=b.category,
            pending_approvals=pending,
            total_leads=total_lead_counts.get(b.id, 0),
            new_leads=new_leads,
            active_campaigns=active,
            published_campaigns=published_campaign_counts.get(b.id, 0),
        ))

    return AgencyOverviewOut(
        total_clients=len(businesses),
        total_pending_approvals=total_pending,
        total_new_leads=total_new_leads,
        total_active_campaigns=total_active,
        businesses=summaries,
    )


# ── Business Access Management ──


@router.post("/business-access", response_model=BusinessAccessOut, status_code=201)
def grant_business_access(
    body: BusinessAccessCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
):
    # Verify business and target user belong to same org
    biz = db.get(Business, body.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Business not found")

    target_user = db.get(User, body.user_id)
    if not target_user or target_user.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(BusinessAccess)
        .filter(BusinessAccess.user_id == body.user_id, BusinessAccess.business_id == body.business_id)
        .first()
    )
    if existing:
        return existing

    access = BusinessAccess(
        org_id=user.org_id,
        user_id=body.user_id,
        business_id=body.business_id,
    )
    db.add(access)

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="BUSINESS_ACCESS_GRANTED",
        entity_type="business_access",
        entity_id=access.id,
        meta={"target_user_id": str(body.user_id), "business_id": str(body.business_id)},
    ))

    db.commit()
    db.refresh(access)
    return access


@router.delete("/business-access/{access_id}", status_code=204)
def revoke_business_access(
    access_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
):
    access = db.get(BusinessAccess, access_id)
    if not access or access.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Access not found")

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="BUSINESS_ACCESS_REVOKED",
        entity_type="business_access",
        entity_id=access.id,
        meta={"target_user_id": str(access.user_id), "business_id": str(access.business_id)},
    ))

    db.delete(access)
    db.commit()


@router.get("/business-access", response_model=list[BusinessAccessOut])
def list_business_access(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(BusinessAccess)
        .filter(BusinessAccess.org_id == user.org_id)
        .order_by(BusinessAccess.created_at.desc())
        .all()
    )


# ── Team Members ──


@router.get("/org/members", response_model=list[OrgMemberOut])
def list_members(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    members = db.query(User).filter(User.org_id == user.org_id).all()
    result = []
    for m in members:
        accesses = (
            db.query(BusinessAccess.business_id)
            .filter(BusinessAccess.user_id == m.id)
            .all()
        )
        result.append(OrgMemberOut(
            id=m.id,
            email=m.email,
            role=m.role,
            created_at=m.created_at,
            business_access=[a[0] for a in accesses],
        ))
    return result


@router.post("/org/members/invite", response_model=OrgMemberOut, status_code=201)
def invite_member(
    body: InviteMemberRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user with a placeholder password (they'll reset it)
    new_user = User(
        org_id=user.org_id,
        email=body.email,
        password_hash=hash_password("changeme-" + uuid.uuid4().hex[:8]),
        role=body.role,
    )
    db.add(new_user)
    db.flush()

    # Grant access to specified businesses
    if body.business_ids:
        for biz_id in body.business_ids:
            biz = db.get(Business, biz_id)
            if biz and biz.org_id == user.org_id:
                db.add(BusinessAccess(
                    org_id=user.org_id,
                    user_id=new_user.id,
                    business_id=biz_id,
                ))

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="MEMBER_INVITED",
        entity_type="user",
        entity_id=new_user.id,
        meta={"email": body.email, "role": body.role.value},
    ))

    db.commit()
    db.refresh(new_user)

    accesses = (
        db.query(BusinessAccess.business_id)
        .filter(BusinessAccess.user_id == new_user.id)
        .all()
    )

    return OrgMemberOut(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        created_at=new_user.created_at,
        business_access=[a[0] for a in accesses],
    )


# ── Bulk digest view ──


@router.get("/agency/digests", response_model=list[DigestOut])
def agency_digests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    biz_ids = [b.id for b in db.query(Business.id).filter(Business.org_id == user.org_id).all()]
    if not biz_ids:
        return []
    return (
        db.query(Digest)
        .filter(Digest.business_id.in_(biz_ids))
        .order_by(Digest.date.desc())
        .limit(50)
        .all()
    )
