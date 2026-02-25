"""Training datasets and jobs

Revision ID: 006
Revises: 005
Create Date: 2025-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "training_datasets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("format", sa.String(32), nullable=False, server_default="jsonl"),
        sa.Column("row_count", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "training_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("training_datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("base_model_id", sa.String(36), sa.ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_model_id", sa.String(36), sa.ForeignKey("model_registry.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_training_jobs_dataset_id", "training_jobs", ["dataset_id"])
    op.create_index("ix_training_jobs_status", "training_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_training_jobs_status", table_name="training_jobs")
    op.drop_index("ix_training_jobs_dataset_id", table_name="training_jobs")
    op.drop_table("training_jobs")
    op.drop_table("training_datasets")
