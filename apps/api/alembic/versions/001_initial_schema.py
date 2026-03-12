"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    op.create_table(
        "orgs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("role", sa.Enum("OWNER", "MEMBER", name="userrole"), server_default="OWNER"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(255)),
        sa.Column("location_text", sa.String(500)),
        sa.Column("website_url", sa.String(2048)),
        sa.Column("language_pref", sa.Enum("EN", "HE", name="languagepref"), server_default="EN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "competitors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("website_url", sa.String(2048)),
    )

    op.create_table(
        "sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.Enum("SEARCH", "RSS", "SOCIAL", "REVIEWS", "DIRECTORY", "MARKETPLACE", name="sourcetype"), nullable=False),
        sa.Column("access_method", sa.Enum("API", "RSS", "SCRAPE", name="accessmethod"), nullable=False),
        sa.Column("vertical_tags", postgresql.ARRAY(sa.Text)),
        sa.Column("reliability_score", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "mentions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id")),
        sa.Column("title", sa.String(500)),
        sa.Column("snippet", sa.Text),
        sa.Column("url", sa.String(2048)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("raw_json", postgresql.JSONB),
        sa.Column("dedup_hash", sa.String(64)),
    )
    op.create_index("ix_mentions_dedup_hash", "mentions", ["dedup_hash"])

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("mention_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mentions.id")),
        sa.Column("intent", sa.Enum("PURCHASE", "COMPARISON", "COMPLAINT", "RECOMMENDATION", "QUESTION", "OTHER", name="leadintent"), server_default="OTHER"),
        sa.Column("score", sa.Integer, server_default="0"),
        sa.Column("confidence", sa.Integer, server_default="0"),
        sa.Column("status", sa.Enum("NEW", "SAVED", "SENT", "CLOSED", name="leadstatus"), server_default="NEW"),
        sa.Column("suggested_reply", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("type", sa.Enum("REPLY_DRAFT", "AUDIENCE_DRAFT", "CAMPAIGN_DRAFT", "CRM_SYNC", "EXPORT", name="actiontype"), nullable=False),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actions.id"), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "APPROVED", "REJECTED", "EXECUTED", name="approvalstatus"), server_default="PENDING"),
        sa.Column("risk", sa.Enum("LOW", "MEDIUM", "HIGH", name="risklevel"), server_default="LOW"),
        sa.Column("cost_impact", sa.Integer, server_default="0"),
        sa.Column("confidence", sa.Integer, server_default="0"),
        sa.Column("requires_human", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id")),
        sa.Column("mention_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mentions.id")),
        sa.Column("rating", sa.Enum("GOOD", "BAD", name="feedbackrating"), nullable=False),
        sa.Column("note", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("meta", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_org_created", "audit_log", ["org_id", "created_at"])

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("role", sa.Enum("USER", "ASSISTANT", name="chatrole"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("audit_log")
    op.drop_table("feedback")
    op.drop_table("approvals")
    op.drop_table("actions")
    op.drop_table("leads")
    op.drop_table("mentions")
    op.drop_table("sources")
    op.drop_table("competitors")
    op.drop_table("businesses")
    op.drop_table("users")
    op.drop_table("orgs")

    for enum_name in [
        "chatrole", "feedbackrating", "risklevel", "approvalstatus",
        "actiontype", "leadstatus", "leadintent", "accessmethod",
        "sourcetype", "languagepref", "userrole",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
