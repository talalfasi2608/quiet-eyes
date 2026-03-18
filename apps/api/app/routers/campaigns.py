import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user, require_permission
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    Audience,
    AuditLog,
    Business,
    Campaign,
    CampaignObjective,
    CampaignStatus,
    Integration,
    IntegrationType,
    Lead,
    Permission,
    PublishLog,
    RiskLevel,
    User,
)
from app.schemas import (
    ApprovalOut,
    CampaignDraftRequest,
    CampaignOut,
    CampaignPublishRequest,
    CampaignUpdateRequest,
    PublishLogOut,
)

router = APIRouter(tags=["campaigns"])


# ── Draft generation logic ──


PLATFORM_CTA = {
    "meta": "Learn More",
    "google": "Sign Up",
    "tiktok": "Shop Now",
}

OBJECTIVE_HEADLINES = {
    CampaignObjective.LEADS: [
        "Discover {category} solutions that work",
        "Ready to upgrade your {category}?",
    ],
    CampaignObjective.SALES: [
        "Limited offer on {category} — act now",
        "Get the best {category} at the best price",
    ],
    CampaignObjective.TRAFFIC: [
        "Explore what's new in {category}",
        "See why people love {business_name}",
    ],
}


def _build_draft(
    biz: Business,
    body: CampaignDraftRequest,
    audience_summary: str,
    targeting: list[str],
) -> dict:
    import json
    from app.ai import chat_completion

    category = biz.category or "your industry"
    biz_name = biz.name
    cta = PLATFORM_CTA.get(body.platform, "Learn More")

    budget_suggestion = body.daily_budget
    if body.objective == CampaignObjective.SALES:
        budget_suggestion = max(budget_suggestion, 75)

    # Try AI-generated creatives
    metadata = biz.client_metadata or {}
    ai_creatives = None
    ai_prompt = (
        f"Generate 3 ad creative variants for a {body.objective.value} campaign on {body.platform}.\n"
        f"Business: {biz_name}\nIndustry: {category}\n"
        f"Audience: {audience_summary}\nCTA button: {cta}\n"
    )
    if metadata.get("description"):
        ai_prompt += f"Business description: {metadata['description']}\n"
    if metadata.get("differentiation"):
        ai_prompt += f"Value proposition: {metadata['differentiation']}\n"
    if metadata.get("ideal_customer"):
        ai_prompt += f"Ideal customer: {metadata['ideal_customer']}\n"
    if metadata.get("tone"):
        ai_prompt += f"Tone: {metadata['tone']}\n"
    ai_prompt += (
        f"\nReturn ONLY a JSON array with objects containing: variant (int), headline (str), primary_text (str), cta (str).\n"
        f"Keep headlines under 40 chars. Primary text under 125 chars. Be compelling and specific."
    )
    ai_result = chat_completion(
        "You are an expert digital marketing copywriter. Return only valid JSON, no markdown.",
        ai_prompt,
        max_tokens=512,
        temperature=0.8,
    )
    if ai_result:
        try:
            # Strip markdown code fences if present
            cleaned = ai_result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            ai_creatives = json.loads(cleaned)
        except (json.JSONDecodeError, IndexError):
            ai_creatives = None

    if ai_creatives and isinstance(ai_creatives, list):
        creatives = ai_creatives
    else:
        # Fallback to template-based creatives
        headlines = OBJECTIVE_HEADLINES.get(body.objective, OBJECTIVE_HEADLINES[CampaignObjective.LEADS])
        creatives = []
        for i, headline_tpl in enumerate(headlines):
            headline = headline_tpl.format(category=category, business_name=biz_name)
            creatives.append({
                "variant": i + 1,
                "headline": headline,
                "primary_text": f"{biz_name} helps you with {category}. See how we compare.",
                "cta": cta,
            })
        creatives.append({
            "variant": len(creatives) + 1,
            "headline": f"{biz_name} — trusted by professionals",
            "primary_text": f"Join thousands who rely on {biz_name} for {category}.",
            "cta": cta,
        })

    return {
        "objective": body.objective.value,
        "platform": body.platform,
        "budget_suggestion": budget_suggestion,
        "audience_summary": audience_summary,
        "targeting_suggestions": targeting,
        "creatives": creatives,
        "utm": {
            "utm_source": body.platform,
            "utm_medium": "paid",
            "utm_campaign": f"qe_{body.objective.value.lower()}_{biz.id.hex[:8]}",
            "utm_content": "variant_{{variant}}",
        },
        "schedule_suggestion": {
            "start": "next_business_day",
            "duration_days": 14,
            "daily_budget": budget_suggestion,
        },
    }


