"""Multi-channel outbound actions

Revision ID: 014
Revises: 013
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Add new enum types ---
    op.get_bind().execute(sa.text("COMMIT"))

    outbound_channel = postgresql.ENUM(
        "EMAIL", "WHATSAPP", "LINKEDIN", "CONTENT", "CRM",
        name="outboundchannel",
        create_type=False,
    )
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outboundchannel') THEN CREATE TYPE outboundchannel AS ENUM ('EMAIL','WHATSAPP','LINKEDIN','CONTENT','CRM'); END IF; END $$")

    outbound_status = postgresql.ENUM(
        "DRAFT", "APPROVAL_PENDING", "APPROVED", "EXECUTED", "FAILED",
        name="outboundstatus",
        create_type=False,
    )
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outboundstatus') THEN CREATE TYPE outboundstatus AS ENUM ('DRAFT','APPROVAL_PENDING','APPROVED','EXECUTED','FAILED'); END IF; END $$")

    # --- Add OUTBOUND_MESSAGE to actiontype enum ---
    op.execute("ALTER TYPE actiontype ADD VALUE IF NOT EXISTS 'OUTBOUND_MESSAGE'")

    # --- outbound_actions table ---
    op.create_table(
        "outbound_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("channel", sa.Enum("EMAIL", "WHATSAPP", "LINKEDIN", "CONTENT", "CRM", name="outboundchannel", create_type=False), nullable=False),
        sa.Column("recipient_name", sa.String(255)),
        sa.Column("recipient_handle", sa.String(500)),
        sa.Column("subject", sa.String(500)),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("reason", sa.Text),
        sa.Column("evidence_url", sa.String(2048)),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=True),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actions.id"), nullable=True),
        sa.Column("status", sa.Enum("DRAFT", "APPROVAL_PENDING", "APPROVED", "EXECUTED", "FAILED", name="outboundstatus", create_type=False), server_default=sa.text("'DRAFT'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.Column("executed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_outbound_actions_business_status", "outbound_actions", ["business_id", "status"])
    op.create_index("ix_outbound_actions_channel", "outbound_actions", ["channel"])


def downgrade() -> None:
    op.drop_index("ix_outbound_actions_channel", table_name="outbound_actions")
    op.drop_index("ix_outbound_actions_business_status", table_name="outbound_actions")
    op.drop_table("outbound_actions")
    op.execute("DROP TYPE IF EXISTS outboundstatus")
    op.execute("DROP TYPE IF EXISTS outboundchannel")
    # Note: OUTBOUND_MESSAGE value remains in actiontype enum (PostgreSQL limitation)
