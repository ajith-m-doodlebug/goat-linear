"""Deployments: remove memory_turns, config, version; add is_hosted, live_version

Revision ID: 007
Revises: 006
Create Date: 2025-03-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("deployments", sa.Column("is_hosted", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("deployments", sa.Column("live_version", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_deployments_live_version",
        "deployments",
        "deployment_versions",
        ["live_version"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_column("deployments", "memory_turns")
    op.drop_column("deployments", "config")
    op.drop_column("deployments", "version")


def downgrade() -> None:
    op.add_column("deployments", sa.Column("memory_turns", sa.String(16), nullable=True))
    op.add_column("deployments", sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("deployments", sa.Column("version", sa.String(64), nullable=True))

    op.drop_constraint("fk_deployments_live_version", "deployments", type_="foreignkey")
    op.drop_column("deployments", "live_version")
    op.drop_column("deployments", "is_hosted")
