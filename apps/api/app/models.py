import enum
import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


# ── Enums ──


class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    CLIENT_VIEWER = "CLIENT_VIEWER"
    ANALYST = "ANALYST"
    MARKETING_MANAGER = "MARKETING_MANAGER"
    APPROVER = "APPROVER"
    BILLING_ADMIN = "BILLING_ADMIN"


class Permission(str, enum.Enum):
    VIEW_FEED = "view_feed"
    MANAGE_CAMPAIGNS = "manage_campaigns"
    APPROVE_ACTIONS = "approve_actions"
    MANAGE_INTEGRATIONS = "manage_integrations"
    MANAGE_BILLING = "manage_billing"
    MANAGE_AUTOPILOT = "manage_autopilot"
    MANAGE_PLAYBOOKS = "manage_playbooks"


class FailedJobStatus(str, enum.Enum):
    FAILED = "FAILED"
    RETRYING = "RETRYING"
    RESOLVED = "RESOLVED"
    DEAD = "DEAD"


class LanguagePref(str, enum.Enum):
    EN = "EN"
    HE = "HE"


class SourceType(str, enum.Enum):
    SEARCH = "SEARCH"
    RSS = "RSS"
    SOCIAL = "SOCIAL"
    REVIEWS = "REVIEWS"
    DIRECTORY = "DIRECTORY"
    MARKETPLACE = "MARKETPLACE"


class AccessMethod(str, enum.Enum):
    API = "API"
    RSS = "RSS"
    SCRAPE = "SCRAPE"


class LeadIntent(str, enum.Enum):
    PURCHASE = "PURCHASE"
    COMPARISON = "COMPARISON"
    COMPLAINT = "COMPLAINT"
    RECOMMENDATION = "RECOMMENDATION"
    QUESTION = "QUESTION"
    OTHER = "OTHER"


class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    SAVED = "SAVED"
    SENT = "SENT"
    CLOSED = "CLOSED"


class ActionType(str, enum.Enum):
    REPLY_DRAFT = "REPLY_DRAFT"
    AUDIENCE_DRAFT = "AUDIENCE_DRAFT"
    CAMPAIGN_DRAFT = "CAMPAIGN_DRAFT"
    CAMPAIGN_PUBLISH = "CAMPAIGN_PUBLISH"
    CRM_SYNC = "CRM_SYNC"
    EXPORT = "EXPORT"
    OUTBOUND_MESSAGE = "OUTBOUND_MESSAGE"


class OutboundChannel(str, enum.Enum):
    EMAIL = "EMAIL"
    WHATSAPP = "WHATSAPP"
    LINKEDIN = "LINKEDIN"
    CONTENT = "CONTENT"
    CRM = "CRM"


class OutboundStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVAL_PENDING = "APPROVAL_PENDING"
    APPROVED = "APPROVED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    EXECUTED = "EXECUTED"
    READY_TO_PUBLISH = "READY_TO_PUBLISH"
    PUBLISH_PENDING = "PUBLISH_PENDING"
    PUBLISHED = "PUBLISHED"
    PUBLISH_FAILED = "PUBLISH_FAILED"


class CampaignObjective(str, enum.Enum):
    LEADS = "LEADS"
    SALES = "SALES"
    TRAFFIC = "TRAFFIC"


class ExportType(str, enum.Enum):
    CSV = "CSV"
    HASHED_CSV = "HASHED_CSV"


class ExportStatus(str, enum.Enum):
    PENDING = "PENDING"
    READY = "READY"
    FAILED = "FAILED"


class IntegrationType(str, enum.Enum):
    WEBHOOK = "WEBHOOK"
    META = "META"
    FACEBOOK_PAGE = "FACEBOOK_PAGE"
    INSTAGRAM = "INSTAGRAM"


class IntegrationEventStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class FeedbackRating(str, enum.Enum):
    GOOD = "GOOD"
    BAD = "BAD"


