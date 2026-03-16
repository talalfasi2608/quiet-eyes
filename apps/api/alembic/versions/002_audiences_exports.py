"""audiences and exports tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE exporttype AS ENUM ('CSV', 'HASHED_CSV')")
    op.execute("CREATE TYPE exportstatus AS ENUM ('PENDING', 'READY', 'FAILED')")

    op.create_table(
        "audiences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("definition", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "exports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("audience_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("audiences.id")),
        sa.Column("type", sa.Enum("CSV", "HASHED_CSV", name="exporttype", create_type=False), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "READY", "FAILED", name="exportstatus", create_type=False), server_default="PENDING"),
        sa.Column("file_path", sa.String(2048)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("exports")
    op.drop_table("audiences")
    op.execute("DROP TYPE IF EXISTS exportstatus")
    op.execute("DROP TYPE IF EXISTS exporttype")
