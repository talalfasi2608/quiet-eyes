"""Attribution records, optimization v2 upgrades

Revision ID: 011
Revises: 010
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend recommendationstatus enum with NEW and EXPIRED
    op.execute("ALTER TYPE recommendationstatus ADD VALUE IF NOT EXISTS 'NEW'")
    op.execute("ALTER TYPE recommendationstatus ADD VALUE IF NOT EXISTS 'EXPIRED'")

    # Add summary and impact_score columns to optimization_recommendations
    op.add_column("optimization_recommendations", sa.Column("summary", sa.Text))
    op.add_column("optimization_recommendations", sa.Column("impact_score", sa.Integer, server_default="0"))

    # Attribution records table
    op.create_table(
        "attribution_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("signal_type", sa.String(50), nullable=False),  # mention, trend, competitor_event, review, lead
        sa.Column("signal_id", postgresql.UUID(as_uuid=True)),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actions.id")),
        sa.Column("approval_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("approvals.id")),
        sa.Column("execution_type", sa.String(50)),  # campaign_publish, export, crm_sync, campaign_execute
        sa.Column("execution_id", postgresql.UUID(as_uuid=True)),
        sa.Column("outcome_type", sa.String(50)),  # lead_converted, campaign_published, export_completed, crm_synced
        sa.Column("outcome_data", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_attribution_business_id", "attribution_records", ["business_id"])
    op.create_index("ix_attribution_signal", "attribution_records", ["signal_type", "signal_id"])

    # Learning insights table — stores aggregated learning metrics
    op.create_table(
        "learning_insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("insight_type", sa.String(100), nullable=False),
        sa.Column("insight_key", sa.String(255), nullable=False),
        sa.Column("value", postgresql.JSONB, nullable=False),
        sa.Column("sample_size", sa.Integer, server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_learning_insights_business_type", "learning_insights", ["business_id", "insight_type"])


def downgrade() -> None:
    op.drop_index("ix_learning_insights_business_type", table_name="learning_insights")
    op.drop_table("learning_insights")
    op.drop_index("ix_attribution_signal", table_name="attribution_records")
    op.drop_index("ix_attribution_business_id", table_name="attribution_records")
    op.drop_table("attribution_records")
    op.drop_column("optimization_recommendations", "impact_score")
    op.drop_column("optimization_recommendations", "summary")
    # Note: cannot remove enum values in PostgreSQL
