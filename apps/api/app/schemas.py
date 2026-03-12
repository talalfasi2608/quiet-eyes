import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models import (
    ActionType,
    ApprovalStatus,
    ChatRole,
    LanguagePref,
    LeadIntent,
    LeadStatus,
    RiskLevel,
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


class BusinessUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    location_text: str | None = None
    website_url: str | None = None
    language_pref: LanguagePref | None = None


class BusinessOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    category: str | None
    location_text: str | None
    website_url: str | None
    language_pref: LanguagePref
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


class MentionOut(BaseModel):
    id: uuid.UUID
    title: str | None
    snippet: str | None
    url: str | None
    published_at: datetime | None

    model_config = {"from_attributes": True}


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
    requires_human: bool
    created_at: datetime
    decided_at: datetime | None
    action: ActionOut | None = None

    model_config = {"from_attributes": True}


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
