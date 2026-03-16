"""predictive scores table

Revision ID: 015
Revises: 014
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'predictiveentitytype') THEN
                CREATE TYPE predictiveentitytype AS ENUM ('LEAD', 'AUDIENCE', 'CAMPAIGN');
            END IF;
        END $$;
    """)

    op.create_table(
        "predictive_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("entity_type", sa.Enum("LEAD", "AUDIENCE", "CAMPAIGN", name="predictiveentitytype", create_type=False), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("predicted_conversion_score", sa.Integer, default=0),
        sa.Column("predicted_roi", sa.Float, nullable=True),
        sa.Column("model_version", sa.String(50), default="v1"),
        sa.Column("contributing_signals", JSONB, nullable=True),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_predictive_scores_business_entity", "predictive_scores", ["business_id", "entity_type", "entity_id"])
    op.create_index("ix_predictive_scores_entity", "predictive_scores", ["entity_type", "entity_id"])


def downgrade() -> None:
    op.drop_table("predictive_scores")
    op.execute("DROP TYPE IF EXISTS predictiveentitytype")
