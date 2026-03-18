import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models import (
    ActionType,
    ApprovalStatus,
    AutopilotMode,
    CampaignObjective,
    CampaignStatus,
    ChatRole,
    CompetitorEventType,
    ExportStatus,
    ExportType,
    IntegrationEventStatus,
    IntegrationType,
    LanguagePref,
    LeadIntent,
    LeadStatus,
    PlanTier,
    RecommendationStatus,
    RecommendationType,
    ReviewSentiment,
    RiskLevel,
    SourceHealthStatus,
    SourceType,
    SubscriptionStatus,
    UserRole,
)


# ── Auth ──


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    org_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    org_id: uuid.UUID

    model_config = {"from_attributes": True}


# ── Business ──


class BusinessCreate(BaseModel):
    name: str
    category: str | None = None
    location_text: str | None = None
    website_url: str | None = None
    language_pref: LanguagePref = LanguagePref.EN
    client_notes: str | None = None


class BusinessUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    location_text: str | None = None
    website_url: str | None = None
    language_pref: LanguagePref | None = None
    client_notes: str | None = None
    client_metadata: dict | None = None
    vertical_template: str | None = None
    region: str | None = None


class BusinessOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    category: str | None
    location_text: str | None
    website_url: str | None
    language_pref: LanguagePref
    client_notes: str | None = None
    client_metadata: dict | None = None
    vertical_template: str | None = None
    region: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Competitor ──


class CompetitorCreate(BaseModel):
    name: str
    website_url: str | None = None


class CompetitorOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    website_url: str | None

    model_config = {"from_attributes": True}


class CompetitorBulkRequest(BaseModel):
    competitors: list[CompetitorCreate]


# ── Feed / Lead ──


class SourceOut(BaseModel):
    id: uuid.UUID
    name: str
    type: SourceType

    model_config = {"from_attributes": True}


class MentionOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    title: str | None
    snippet: str | None
    url: str | None
    published_at: datetime | None
    fetched_at: datetime
    source: SourceOut | None = None

    model_config = {"from_attributes": True}


class IngestionResultOut(BaseModel):
    business_id: str
    business_name: str | None = None
    search_new: int = 0
    rss_new: int = 0
    google_reviews_new: int = 0
    reddit_new: int = 0
    yelp_reviews_new: int = 0
    trustpilot_new: int = 0
    total_mentions: int = 0
    error: str | None = None


class LeadOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    mention_id: uuid.UUID | None
    intent: LeadIntent
    score: int
    confidence: int
    status: LeadStatus
    suggested_reply: str | None
    created_at: datetime
    mention: MentionOut | None = None

    model_config = {"from_attributes": True}


class LeadGenerateOut(BaseModel):
    leads_created: int = 0
    total_leads: int = 0
    mentions_processed: int = 0
    error: str | None = None


# ── Action ──


class ActionCreateRequest(BaseModel):
    type: ActionType
    payload: dict | None = None


# ── Approval ──


class ActionOut(BaseModel):
    id: uuid.UUID
    type: ActionType
    payload: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApprovalOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    action_id: uuid.UUID
    status: ApprovalStatus
    risk: RiskLevel
    cost_impact: int
    confidence: int
    priority_score: int = 0
    requires_human: bool
    created_at: datetime
    decided_at: datetime | None
    action: ActionOut | None = None

    model_config = {"from_attributes": True}


# ── Audience ──


class AudienceDraftRequest(BaseModel):
    name: str
    definition: dict


class AudienceOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    definition: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Export ──


class ExportCreateRequest(BaseModel):
    audience_id: uuid.UUID | None = None
    type: ExportType = ExportType.CSV


class ExportOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    audience_id: uuid.UUID | None
    type: ExportType
    status: ExportStatus
    file_path: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Campaign ──


