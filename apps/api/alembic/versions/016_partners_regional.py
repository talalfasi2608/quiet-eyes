"""partners, referrals, regional config, global config

Revision ID: 016
Revises: 015
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Partner status enum ──
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partnerstatus') THEN
                CREATE TYPE partnerstatus AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
            END IF;
        END $$;
    """)

    # ── Referral status enum ──
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referralstatus') THEN
                CREATE TYPE referralstatus AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
            END IF;
        END $$;
    """)

    # ── Partners table ──
    op.create_table(
        "partners",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("contact_email", sa.String(320), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("status", sa.Enum("ACTIVE", "SUSPENDED", "PENDING", name="partnerstatus", create_type=False), nullable=False, server_default="PENDING"),
        sa.Column("region", sa.String(50), nullable=True),
        sa.Column("tier", sa.String(50), nullable=True),
        sa.Column("commission_pct", sa.Float, nullable=True, server_default="10.0"),
        sa.Column("config", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_partners_status", "partners", ["status"])
    op.create_index("ix_partners_contact_email", "partners", ["contact_email"], unique=True)

    # ── Partner-Org link ──
    op.create_table(
        "partner_orgs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_partner_orgs_partner", "partner_orgs", ["partner_id"])
    op.create_index("ix_partner_orgs_org", "partner_orgs", ["org_id"])
    op.create_index("uq_partner_orgs_pair", "partner_orgs", ["partner_id", "org_id"], unique=True)

    # ── Partner-User link (partner team members) ──
    op.create_table(
        "partner_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("uq_partner_users_pair", "partner_users", ["partner_id", "user_id"], unique=True)

    # ── Referrals ──
    op.create_table(
        "partner_referrals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=False),
        sa.Column("referral_code", sa.String(100), nullable=False, unique=True),
        sa.Column("invitee_email", sa.String(320), nullable=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=True),
        sa.Column("status", sa.Enum("PENDING", "ACCEPTED", "EXPIRED", "REVOKED", name="referralstatus", create_type=False), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_partner_referrals_partner", "partner_referrals", ["partner_id"])
    op.create_index("ix_partner_referrals_code", "partner_referrals", ["referral_code"], unique=True)

    # ── Regional configs ──
    op.create_table(
        "regional_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("region_code", sa.String(10), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("timezone", sa.String(100), nullable=False, server_default="UTC"),
        sa.Column("ad_platforms", JSONB, nullable=True),
        sa.Column("compliance_flags", JSONB, nullable=True),
        sa.Column("source_rules", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_regional_configs_code", "regional_configs", ["region_code"], unique=True)

    # ── Global configs ──
    op.create_table(
        "global_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("config_type", sa.String(100), nullable=False),
        sa.Column("config_key", sa.String(255), nullable=False),
        sa.Column("value", JSONB, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_global_configs_type_key", "global_configs", ["config_type", "config_key"], unique=True)

    # ── Add region to businesses and orgs ──
    op.add_column("businesses", sa.Column("region", sa.String(10), nullable=True))
    op.add_column("orgs", sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("orgs", "partner_id")
    op.drop_column("businesses", "region")
    op.drop_table("global_configs")
    op.drop_table("regional_configs")
    op.drop_table("partner_referrals")
    op.drop_table("partner_users")
    op.drop_table("partner_orgs")
    op.drop_table("partners")
    op.execute("DROP TYPE IF EXISTS referralstatus")
    op.execute("DROP TYPE IF EXISTS partnerstatus")
