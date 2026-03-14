"""Roles and system_settings

Revision ID: 008
Revises: 007
Create Date: 2025-03-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new values to role enum (idempotent; IF NOT EXISTS in PG 9.1+)
    op.execute(
        "DO $$ BEGIN ALTER TYPE role ADD VALUE IF NOT EXISTS 'super_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )
    op.execute(
        "DO $$ BEGIN ALTER TYPE role ADD VALUE IF NOT EXISTS 'developer'; EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )
    op.execute(
        "DO $$ BEGIN ALTER TYPE role ADD VALUE IF NOT EXISTS 'tester'; EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )

    op.create_table(
        "system_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("allowed_email_domain", sa.String(255), nullable=False),
        sa.Column("setup_completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("system_settings")
    # PostgreSQL does not support removing enum values easily; leave role enum as-is