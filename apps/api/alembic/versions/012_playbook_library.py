"""Playbook library: expand playbooks, add versions, installs, template assets

Revision ID: 012
Revises: 011
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Expand playbooks table with library fields
    op.add_column("playbooks", sa.Column("category", sa.String(100)))
    op.add_column("playbooks", sa.Column("vertical", sa.String(100)))
    op.add_column("playbooks", sa.Column("tags", postgresql.ARRAY(sa.Text)))
    op.add_column("playbooks", sa.Column("creator_type", sa.String(20), server_default="user"))  # system, user, partner
    op.add_column("playbooks", sa.Column("visibility", sa.String(20), server_default="private"))  # private, organization, public
    op.add_column("playbooks", sa.Column("version", sa.Integer, server_default="1"))
    op.add_column("playbooks", sa.Column("creator_org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id")))
    op.add_column("playbooks", sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")))
    op.add_column("playbooks", sa.Column("install_count", sa.Integer, server_default="0"))
    op.add_column("playbooks", sa.Column("metadata_", postgresql.JSONB))

    # Make business_id nullable so library playbooks can exist without a business
    op.alter_column("playbooks", "business_id", nullable=True)

    op.create_index("ix_playbooks_visibility", "playbooks", ["visibility"])
    op.create_index("ix_playbooks_vertical", "playbooks", ["vertical"])

    # Playbook versions table
    op.create_table(
        "playbook_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("playbook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("snapshot", postgresql.JSONB, nullable=False),
        sa.Column("change_notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_playbook_versions_playbook", "playbook_versions", ["playbook_id", "version"])

    # Playbook installs table
    op.create_table(
        "playbook_installs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("playbook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("installed_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("config_overrides", postgresql.JSONB),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("installed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_playbook_installs_business", "playbook_installs", ["business_id"])
    op.create_index("ix_playbook_installs_unique", "playbook_installs", ["playbook_id", "business_id"], unique=True)

    # Template assets table
    op.create_table(
        "template_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("type", sa.String(50), nullable=False),  # campaign_copy, audience_def, trend_reaction, reputation_response, crm_followup
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("vertical", sa.String(100)),
        sa.Column("content", postgresql.JSONB, nullable=False),
        sa.Column("tags", postgresql.ARRAY(sa.Text)),
        sa.Column("creator_type", sa.String(20), server_default="system"),
        sa.Column("creator_org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id")),
        sa.Column("visibility", sa.String(20), server_default="public"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_template_assets_type", "template_assets", ["type"])
    op.create_index("ix_template_assets_vertical", "template_assets", ["vertical"])


def downgrade() -> None:
    op.drop_index("ix_template_assets_vertical", table_name="template_assets")
    op.drop_index("ix_template_assets_type", table_name="template_assets")
    op.drop_table("template_assets")
    op.drop_index("ix_playbook_installs_unique", table_name="playbook_installs")
    op.drop_index("ix_playbook_installs_business", table_name="playbook_installs")
    op.drop_table("playbook_installs")
    op.drop_index("ix_playbook_versions_playbook", table_name="playbook_versions")
    op.drop_table("playbook_versions")
    op.drop_index("ix_playbooks_vertical", table_name="playbooks")
    op.drop_index("ix_playbooks_visibility", table_name="playbooks")
    op.alter_column("playbooks", "business_id", nullable=False)
    op.drop_column("playbooks", "metadata_")
    op.drop_column("playbooks", "install_count")
    op.drop_column("playbooks", "creator_user_id")
    op.drop_column("playbooks", "creator_org_id")
    op.drop_column("playbooks", "version")
    op.drop_column("playbooks", "visibility")
    op.drop_column("playbooks", "creator_type")
    op.drop_column("playbooks", "tags")
    op.drop_column("playbooks", "vertical")
    op.drop_column("playbooks", "category")
