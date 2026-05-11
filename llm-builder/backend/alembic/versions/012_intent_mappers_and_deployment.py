"""Intent mappers, deployment.intent_mapper_id

Revision ID: 012
Revises: 011
Create Date: 2026-05-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "intent_mappers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("routing_model_id", sa.String(length=36), sa.ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("knowledge_base_id", sa.String(length=36), sa.ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_intent_mappers_id"), "intent_mappers", ["id"], unique=False)

    op.create_table(
        "intent_mapper_documents",
        sa.Column("intent_mapper_id", sa.String(length=36), sa.ForeignKey("intent_mappers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(length=36), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("intent_text", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("intent_mapper_id", "document_id"),
    )

    op.add_column(
        "deployments",
        sa.Column("intent_mapper_id", sa.String(length=36), sa.ForeignKey("intent_mappers.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("deployments", "intent_mapper_id")
    op.drop_table("intent_mapper_documents")
    op.drop_index(op.f("ix_intent_mappers_id"), table_name="intent_mappers")
    op.drop_table("intent_mappers")
