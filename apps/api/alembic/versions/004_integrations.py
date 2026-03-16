"""integrations and integration_events tables

Revision ID: 004
Revises: 003
Create Date: 2026-03-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE integrationtype AS ENUM ('WEBHOOK')")
    op.execute("CREATE TYPE integrationeventstatus AS ENUM ('PENDING', 'SENT', 'FAILED')")

    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("type", sa.Enum("WEBHOOK", name="integrationtype", create_type=False), server_default="WEBHOOK"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("config", postgresql.JSONB),
        sa.Column("is_enabled", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "integration_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("integrations.id"), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("status", sa.Enum("PENDING", "SENT", "FAILED", name="integrationeventstatus", create_type=False), server_default="PENDING"),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("integration_events")
    op.drop_table("integrations")
    op.execute("DROP TYPE IF EXISTS integrationeventstatus")
    op.execute("DROP TYPE IF EXISTS integrationtype")