class CampaignDraftRequest(BaseModel):
    source_type: str  # "leads" | "audience" | "manual"
    lead_ids: list[uuid.UUID] | None = None
    audience_id: uuid.UUID | None = None
    prompt: str | None = None
    platform: str = "meta"  # meta | google | tiktok
    daily_budget: int = 50
    objective: CampaignObjective = CampaignObjective.LEADS


class CampaignUpdateRequest(BaseModel):
    name: str | None = None
    draft: dict | None = None


class CampaignOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    draft: dict | None
    status: CampaignStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignPublishRequest(BaseModel):
    integration_id: uuid.UUID | None = None


class PublishLogOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    campaign_id: uuid.UUID
    integration_id: uuid.UUID | None
    platform: str
    status: str
    external_id: str | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MetaIntegrationCreateRequest(BaseModel):
    name: str
    access_token: str | None = None
    ad_account_id: str | None = None
    page_id: str | None = None


class MetaIntegrationUpdateRequest(BaseModel):
    name: str | None = None
    access_token: str | None = None
    ad_account_id: str | None = None
    page_id: str | None = None
    is_enabled: bool | None = None


# ── Integration ──


class IntegrationCreateRequest(BaseModel):
    name: str
    webhook_url: str
    secret_header: str | None = None
    secret_token: str | None = None


class IntegrationUpdateRequest(BaseModel):
    name: str | None = None
    webhook_url: str | None = None
    secret_header: str | None = None
    secret_token: str | None = None
    is_enabled: bool | None = None


class IntegrationOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    type: IntegrationType
    name: str
    config: dict | None
    is_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class IntegrationEventOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    integration_id: uuid.UUID
    event_type: str
    payload: dict | None
    status: IntegrationEventStatus
    error_message: str | None
    created_at: datetime
    sent_at: datetime | None

    model_config = {"from_attributes": True}


class IntegrationTestOut(BaseModel):
    success: bool
    status_code: int | None = None
    error: str | None = None


# ── Intelligence: Trends ──


class TrendOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    topic: str
    spike_score: int
    window_days: int
    evidence_urls: list[str] | None
    first_seen_at: datetime | None
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Intelligence: Competitor Events ──


class CompetitorEventOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    competitor_id: uuid.UUID
    event_type: CompetitorEventType
    summary: str | None
    evidence_urls: list[str] | None
    detected_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Intelligence: Reviews ──


class ReviewOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    source_id: uuid.UUID | None
    rating: int | None
    author: str | None
    text: str
    url: str | None
    published_at: datetime | None
    sentiment: ReviewSentiment
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Intelligence: Unified Feed Item ──


class FeedItemOut(BaseModel):
    type: str  # "lead" | "trend" | "competitor_event" | "review"
    id: uuid.UUID
    title: str
    why_it_matters: str
    evidence_urls: list[str]
    confidence: int
    primary_action: str | None = None
    created_at: datetime
    data: dict | None = None


class IntelligenceRunOut(BaseModel):
    trends_created: int = 0
    competitor_events_created: int = 0
    reviews_created: int = 0


# ── Chat ──


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    role: ChatRole
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Autopilot ──


class AutopilotSettingsOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    is_enabled: bool
    mode: AutopilotMode
    confidence_threshold: int
    daily_budget_cap: int
    risk_tolerance: RiskLevel
    allowed_actions: list[str] | None
    quiet_hours: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AutopilotSettingsUpdateRequest(BaseModel):
    is_enabled: bool | None = None
    mode: AutopilotMode | None = None
    confidence_threshold: int | None = None
    daily_budget_cap: int | None = None
    risk_tolerance: RiskLevel | None = None
    allowed_actions: list[str] | None = None
    quiet_hours: dict | None = None


class AutopilotRunOut(BaseModel):
    actions_created: int = 0
    approvals_auto_executed: int = 0
    digest_created: bool = False


class DigestOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    date: datetime
    summary: str | None
    items: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkApproveRequest(BaseModel):
    min_confidence: int = 85
    max_risk: RiskLevel = RiskLevel.LOW
    action_types: list[str] | None = None


