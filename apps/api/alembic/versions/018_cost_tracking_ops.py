"""018 – Cost tracking, source scan frequency, usage counters enhancement.

Revision ID: 018
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Cost events table — tracks estimated cost per operation
    op.create_table(
        "cost_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),  # ai_call, ingestion, export, queue, storage
        sa.Column("operation", sa.String(100), nullable=False),  # e.g. lead_scoring, chat_reply, rss_fetch
        sa.Column("estimated_cost_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("tokens_used", sa.Integer, nullable=True),
        sa.Column("meta", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cost_events_org_created", "cost_events", ["org_id", "created_at"])
    op.create_index("ix_cost_events_category", "cost_events", ["category"])

    # Source scan frequency — adaptive scanning
    op.add_column("sources", sa.Column("scan_interval_minutes", sa.Integer, server_default="60", nullable=False))
    op.add_column("sources", sa.Column("last_hit_count", sa.Integer, server_default="0", nullable=False))
    op.add_column("sources", sa.Column("consecutive_empty_scans", sa.Integer, server_default="0", nullable=False))
    op.add_column("sources", sa.Column("priority_score", sa.Integer, server_default="50", nullable=False))

    # Usage counters — add ai_calls count
    op.add_column("usage_counters", sa.Column("ai_calls_count", sa.Integer, server_default="0", nullable=False))
    op.add_column("usage_counters", sa.Column("ingestion_count", sa.Integer, server_default="0", nullable=False))
    op.add_column("usage_counters", sa.Column("estimated_cost_usd", sa.Float, server_default="0", nullable=False))

    # AI usage thresholds per plan — stored in global_configs at app level, no schema needed


def downgrade() -> None:
    op.drop_column("usage_counters", "estimated_cost_usd")
    op.drop_column("usage_counters", "ingestion_count")
    op.drop_column("usage_counters", "ai_calls_count")
    op.drop_column("sources", "priority_score")
    op.drop_column("sources", "consecutive_empty_scans")
    op.drop_column("sources", "last_hit_count")
    op.drop_column("sources", "scan_interval_minutes")
    op.drop_table("cost_events")
