"""project_model_links — curated registry models per project

Revision ID: 014
Revises: 013
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_model_links",
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("model_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["model_id"], ["model_registry.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "model_id"),
    )
    op.create_index(op.f("ix_project_model_links_model_id"), "project_model_links", ["model_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_model_links_model_id"), table_name="project_model_links")
    op.drop_table("project_model_links")
