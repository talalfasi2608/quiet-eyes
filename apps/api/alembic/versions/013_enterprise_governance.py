"""Enterprise governance: role permissions, approval policies, failed jobs

Revision ID: 013
Revises: 012
Create Date: 2026-03-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Add new UserRole enum values ---
    # PostgreSQL ALTER TYPE ADD VALUE cannot run inside a transaction,
    # so we commit the current transaction first.
    op.get_bind().execute(sa.text("COMMIT"))
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'ANALYST'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'MARKETING_MANAGER'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'APPROVER'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'BILLING_ADMIN'")

    # --- role_permissions table ---
    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("permission", sa.String(100), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("org_id", "role", "permission", name="uq_role_permissions_org_role_perm"),
    )
    op.create_index("ix_role_permissions_org_id", "role_permissions", ["org_id"])

    # --- approval_policies table ---
    op.create_table(
        "approval_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("action_type", sa.String(50)),
        sa.Column("conditions", postgresql.JSONB),
        sa.Column("required_role", sa.String(50)),
        sa.Column("auto_approve", sa.Boolean, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("priority", sa.Integer, server_default=sa.text("0")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_approval_policies_org_id", "approval_policies", ["org_id"])

    # --- failed_jobs table ---
    op.create_table(
        "failed_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_type", sa.String(100), nullable=False),
        sa.Column("job_id", sa.String(255)),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=True),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("error_message", sa.Text),
        sa.Column("error_traceback", sa.Text),
        sa.Column("retry_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("max_retries", sa.Integer, server_default=sa.text("3")),
        sa.Column("status", sa.String(20), server_default=sa.text("'FAILED'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_failed_jobs_status_created", "failed_jobs", ["status", "created_at"])
    op.create_index("ix_failed_jobs_business_id", "failed_jobs", ["business_id"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index("ix_failed_jobs_business_id", table_name="failed_jobs")
    op.drop_index("ix_failed_jobs_status_created", table_name="failed_jobs")
    op.drop_table("failed_jobs")

    op.drop_index("ix_approval_policies_org_id", table_name="approval_policies")
    op.drop_table("approval_policies")

    op.drop_index("ix_role_permissions_org_id", table_name="role_permissions")
    op.drop_table("role_permissions")

    # Note: PostgreSQL does not support removing values from an enum type.
    # The ANALYST, MARKETING_MANAGER, APPROVER, BILLING_ADMIN values
    # will remain in the userrole enum after downgrade.