class CompetitorEventType(str, enum.Enum):
    OFFER_CHANGE = "OFFER_CHANGE"
    MESSAGE_CHANGE = "MESSAGE_CHANGE"
    CONTENT_CHANGE = "CONTENT_CHANGE"


class ReviewSentiment(str, enum.Enum):
    POS = "POS"
    NEU = "NEU"
    NEG = "NEG"


class AutopilotMode(str, enum.Enum):
    ASSIST = "ASSIST"
    OPERATOR = "OPERATOR"
    AUTOPILOT = "AUTOPILOT"


class PlanTier(str, enum.Enum):
    STARTER = "STARTER"
    PRO = "PRO"
    PREMIUM = "PREMIUM"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"


class SourceHealthStatus(str, enum.Enum):
    OK = "OK"
    DEGRADED = "DEGRADED"
    DOWN = "DOWN"


class ChatRole(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class PartnerStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class ReferralStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class PredictiveEntityType(str, enum.Enum):
    LEAD = "LEAD"
    AUDIENCE = "AUDIENCE"
    CAMPAIGN = "CAMPAIGN"


class RecommendationStatus(str, enum.Enum):
    PENDING = "PENDING"
    NEW = "NEW"
    APPLIED = "APPLIED"
    DISMISSED = "DISMISSED"
    SAVED = "SAVED"
    EXPIRED = "EXPIRED"


class RecommendationType(str, enum.Enum):
    BUDGET_CHANGE = "BUDGET_CHANGE"
    CREATIVE_CHANGE = "CREATIVE_CHANGE"
    AUDIENCE_REFINEMENT = "AUDIENCE_REFINEMENT"
    APPROVAL_THRESHOLD = "APPROVAL_THRESHOLD"
    AUTOPILOT_TUNING = "AUTOPILOT_TUNING"
    PLAYBOOK_SUGGESTION = "PLAYBOOK_SUGGESTION"


# ── Models ──


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(2048))
    primary_color: Mapped[str | None] = mapped_column(String(20))
    partner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("partners.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="org")
    businesses: Mapped[list["Business"]] = relationship(back_populates="org")
    business_accesses: Mapped[list["BusinessAccess"]] = relationship(back_populates="org")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="org")
    usage_counters: Mapped[list["UsageCounter"]] = relationship(back_populates="org")
    partner: Mapped["Partner | None"] = relationship()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.OWNER)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship(back_populates="users")


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(255))
    location_text: Mapped[str | None] = mapped_column(String(500))
    website_url: Mapped[str | None] = mapped_column(String(2048))
    language_pref: Mapped[LanguagePref] = mapped_column(Enum(LanguagePref), default=LanguagePref.EN)
    client_notes: Mapped[str | None] = mapped_column(Text)
    client_metadata: Mapped[dict | None] = mapped_column(JSONB)
    vertical_template: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship(back_populates="businesses")
    competitors: Mapped[list["Competitor"]] = relationship(back_populates="business")
    mentions: Mapped[list["Mention"]] = relationship(back_populates="business")
    leads: Mapped[list["Lead"]] = relationship(back_populates="business")
    actions: Mapped[list["Action"]] = relationship(back_populates="business")
    approvals: Mapped[list["Approval"]] = relationship(back_populates="business")
    audiences: Mapped[list["Audience"]] = relationship(back_populates="business")
    exports: Mapped[list["Export"]] = relationship(back_populates="business")
    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="business")
    integrations: Mapped[list["Integration"]] = relationship(back_populates="business")
    integration_events: Mapped[list["IntegrationEvent"]] = relationship(back_populates="business")
    trends: Mapped[list["Trend"]] = relationship(back_populates="business")
    competitor_events: Mapped[list["CompetitorEvent"]] = relationship(back_populates="business")
    reviews: Mapped[list["Review"]] = relationship(back_populates="business")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="business")
    autopilot_settings: Mapped[list["AutopilotSettings"]] = relationship(back_populates="business")
    digests: Mapped[list["Digest"]] = relationship(back_populates="business")
    publish_logs: Mapped[list["PublishLog"]] = relationship(back_populates="business")
    outbound_actions: Mapped[list["OutboundAction"]] = relationship(back_populates="business")
    predictive_scores: Mapped[list["PredictiveScore"]] = relationship(back_populates="business")


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    website_url: Mapped[str | None] = mapped_column(String(2048))

    business: Mapped["Business"] = relationship(back_populates="competitors")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False)
    access_method: Mapped[AccessMethod] = mapped_column(Enum(AccessMethod), nullable=False)
    vertical_tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    reliability_score: Mapped[int | None] = mapped_column(Integer)
    scan_interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    last_hit_count: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_empty_scans: Mapped[int] = mapped_column(Integer, default=0)
    priority_score: Mapped[int] = mapped_column(Integer, default=50)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Mention(Base):
    __tablename__ = "mentions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sources.id"))
    title: Mapped[str | None] = mapped_column(String(500))
    snippet: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2048))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    raw_json: Mapped[dict | None] = mapped_column(JSONB)
    dedup_hash: Mapped[str | None] = mapped_column(String(64), index=True)

    business: Mapped["Business"] = relationship(back_populates="mentions")
    source: Mapped["Source | None"] = relationship()

    def compute_dedup_hash(self):
        raw = f"{self.business_id}:{self.url}:{self.title}"
        self.dedup_hash = hashlib.sha256(raw.encode()).hexdigest()


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    mention_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("mentions.id"))
    intent: Mapped[LeadIntent] = mapped_column(Enum(LeadIntent), default=LeadIntent.OTHER)
    score: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.NEW)
    suggested_reply: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="leads")
    mention: Mapped["Mention | None"] = relationship()