class BulkApproveResponse(BaseModel):
    approved_count: int = 0
    skipped_count: int = 0
    total_cost: int = 0


# ── Billing / Subscriptions ──


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    plan: PlanTier
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    status: SubscriptionStatus
    current_period_end: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    plan: PlanTier
    success_url: str = "http://localhost:3000/billing?success=true"
    cancel_url: str = "http://localhost:3000/billing?canceled=true"


class CheckoutOut(BaseModel):
    checkout_url: str


class UsageOut(BaseModel):
    scans_count: int = 0
    chat_tokens: int = 0
    exports_count: int = 0
    approvals_count: int = 0
    ai_calls_count: int = 0
    ingestion_count: int = 0
    estimated_cost_usd: float = 0.0
    scans_limit: int = 0
    chat_limit: int = 0
    exports_limit: int = 0
    approvals_limit: int = 0
    ai_calls_limit: int = 0
    plan: PlanTier = PlanTier.STARTER


class QuotaErrorOut(BaseModel):
    code: str = "QUOTA_EXCEEDED"
    detail: str
    resource: str
    current: int
    limit: int
    upgrade_url: str = "/billing"


# ── Admin ──


class SourceHealthOut(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    source_name: str | None = None
    source_type: str | None = None
    last_run_at: datetime | None
    status: SourceHealthStatus
    last_error: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminJobStatusOut(BaseModel):
    celery_active: int = 0
    celery_scheduled: int = 0
    celery_reserved: int = 0
    pending_approvals: int = 0
    pending_exports: int = 0


class AdminUsageSummaryOut(BaseModel):
    total_orgs: int = 0
    total_users: int = 0
    total_businesses: int = 0
    total_mentions: int = 0
    total_leads: int = 0
    total_actions: int = 0
    total_approvals: int = 0
    active_subscriptions: int = 0


# ── Agency ──


class OrgBrandingUpdate(BaseModel):
    display_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None


class OrgOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessAccessCreateRequest(BaseModel):
    user_id: uuid.UUID
    business_id: uuid.UUID


class BusinessAccessOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    business_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AgencyBusinessSummary(BaseModel):
    business_id: uuid.UUID
    business_name: str
    category: str | None = None
    pending_approvals: int = 0
    total_leads: int = 0
    new_leads: int = 0
    active_campaigns: int = 0
    published_campaigns: int = 0


class AgencyOverviewOut(BaseModel):
    total_clients: int = 0
    total_pending_approvals: int = 0
    total_new_leads: int = 0
    total_active_campaigns: int = 0
    businesses: list[AgencyBusinessSummary] = []


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.MEMBER
    business_ids: list[uuid.UUID] | None = None


class OrgMemberOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    created_at: datetime
    business_access: list[uuid.UUID] = []

    model_config = {"from_attributes": True}


# ── Playbooks ──


class PlaybookCreateRequest(BaseModel):
    name: str
    description: str | None = None
    trigger_conditions: dict | None = None
    suggested_actions: list[str] | None = None
    approval_policy: str = "REVIEW"
    campaign_template: dict | None = None
    audience_template: dict | None = None


class PlaybookUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_conditions: dict | None = None
    suggested_actions: list[str] | None = None
    approval_policy: str | None = None
    campaign_template: dict | None = None
    audience_template: dict | None = None
    is_active: bool | None = None


class PlaybookOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID | None
    name: str
    description: str | None
    trigger_conditions: dict | None
    suggested_actions: list[str] | None
    approval_policy: str | None
    campaign_template: dict | None
    audience_template: dict | None
    is_active: bool
    category: str | None = None
    vertical: str | None = None
    tags: list[str] | None = None
    creator_type: str = "user"
    visibility: str = "private"
    version: int = 1
    install_count: int = 0
    metadata_: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaybookLibraryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str | None
    vertical: str | None
    tags: list[str] | None
    creator_type: str
    visibility: str
    version: int
    install_count: int
    approval_policy: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaybookInstallRequest(BaseModel):
    config_overrides: dict | None = None


class PlaybookInstallOut(BaseModel):
    id: uuid.UUID
    playbook_id: uuid.UUID
    business_id: uuid.UUID
    installed_version: int
    config_overrides: dict | None
    is_active: bool
    installed_at: datetime

    model_config = {"from_attributes": True}


class PlaybookVersionOut(BaseModel):
    id: uuid.UUID
    playbook_id: uuid.UUID
    version: int
    snapshot: dict
    change_notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaybookPublishRequest(BaseModel):
    visibility: str = "public"  # public, organization
    category: str | None = None
    vertical: str | None = None
    tags: list[str] | None = None


class TemplateAssetOut(BaseModel):
    id: uuid.UUID
    type: str
    name: str
    description: str | None
    vertical: str | None
    content: dict
    tags: list[str] | None
    creator_type: str
    visibility: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateAssetCreateRequest(BaseModel):
    type: str
    name: str
    description: str | None = None
    vertical: str | None = None
    content: dict
    tags: list[str] | None = None


# ── Vertical Templates ──


class VerticalTemplateOut(BaseModel):
    slug: str
    name: str
    description: str
    source_rules: list[str]
    keywords: list[str]
    trend_keywords: list[str]
    audience_hints: dict
    campaign_tone: str


# ── Optimization Recommendations ──


class OptimizationRecommendationOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    type: RecommendationType
    title: str
    description: str | None
    summary: str | None = None
    current_value: str | None
    suggested_value: str | None
    confidence: int
    impact_estimate: str | None
    impact_score: int = 0
    reasoning: str | None
    payload: dict | None
    status: RecommendationStatus
    created_at: datetime
    decided_at: datetime | None

    model_config = {"from_attributes": True}


class RecommendationActionRequest(BaseModel):
    action: str  # "apply", "dismiss", "save"


class OptimizationRunOut(BaseModel):
    recommendations_created: int = 0
    learning_insights_updated: int = 0


# ── Attribution ──


class AttributionRecordOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    signal_type: str
    signal_id: uuid.UUID | None
    action_id: uuid.UUID | None
    approval_id: uuid.UUID | None
    execution_type: str | None
    execution_id: uuid.UUID | None
    outcome_type: str | None
    outcome_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LearningInsightOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    insight_type: str
    insight_key: str
    value: dict
    sample_size: int
    computed_at: datetime

    model_config = {"from_attributes": True}


# ── Phase 15: Role Permissions ──


class RolePermissionOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    role: str
    permission: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RolePermissionSetRequest(BaseModel):
    role: str
    permissions: list[str]


class RolePermissionBulkOut(BaseModel):
    role: str
    permissions: list[str]


# ── Phase 15: Approval Policies ──


class ApprovalPolicyCreateRequest(BaseModel):
    name: str
    description: str | None = None
    action_type: str | None = None
    conditions: dict | None = None
    required_role: str | None = None
    auto_approve: bool = False
    priority: int = 0


class ApprovalPolicyUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    action_type: str | None = None
    conditions: dict | None = None
    required_role: str | None = None
    auto_approve: bool | None = None
    is_active: bool | None = None
    priority: int | None = None


class ApprovalPolicyOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    description: str | None
    action_type: str | None
    conditions: dict | None
    required_role: str | None
    auto_approve: bool
    is_active: bool
    priority: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Phase 15: Failed Jobs ──


class FailedJobOut(BaseModel):
    id: uuid.UUID
    job_type: str
    job_id: str | None
    business_id: uuid.UUID | None
    payload: dict | None
    error_message: str | None
    retry_count: int
    max_retries: int
    status: str
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


# ── Phase 15: Audit Export ──


class AuditLogOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID | None
    event_type: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    meta: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Phase 15: Ops Console v2 ──


class OpsOverviewOut(BaseModel):
    pending_approvals: int = 0
    pending_exports: int = 0
    total_failed_jobs: int = 0
    failed_by_status: dict[str, int] = {}
    failed_integrations: int = 0
    source_health_degraded: int = 0
    approval_bottlenecks: list[dict] = []
    recent_audit_events: list[dict] = []


# ── Phase 16: Outbound Actions ──


class OutboundDraftRequest(BaseModel):
    channel: str  # EMAIL, WHATSAPP, LINKEDIN, CONTENT, CRM
    lead_id: uuid.UUID | None = None
    recipient_name: str | None = None
    recipient_handle: str | None = None
    subject: str | None = None
    prompt: str | None = None  # optional user guidance for AI generation


class OutboundActionOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    channel: str
    recipient_name: str | None
    recipient_handle: str | None
    subject: str | None
    body: str
    payload: dict | None
    reason: str | None
    evidence_url: str | None
    lead_id: uuid.UUID | None
    action_id: uuid.UUID | None
    status: str
    created_at: datetime
    executed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Phase 17: Predictive Scores ──


class PredictiveScoreOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    predicted_conversion_score: int
    predicted_roi: float | None
    model_version: str
    contributing_signals: dict | None
    explanation: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PredictionRequest(BaseModel):
    entity_type: str  # LEAD, AUDIENCE, CAMPAIGN
    entity_ids: list[uuid.UUID] | None = None  # None = all of that type


class PredictionRunOut(BaseModel):
    predictions_created: int = 0
    entity_type: str = ""


# ── Phase 18: Partners & Regional ──


class PartnerCreateRequest(BaseModel):
    name: str
    contact_email: str
    contact_name: str | None = None
    region: str | None = None
    tier: str | None = None
    commission_pct: float = 10.0


class PartnerUpdateRequest(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    status: str | None = None
    region: str | None = None
    tier: str | None = None
    commission_pct: float | None = None
    config: dict | None = None


class PartnerOut(BaseModel):
    id: uuid.UUID
    name: str
    contact_email: str
    contact_name: str | None
    status: str
    region: str | None
    tier: str | None
    commission_pct: float | None
    config: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PartnerOrgOut(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    org_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class PartnerUserOut(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PartnerReferralCreateRequest(BaseModel):
    invitee_email: str | None = None


class PartnerReferralOut(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    referral_code: str
    invitee_email: str | None
    org_id: uuid.UUID | None
    status: str
    created_at: datetime
    accepted_at: datetime | None

    model_config = {"from_attributes": True}


class PartnerAnalyticsOut(BaseModel):
    total_orgs: int = 0
    total_businesses: int = 0
    total_referrals: int = 0
    accepted_referrals: int = 0
    active_subscriptions: int = 0
    estimated_revenue: float = 0.0


class RegionalConfigCreateRequest(BaseModel):
    region_code: str
    name: str
    currency: str = "USD"
    timezone: str = "UTC"
    ad_platforms: dict | None = None
    compliance_flags: dict | None = None
    source_rules: dict | None = None


class RegionalConfigUpdateRequest(BaseModel):
    name: str | None = None
    currency: str | None = None
    timezone: str | None = None
    ad_platforms: dict | None = None
    compliance_flags: dict | None = None
    source_rules: dict | None = None


class RegionalConfigOut(BaseModel):
    id: uuid.UUID
    region_code: str
    name: str
    currency: str
    timezone: str
    ad_platforms: dict | None
    compliance_flags: dict | None
    source_rules: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GlobalConfigCreateRequest(BaseModel):
    config_type: str
    config_key: str
    value: dict
    description: str | None = None


class GlobalConfigUpdateRequest(BaseModel):
    value: dict | None = None
    description: str | None = None
    is_active: bool | None = None


class GlobalConfigOut(BaseModel):
    id: uuid.UUID
    config_type: str
    config_key: str
    value: dict
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
