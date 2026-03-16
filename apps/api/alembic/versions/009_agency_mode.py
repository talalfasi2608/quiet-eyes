"""Agency mode: business_access, org branding, client notes, CLIENT_VIEWER role

Revision ID: 009
Revises: 008
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend userrole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'CLIENT_VIEWER'")

    # Org branding columns
    op.add_column("orgs", sa.Column("display_name", sa.String(255)))
    op.add_column("orgs", sa.Column("logo_url", sa.String(2048)))
    op.add_column("orgs", sa.Column("primary_color", sa.String(20)))

    # Business client notes
    op.add_column("businesses", sa.Column("client_notes", sa.Text))
    op.add_column("businesses", sa.Column("client_metadata", postgresql.JSONB))

    # Business access mapping
    op.create_table(
        "business_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_business_access_user_business",
        "business_access",
        ["user_id", "business_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_business_access_user_business", table_name="business_access")
    op.drop_table("business_access")
    op.drop_column("businesses", "client_metadata")
    op.drop_column("businesses", "client_notes")
    op.drop_column("orgs", "primary_color")
    op.drop_column("orgs", "logo_url")
    op.drop_column("orgs", "display_name")