class Action(Base):
    __tablename__ = "actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    type: Mapped[ActionType] = mapped_column(Enum(ActionType), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="actions")


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("actions.id"), nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus), default=ApprovalStatus.PENDING
    )
    risk: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.LOW)
    cost_impact: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    priority_score: Mapped[int] = mapped_column(Integer, default=0)
    requires_human: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped["Business"] = relationship(back_populates="approvals")
    action: Mapped["Action"] = relationship()


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id"))
    mention_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("mentions.id"))
    rating: Mapped[FeedbackRating] = mapped_column(Enum(FeedbackRating), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    meta: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (Index("ix_audit_log_org_created", "org_id", "created_at"),)


class Audience(Base):
    __tablename__ = "audiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="audiences")
    exports: Mapped[list["Export"]] = relationship(back_populates="audience")


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    audience_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("audiences.id"))
    type: Mapped[ExportType] = mapped_column(Enum(ExportType), nullable=False)
    status: Mapped[ExportStatus] = mapped_column(Enum(ExportStatus), default=ExportStatus.PENDING)
    file_path: Mapped[str | None] = mapped_column(String(2048))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="exports")
    audience: Mapped["Audience | None"] = relationship(back_populates="exports")


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    draft: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus), default=CampaignStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="campaigns")


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    type: Mapped[IntegrationType] = mapped_column(Enum(IntegrationType), default=IntegrationType.WEBHOOK)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSONB)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="integrations")
    events: Mapped[list["IntegrationEvent"]] = relationship(back_populates="integration")


class IntegrationEvent(Base):
    __tablename__ = "integration_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    integration_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integrations.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[IntegrationEventStatus] = mapped_column(
        Enum(IntegrationEventStatus), default=IntegrationEventStatus.PENDING
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped["Business"] = relationship(back_populates="integration_events")
    integration: Mapped["Integration"] = relationship(back_populates="events")


class Trend(Base):
    __tablename__ = "trends"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    spike_score: Mapped[int] = mapped_column(Integer, default=0)
    window_days: Mapped[int] = mapped_column(Integer, default=7)
    evidence_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="trends")