def _summarize_source(
    db: Session,
    biz: Business,
    body: CampaignDraftRequest,
) -> tuple[str, list[str]]:
    """Return (audience_summary, targeting_suggestions) based on source."""

    if body.source_type == "audience" and body.audience_id:
        aud = db.get(Audience, body.audience_id)
        if not aud or aud.business_id != biz.id:
            raise HTTPException(status_code=404, detail="Audience not found")
        defn = aud.definition or {}
        intents = defn.get("intents", [])
        summary = f"Audience '{aud.name}': intents={intents}"
        targeting = [f"Intent: {i}" for i in intents]
        if defn.get("min_score"):
            targeting.append(f"Min score: {defn['min_score']}")
        return summary, targeting

    if body.source_type == "leads" and body.lead_ids:
        leads = (
            db.query(Lead)
            .filter(Lead.id.in_(body.lead_ids), Lead.business_id == biz.id)
            .all()
        )
        if not leads:
            raise HTTPException(status_code=404, detail="No matching leads found")
        intents = list({l.intent.value for l in leads})
        avg_score = sum(l.score for l in leads) // len(leads)
        summary = f"{len(leads)} leads, intents={intents}, avg_score={avg_score}"
        targeting = [f"Intent: {i}" for i in intents] + [f"Avg score: {avg_score}"]
        return summary, targeting

    # manual / fallback
    prompt_text = body.prompt or "General campaign"
    summary = f"Manual: {prompt_text[:200]}"
    targeting = [f"Category: {biz.category or 'general'}"]
    if biz.location_text:
        targeting.append(f"Location: {biz.location_text}")
    return summary, targeting


# ── Endpoints ──


@router.post(
    "/businesses/{business_id}/campaigns/draft",
    response_model=ApprovalOut,
    status_code=201,
)
def create_campaign_draft(
    body: CampaignDraftRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.MANAGE_CAMPAIGNS)),
):
    audience_summary, targeting = _summarize_source(db, biz, body)
    draft = _build_draft(biz, body, audience_summary, targeting)

    campaign_name = f"{body.objective.value} — {body.platform} — {biz.name}"
    campaign = Campaign(
        business_id=biz.id,
        name=campaign_name,
        draft=draft,
        status=CampaignStatus.DRAFT,
    )
    db.add(campaign)
    db.flush()

    action = Action(
        business_id=biz.id,
        type=ActionType.CAMPAIGN_DRAFT,
        payload={
            "campaign_id": str(campaign.id),
            "campaign_name": campaign_name,
            "objective": body.objective.value,
            "platform": body.platform,
            "budget_suggestion": draft["budget_suggestion"],
        },
    )
    db.add(action)
    db.flush()

    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=RiskLevel.HIGH,
        cost_impact=draft["budget_suggestion"],
        confidence=75,
        requires_human=True,
    )
    db.add(approval)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="ACTION_CREATED",
        entity_type="action",
        entity_id=action.id,
        meta={
            "action_type": "CAMPAIGN_DRAFT",
            "campaign_id": str(campaign.id),
            "objective": body.objective.value,
        },
    ))

    db.commit()
    db.refresh(approval)
    approval.action = action
    return approval


@router.get(
    "/businesses/{business_id}/campaigns",
    response_model=list[CampaignOut],
)
def list_campaigns(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(Campaign)
        .filter(Campaign.business_id == biz.id)
        .order_by(Campaign.created_at.desc())
        .limit(50)
        .all()
    )


@router.get(
    "/campaigns/{campaign_id}",
    response_model=CampaignOut,
)
def get_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    biz = db.get(Business, campaign.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch(
    "/campaigns/{campaign_id}",
    response_model=CampaignOut,
)
def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    biz = db.get(Business, campaign.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only edit drafts")

    if body.name is not None:
        campaign.name = body.name
    if body.draft is not None:
        campaign.draft = body.draft

    db.commit()
    db.refresh(campaign)
    return campaign


# ── Prepare for Meta publishing ──


@router.post(
    "/campaigns/{campaign_id}/prepare-publish",
    response_model=ApprovalOut,
    status_code=201,
)
def prepare_publish(
    campaign_id: uuid.UUID,
    body: CampaignPublishRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Move an approved/executed campaign to READY_TO_PUBLISH,
    create a CAMPAIGN_PUBLISH action + PENDING approval for final review.
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    biz = db.get(Business, campaign.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Must be in an approved-like state (APPROVED, EXECUTED, or PUBLISH_FAILED for retry)
    allowed = {CampaignStatus.APPROVED, CampaignStatus.EXECUTED, CampaignStatus.PUBLISH_FAILED}
    if campaign.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Campaign must be approved before publishing (current: {campaign.status.value})",
        )

    platform = (campaign.draft or {}).get("platform", "meta")

    # Resolve integration
    integration_id = body.integration_id
    if not integration_id:
        # Find first enabled META integration for this business
        integ = (
            db.query(Integration)
            .filter(
                Integration.business_id == biz.id,
                Integration.type == IntegrationType.META,
                Integration.is_enabled.is_(True),
            )
            .first()
        )
        integration_id = integ.id if integ else None

    campaign.status = CampaignStatus.READY_TO_PUBLISH

    action = Action(
        business_id=biz.id,
        type=ActionType.CAMPAIGN_PUBLISH,
        payload={
            "campaign_id": str(campaign.id),
            "campaign_name": campaign.name,
            "platform": platform,
            "integration_id": str(integration_id) if integration_id else None,
        },
    )
    db.add(action)
    db.flush()

    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=RiskLevel.HIGH,
        cost_impact=(campaign.draft or {}).get("budget_suggestion", 0),
        confidence=85,
        requires_human=True,
    )
    db.add(approval)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="CAMPAIGN_PUBLISH_REQUESTED",
        entity_type="campaign",
        entity_id=campaign.id,
        meta={
            "platform": platform,
            "integration_id": str(integration_id) if integration_id else None,
        },
    ))

    db.commit()
    db.refresh(approval)
    approval.action = action
    return approval


