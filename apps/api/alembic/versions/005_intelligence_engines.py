"""trends, competitor_events, reviews tables

Revision ID: 005
Revises: 004
Create Date: 2026-03-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE competitoreventtype AS ENUM ('OFFER_CHANGE', 'MESSAGE_CHANGE', 'CONTENT_CHANGE')")
    op.execute("CREATE TYPE reviewsentiment AS ENUM ('POS', 'NEU', 'NEG')")

    op.create_table(
        "trends",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("topic", sa.String(255), nullable=False),
        sa.Column("spike_score", sa.Integer, server_default="0"),
        sa.Column("window_days", sa.Integer, server_default="7"),
        sa.Column("evidence_urls", postgresql.ARRAY(sa.Text)),
        sa.Column("first_seen_at", sa.DateTime(timezone=True)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "competitor_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("competitor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("competitors.id"), nullable=False),
        sa.Column("event_type", sa.Enum("OFFER_CHANGE", "MESSAGE_CHANGE", "CONTENT_CHANGE", name="competitoreventtype", create_type=False), nullable=False),
        sa.Column("summary", sa.Text),
        sa.Column("evidence_urls", postgresql.ARRAY(sa.Text)),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id")),
        sa.Column("rating", sa.Integer),
        sa.Column("author", sa.Text),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("url", sa.String(2048)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("sentiment", sa.Enum("POS", "NEU", "NEG", name="reviewsentiment", create_type=False), server_default="NEU"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("reviews")
    op.drop_table("competitor_events")
    op.drop_table("trends")
    op.execute("DROP TYPE IF EXISTS reviewsentiment")
    op.execute("DROP TYPE IF EXISTS competitoreventtype")
