"""Meta publishing: publish_logs table, new enum values

Revision ID: 008
Revises: 007
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend campaignstatus enum with publish states
    op.execute("ALTER TYPE campaignstatus ADD VALUE IF NOT EXISTS 'READY_TO_PUBLISH'")
    op.execute("ALTER TYPE campaignstatus ADD VALUE IF NOT EXISTS 'PUBLISH_PENDING'")
    op.execute("ALTER TYPE campaignstatus ADD VALUE IF NOT EXISTS 'PUBLISHED'")
    op.execute("ALTER TYPE campaignstatus ADD VALUE IF NOT EXISTS 'PUBLISH_FAILED'")

    # Extend actiontype enum
    op.execute("ALTER TYPE actiontype ADD VALUE IF NOT EXISTS 'CAMPAIGN_PUBLISH'")

    # Extend integrationtype enum
    op.execute("ALTER TYPE integrationtype ADD VALUE IF NOT EXISTS 'META'")

    op.create_table(
        "publish_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("integrations.id")),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("external_id", sa.String(255)),
        sa.Column("error_message", sa.Text),
        sa.Column("request_payload", postgresql.JSONB),
        sa.Column("response_payload", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_publish_logs_campaign_id", "publish_logs", ["campaign_id"])
    op.create_index("ix_publish_logs_business_id", "publish_logs", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_publish_logs_business_id", table_name="publish_logs")
    op.drop_index("ix_publish_logs_campaign_id", table_name="publish_logs")
    op.drop_table("publish_logs")
