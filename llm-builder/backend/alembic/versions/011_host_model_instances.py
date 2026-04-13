"""Hosted model instances for vLLM

Revision ID: 011
Revises: 010
Create Date: 2026-04-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "host_model_instances",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("engine", sa.String(length=32), nullable=False),
        sa.Column("model_source", sa.String(length=32), nullable=False),
        sa.Column("model_ref", sa.String(length=1024), nullable=False),
        sa.Column("served_model_name", sa.String(length=255), nullable=False),
        sa.Column("gpu_ids", sa.String(length=128), nullable=False),
        sa.Column("tensor_parallel_size", sa.Integer(), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("base_url", sa.String(length=1024), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("health_message", sa.Text(), nullable=True),
        sa.Column("container_id", sa.String(length=128), nullable=True),
        sa.Column("last_log_excerpt", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("port"),
    )
    op.create_index(op.f("ix_host_model_instances_id"), "host_model_instances", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_host_model_instances_id"), table_name="host_model_instances")
    op.drop_table("host_model_instances")
