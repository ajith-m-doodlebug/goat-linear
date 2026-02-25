"""Prompt templates and deployments

Revision ID: 004
Revises: 003
Create Date: 2025-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("version", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "deployments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("model_id", sa.String(36), sa.ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("knowledge_base_id", sa.String(36), sa.ForeignKey("knowledge_bases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("prompt_template_id", sa.String(36), sa.ForeignKey("prompt_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("memory_turns", sa.String(16), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("version", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_deployments_model_id", "deployments", ["model_id"])
    op.create_index("ix_deployments_knowledge_base_id", "deployments", ["knowledge_base_id"])


def downgrade() -> None:
    op.drop_index("ix_deployments_knowledge_base_id", table_name="deployments")
    op.drop_index("ix_deployments_model_id", table_name="deployments")
    op.drop_table("deployments")
    op.drop_table("prompt_templates")