class CompetitorEvent(Base):
    __tablename__ = "competitor_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    competitor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("competitors.id"), nullable=False)
    event_type: Mapped[CompetitorEventType] = mapped_column(Enum(CompetitorEventType), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    evidence_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="competitor_events")
    competitor: Mapped["Competitor"] = relationship()


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sources.id"))
    rating: Mapped[int | None] = mapped_column(Integer)
    author: Mapped[str | None] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(String(2048))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sentiment: Mapped[ReviewSentiment] = mapped_column(Enum(ReviewSentiment), default=ReviewSentiment.NEU)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="reviews")
    source: Mapped["Source | None"] = relationship()


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    role: Mapped[ChatRole] = mapped_column(Enum(ChatRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="chat_messages")


class AutopilotSettings(Base):
    __tablename__ = "autopilot_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False, unique=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mode: Mapped[AutopilotMode] = mapped_column(Enum(AutopilotMode), default=AutopilotMode.ASSIST)
    confidence_threshold: Mapped[int] = mapped_column(Integer, default=85)
    daily_budget_cap: Mapped[int] = mapped_column(Integer, default=0)
    risk_tolerance: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.LOW)
    allowed_actions: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    quiet_hours: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="autopilot_settings")


class Digest(Base):
    __tablename__ = "digests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    items: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="digests")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False, unique=True)
    plan: Mapped[PlanTier] = mapped_column(Enum(PlanTier), default=PlanTier.STARTER)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE
    )
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship(back_populates="subscriptions")


class UsageCounter(Base):
    __tablename__ = "usage_counters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scans_count: Mapped[int] = mapped_column(Integer, default=0)
    chat_tokens: Mapped[int] = mapped_column(Integer, default=0)
    exports_count: Mapped[int] = mapped_column(Integer, default=0)
    approvals_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_calls_count: Mapped[int] = mapped_column(Integer, default=0)
    ingestion_count: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship(back_populates="usage_counters")

    __table_args__ = (Index("ix_usage_counters_org_date", "org_id", "date"),)


class SourceHealth(Base):
    __tablename__ = "source_health"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sources.id"), nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SourceHealthStatus] = mapped_column(
        Enum(SourceHealthStatus), default=SourceHealthStatus.OK
    )
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    source: Mapped["Source"] = relationship()


class PublishLog(Base):
    __tablename__ = "publish_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    integration_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("integrations.id"))
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # PENDING, PUBLISHED, FAILED
    external_id: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(Text)
    request_payload: Mapped[dict | None] = mapped_column(JSONB)
    response_payload: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="publish_logs")
    campaign: Mapped["Campaign"] = relationship()
    integration: Mapped["Integration | None"] = relationship()


class BusinessAccess(Base):
    __tablename__ = "business_access"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship(back_populates="business_accesses")
    user: Mapped["User"] = relationship()
    business: Mapped["Business"] = relationship()

    __table_args__ = (
        Index("ix_business_access_user_business", "user_id", "business_id", unique=True),
    )


class Playbook(Base):
    __tablename__ = "playbooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("businesses.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    trigger_conditions: Mapped[dict | None] = mapped_column(JSONB)
    suggested_actions: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    approval_policy: Mapped[str | None] = mapped_column(String(50))  # AUTO, REVIEW, MANUAL
    campaign_template: Mapped[dict | None] = mapped_column(JSONB)
    audience_template: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Phase 14: Library fields
    category: Mapped[str | None] = mapped_column(String(100))
    vertical: Mapped[str | None] = mapped_column(String(100))
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    creator_type: Mapped[str] = mapped_column(String(20), default="user")  # system, user, partner
    visibility: Mapped[str] = mapped_column(String(20), default="private")  # private, organization, public
    version: Mapped[int] = mapped_column(Integer, default=1)
    creator_org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id"))
    creator_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business | None"] = relationship()
    creator_org: Mapped["Org | None"] = relationship()
    creator_user: Mapped["User | None"] = relationship()
    versions: Mapped[list["PlaybookVersion"]] = relationship(back_populates="playbook")
    installs: Mapped[list["PlaybookInstall"]] = relationship(back_populates="playbook")

    __table_args__ = (
        Index("ix_playbooks_visibility", "visibility"),
        Index("ix_playbooks_vertical", "vertical"),
    )


