"""autopilot_settings, digests, priority_score on approvals

Revision ID: 006
Revises: 005
Create Date: 2026-03-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE autopilotmode AS ENUM ('ASSIST', 'OPERATOR', 'AUTOPILOT')")

    op.create_table(
        "autopilot_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False, unique=True),
        sa.Column("is_enabled", sa.Boolean, server_default="false"),
        sa.Column("mode", sa.Enum("ASSIST", "OPERATOR", "AUTOPILOT", name="autopilotmode", create_type=False), server_default="ASSIST"),
        sa.Column("confidence_threshold", sa.Integer, server_default="85"),
        sa.Column("daily_budget_cap", sa.Integer, server_default="0"),
        sa.Column("risk_tolerance", sa.Enum("LOW", "MEDIUM", "HIGH", name="risklevel", create_type=False), server_default="LOW"),
        sa.Column("allowed_actions", postgresql.ARRAY(sa.Text)),
        sa.Column("quiet_hours", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "digests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("summary", sa.Text),
        sa.Column("items", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.add_column("approvals", sa.Column("priority_score", sa.Integer, server_default="0"))


def downgrade() -> None:
    op.drop_column("approvals", "priority_score")
    op.drop_table("digests")
    op.drop_table("autopilot_settings")
    op.execute("DROP TYPE IF EXISTS autopilotmode")
