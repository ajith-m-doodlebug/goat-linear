"""Deployment versions and hosted session messages

Revision ID: 006
Revises: 005
Create Date: 2025-03-14

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
        "deployment_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deployment_id", sa.String(36), sa.ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_label", sa.String(64), nullable=False),
        sa.Column("frozen_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("host_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="stopped"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("stopped_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_deployment_versions_deployment_id", "deployment_versions", ["deployment_id"])
    op.create_index("ix_deployment_versions_status", "deployment_versions", ["status"])

    op.create_table(
        "hosted_session_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deployment_id", sa.String(36), sa.ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", sa.String(36), sa.ForeignKey("deployment_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_hosted_session_messages_deployment_id", "hosted_session_messages", ["deployment_id"])
    op.create_index("ix_hosted_session_messages_version_id", "hosted_session_messages", ["version_id"])
    op.create_index("ix_hosted_session_messages_session_id", "hosted_session_messages", ["session_id"])
    op.create_index("ix_hosted_session_messages_deployment_session", "hosted_session_messages", ["deployment_id", "session_id"])


def downgrade() -> None:
    op.drop_index("ix_hosted_session_messages_deployment_session", table_name="hosted_session_messages")
    op.drop_index("ix_hosted_session_messages_session_id", table_name="hosted_session_messages")
    op.drop_index("ix_hosted_session_messages_version_id", table_name="hosted_session_messages")
    op.drop_index("ix_hosted_session_messages_deployment_id", table_name="hosted_session_messages")
    op.drop_table("hosted_session_messages")
    op.drop_index("ix_deployment_versions_status", table_name="deployment_versions")
    op.drop_index("ix_deployment_versions_deployment_id", table_name="deployment_versions")
    op.drop_table("deployment_versions")