class PlaybookVersion(Base):
    __tablename__ = "playbook_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    change_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    playbook: Mapped["Playbook"] = relationship(back_populates="versions")

    __table_args__ = (Index("ix_playbook_versions_playbook", "playbook_id", "version"),)


class PlaybookInstall(Base):
    __tablename__ = "playbook_installs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    playbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    installed_version: Mapped[int] = mapped_column(Integer, default=1)
    config_overrides: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    installed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    installed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    playbook: Mapped["Playbook"] = relationship(back_populates="installs")
    business: Mapped["Business"] = relationship()
    installer: Mapped["User | None"] = relationship()

    __table_args__ = (
        Index("ix_playbook_installs_business", "business_id"),
        Index("ix_playbook_installs_unique", "playbook_id", "business_id", unique=True),
    )


class TemplateAsset(Base):
    __tablename__ = "template_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # campaign_copy, audience_def, trend_reaction, reputation_response, crm_followup
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    vertical: Mapped[str | None] = mapped_column(String(100))
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    creator_type: Mapped[str] = mapped_column(String(20), default="system")
    creator_org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id"))
    visibility: Mapped[str] = mapped_column(String(20), default="public")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    creator_org: Mapped["Org | None"] = relationship()

    __table_args__ = (
        Index("ix_template_assets_type", "type"),
        Index("ix_template_assets_vertical", "vertical"),
    )


class OptimizationRecommendation(Base):
    __tablename__ = "optimization_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    type: Mapped[RecommendationType] = mapped_column(Enum(RecommendationType), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    current_value: Mapped[str | None] = mapped_column(Text)
    suggested_value: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    impact_estimate: Mapped[str | None] = mapped_column(String(255))
    reasoning: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)
    impact_score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus), default=RecommendationStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped["Business"] = relationship()

    __table_args__ = (Index("ix_opt_rec_business_status", "business_id", "status"),)


class AttributionRecord(Base):
    __tablename__ = "attribution_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(50), nullable=False)
    signal_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("actions.id"))
    approval_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("approvals.id"))
    execution_type: Mapped[str | None] = mapped_column(String(50))
    execution_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    outcome_type: Mapped[str | None] = mapped_column(String(50))
    outcome_data: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship()
    action: Mapped["Action | None"] = relationship()
    approval: Mapped["Approval | None"] = relationship()


class LearningInsight(Base):
    __tablename__ = "learning_insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    insight_type: Mapped[str] = mapped_column(String(100), nullable=False)
    insight_key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship()

    __table_args__ = (Index("ix_learning_insights_business_type", "business_id", "insight_type"),)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    permission: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship()

    __table_args__ = (
        Index("ix_role_permissions_org_id", "org_id"),
        Index("uq_role_permissions_org_role_perm", "org_id", "role", "permission", unique=True),
    )


class ApprovalPolicy(Base):
    __tablename__ = "approval_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    action_type: Mapped[str | None] = mapped_column(String(50))
    conditions: Mapped[dict | None] = mapped_column(JSONB)
    required_role: Mapped[str | None] = mapped_column(String(50))
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    org: Mapped["Org"] = relationship()

    __table_args__ = (Index("ix_approval_policies_org_id", "org_id"),)


