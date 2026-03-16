"""Playbooks, optimization recommendations, vertical_template field

Revision ID: 010
Revises: 009
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New enums
    op.execute("CREATE TYPE recommendationstatus AS ENUM ('PENDING', 'APPLIED', 'DISMISSED', 'SAVED')")
    op.execute("CREATE TYPE recommendationtype AS ENUM ('BUDGET_CHANGE', 'CREATIVE_CHANGE', 'AUDIENCE_REFINEMENT', 'APPROVAL_THRESHOLD', 'AUTOPILOT_TUNING', 'PLAYBOOK_SUGGESTION')")

    # vertical_template on businesses
    op.add_column("businesses", sa.Column("vertical_template", sa.String(100)))

    # Playbooks table
    op.create_table(
        "playbooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("trigger_conditions", postgresql.JSONB),
        sa.Column("suggested_actions", postgresql.ARRAY(sa.Text)),
        sa.Column("approval_policy", sa.String(50)),
        sa.Column("campaign_template", postgresql.JSONB),
        sa.Column("audience_template", postgresql.JSONB),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_playbooks_business_id", "playbooks", ["business_id"])

    # Optimization recommendations table
    op.create_table(
        "optimization_recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("type", sa.Enum("BUDGET_CHANGE", "CREATIVE_CHANGE", "AUDIENCE_REFINEMENT", "APPROVAL_THRESHOLD", "AUTOPILOT_TUNING", "PLAYBOOK_SUGGESTION", name="recommendationtype", create_type=False), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("current_value", sa.Text),
        sa.Column("suggested_value", sa.Text),
        sa.Column("confidence", sa.Integer, server_default="0"),
        sa.Column("impact_estimate", sa.String(255)),
        sa.Column("reasoning", sa.Text),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("status", sa.Enum("PENDING", "APPLIED", "DISMISSED", "SAVED", name="recommendationstatus", create_type=False), server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_opt_rec_business_status", "optimization_recommendations", ["business_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_opt_rec_business_status", table_name="optimization_recommendations")
    op.drop_table("optimization_recommendations")
    op.drop_index("ix_playbooks_business_id", table_name="playbooks")
    op.drop_table("playbooks")
    op.drop_column("businesses", "vertical_template")
    op.execute("DROP TYPE IF EXISTS recommendationtype")
    op.execute("DROP TYPE IF EXISTS recommendationstatus")