# ── Publish logs ──


@router.get(
    "/campaigns/{campaign_id}/publish-logs",
    response_model=list[PublishLogOut],
)
def list_publish_logs(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    biz = db.get(Business, campaign.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return (
        db.query(PublishLog)
        .filter(PublishLog.campaign_id == campaign_id)
        .order_by(PublishLog.created_at.desc())
        .limit(20)
        .all()
    )


# ── Retry failed publish ──


@router.post(
    "/publish-logs/{log_id}/retry",
    response_model=ApprovalOut,
)
def retry_publish(
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retry a failed publish by creating a new publish approval."""
    log = db.get(PublishLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Publish log not found")
    biz = db.get(Business, log.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Publish log not found")
    if log.status != "FAILED":
        raise HTTPException(status_code=400, detail="Can only retry failed publishes")

    campaign = db.get(Campaign, log.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = CampaignStatus.READY_TO_PUBLISH

    action = Action(
        business_id=biz.id,
        type=ActionType.CAMPAIGN_PUBLISH,
        payload={
            "campaign_id": str(campaign.id),
            "campaign_name": campaign.name,
            "platform": log.platform,
            "integration_id": str(log.integration_id) if log.integration_id else None,
            "retry_of": str(log.id),
        },
    )
    db.add(action)
    db.flush()

    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=RiskLevel.HIGH,
        cost_impact=(campaign.draft or {}).get("budget_suggestion", 0),
        confidence=85,
        requires_human=True,
    )
    db.add(approval)

    db.commit()
    db.refresh(approval)
    approval.action = action
    return approval


# ── Execution helpers (called from approval flow) ──


def execute_campaign(db: Session, campaign_id: uuid.UUID, user: User) -> None:
    """Mark campaign APPROVED then EXECUTED (stub), with audit events."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        return
    biz = db.get(Business, campaign.business_id)
    if not biz:
        return

    now = datetime.now(timezone.utc)
    campaign.status = CampaignStatus.APPROVED

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="CAMPAIGN_APPROVED",
        entity_type="campaign",
        entity_id=campaign.id,
        meta={"campaign_name": campaign.name},
    ))

    # Stub execution — now sets EXECUTED (ready to be published)
    campaign.status = CampaignStatus.EXECUTED

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="CAMPAIGN_EXECUTED",
        entity_type="campaign",
        entity_id=campaign.id,
        meta={
            "campaign_name": campaign.name,
            "execution_time": now.isoformat(),
        },
    ))

    db.commit()


async def execute_campaign_publish(db: Session, campaign_id: uuid.UUID, user: User, action_payload: dict) -> None:
    """Execute the actual Meta publish via adapter."""
    from app.publishing.meta_adapter import publish_to_meta

    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        return
    biz = db.get(Business, campaign.business_id)
    if not biz:
        return

    campaign.status = CampaignStatus.PUBLISH_PENDING
    db.flush()

    platform = action_payload.get("platform", "meta")
    integration_id_str = action_payload.get("integration_id")

    # Get integration config
    config: dict = {}
    integration_id = None
    if integration_id_str:
        integration_id = uuid.UUID(integration_id_str)
        integ = db.get(Integration, integration_id)
        if integ and integ.config:
            config = dict(integ.config)

    # Create publish log
    from app.publishing.meta_adapter import _build_meta_payload
    request_payload = _build_meta_payload(campaign.draft or {}, config)

    log = PublishLog(
        business_id=biz.id,
        campaign_id=campaign.id,
        integration_id=integration_id,
        platform=platform,
        status="PENDING",
        request_payload=request_payload,
    )
    db.add(log)
    db.flush()

    # Execute publish
    result = await publish_to_meta(campaign.draft or {}, config)

    if result.success:
        log.status = "PUBLISHED"
        log.external_id = result.external_id
        log.response_payload = result.response_data
        campaign.status = CampaignStatus.PUBLISHED

        db.add(AuditLog(
            org_id=biz.org_id,
            user_id=user.id,
            event_type="CAMPAIGN_PUBLISHED",
            entity_type="campaign",
            entity_id=campaign.id,
            meta={
                "platform": platform,
                "external_id": result.external_id,
            },
        ))
    else:
        log.status = "FAILED"
        log.error_message = result.error
        log.response_payload = result.response_data
        campaign.status = CampaignStatus.PUBLISH_FAILED

        db.add(AuditLog(
            org_id=biz.org_id,
            user_id=user.id,
            event_type="CAMPAIGN_PUBLISH_FAILED",
            entity_type="campaign",
            entity_id=campaign.id,
            meta={
                "platform": platform,
                "error": result.error,
            },
        ))

    db.commit()