class FailedJob(Base):
    __tablename__ = "failed_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    job_id: Mapped[str | None] = mapped_column(String(255))
    business_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("businesses.id"))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    error_traceback: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    status: Mapped[str] = mapped_column(String(20), default="FAILED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped["Business | None"] = relationship()

    __table_args__ = (
        Index("ix_failed_jobs_status_created", "status", "created_at"),
        Index("ix_failed_jobs_business_id", "business_id"),
    )


class OutboundAction(Base):
    __tablename__ = "outbound_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    channel: Mapped[OutboundChannel] = mapped_column(Enum(OutboundChannel), nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(255))
    recipient_handle: Mapped[str | None] = mapped_column(String(500))
    subject: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(2048))
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id"))
    action_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("actions.id"))
    status: Mapped[OutboundStatus] = mapped_column(Enum(OutboundStatus), default=OutboundStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped["Business"] = relationship(back_populates="outbound_actions")
    lead: Mapped["Lead | None"] = relationship()
    action: Mapped["Action | None"] = relationship()

    __table_args__ = (
        Index("ix_outbound_actions_business_status", "business_id", "status"),
        Index("ix_outbound_actions_channel", "channel"),
    )


class PredictiveScore(Base):
    __tablename__ = "predictive_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    entity_type: Mapped[PredictiveEntityType] = mapped_column(Enum(PredictiveEntityType), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    predicted_conversion_score: Mapped[int] = mapped_column(Integer, default=0)
    predicted_roi: Mapped[float | None] = mapped_column(nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), default="v1")
    contributing_signals: Mapped[dict | None] = mapped_column(JSONB)
    explanation: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="predictive_scores")

    __table_args__ = (
        Index("ix_predictive_scores_business_entity", "business_id", "entity_type", "entity_id"),
        Index("ix_predictive_scores_entity", "entity_type", "entity_id"),
    )


class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[PartnerStatus] = mapped_column(Enum(PartnerStatus), default=PartnerStatus.PENDING)
    region: Mapped[str | None] = mapped_column(String(50))
    tier: Mapped[str | None] = mapped_column(String(50))
    commission_pct: Mapped[float | None] = mapped_column(Float, default=10.0)
    config: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    orgs: Mapped[list["PartnerOrg"]] = relationship(back_populates="partner")
    users: Mapped[list["PartnerUser"]] = relationship(back_populates="partner")
    referrals: Mapped[list["PartnerReferral"]] = relationship(back_populates="partner")

    __table_args__ = (Index("ix_partners_status", "status"),)


class PartnerOrg(Base):
    __tablename__ = "partner_orgs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    partner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("partners.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    partner: Mapped["Partner"] = relationship(back_populates="orgs")
    org: Mapped["Org"] = relationship()

    __table_args__ = (
        Index("ix_partner_orgs_partner", "partner_id"),
        Index("uq_partner_orgs_pair", "partner_id", "org_id", unique=True),
    )


class PartnerUser(Base):
    __tablename__ = "partner_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    partner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("partners.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    partner: Mapped["Partner"] = relationship(back_populates="users")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        Index("uq_partner_users_pair", "partner_id", "user_id", unique=True),
    )


class PartnerReferral(Base):
    __tablename__ = "partner_referrals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    partner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("partners.id"), nullable=False)
    referral_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    invitee_email: Mapped[str | None] = mapped_column(String(320))
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id"))
    status: Mapped[ReferralStatus] = mapped_column(Enum(ReferralStatus), default=ReferralStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    partner: Mapped["Partner"] = relationship(back_populates="referrals")
    org: Mapped["Org | None"] = relationship()

    __table_args__ = (
        Index("ix_partner_referrals_partner", "partner_id"),
    )


class RegionalConfig(Base):
    __tablename__ = "regional_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    region_code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    ad_platforms: Mapped[dict | None] = mapped_column(JSONB)
    compliance_flags: Mapped[dict | None] = mapped_column(JSONB)
    source_rules: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class GlobalConfig(Base):
    __tablename__ = "global_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    config_type: Mapped[str] = mapped_column(String(100), nullable=False)
    config_key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_global_configs_type_key", "config_type", "config_key", unique=True),
    )


# ── Phase 20: Security ──


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    jti: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_type: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ── Phase 21: Cost Tracking & Ops ──


class CostEvent(Base):
    __tablename__ = "cost_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    business_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("businesses.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # ai_call, ingestion, export, queue, storage
    operation: Mapped[str] = mapped_column(String(100), nullable=False)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_used: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_cost_events_org_created", "org_id", "created_at"),
        Index("ix_cost_events_category", "category"),
    )
