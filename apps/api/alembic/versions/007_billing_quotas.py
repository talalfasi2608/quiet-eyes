"""subscriptions, usage_counters, source_health, admin role

Revision ID: 007
Revises: 006
Create Date: 2026-03-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE plantier AS ENUM ('STARTER', 'PRO', 'PREMIUM')")
    op.execute("CREATE TYPE subscriptionstatus AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED')")
    op.execute("CREATE TYPE sourcehealthstatus AS ENUM ('OK', 'DEGRADED', 'DOWN')")

    # Add ADMIN to userrole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'ADMIN'")

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False, unique=True),
        sa.Column("plan", sa.Enum("STARTER", "PRO", "PREMIUM", name="plantier", create_type=False), server_default="STARTER"),
        sa.Column("stripe_customer_id", sa.String(255)),
        sa.Column("stripe_subscription_id", sa.String(255)),
        sa.Column("status", sa.Enum("ACTIVE", "PAST_DUE", "CANCELED", name="subscriptionstatus", create_type=False), server_default="ACTIVE"),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "usage_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scans_count", sa.Integer, server_default="0"),
        sa.Column("chat_tokens", sa.Integer, server_default="0"),
        sa.Column("exports_count", sa.Integer, server_default="0"),
        sa.Column("approvals_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_usage_counters_org_date", "usage_counters", ["org_id", "date"])

    op.create_table(
        "source_health",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id"), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.Enum("OK", "DEGRADED", "DOWN", name="sourcehealthstatus", create_type=False), server_default="OK"),
        sa.Column("last_error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("source_health")
    op.drop_index("ix_usage_counters_org_date", table_name="usage_counters")
    op.drop_table("usage_counters")
    op.drop_table("subscriptions")
    op.execute("DROP TYPE IF EXISTS sourcehealthstatus")
    op.execute("DROP TYPE IF EXISTS subscriptionstatus")
    op.execute("DROP TYPE IF EXISTS plantier")
