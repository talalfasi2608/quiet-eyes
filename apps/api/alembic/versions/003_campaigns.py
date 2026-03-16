"""campaigns table

Revision ID: 003
Revises: 002
Create Date: 2026-03-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE campaignstatus AS ENUM ('DRAFT', 'APPROVED', 'EXECUTED')")
    op.execute("CREATE TYPE campaignobjective AS ENUM ('LEADS', 'SALES', 'TRAFFIC')")

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("draft", postgresql.JSONB),
        sa.Column("status", sa.Enum("DRAFT", "APPROVED", "EXECUTED", name="campaignstatus", create_type=False), server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("campaigns")
    op.execute("DROP TYPE IF EXISTS campaignobjective")
    op.execute("DROP TYPE IF EXISTS campaignstatus")
