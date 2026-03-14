"""Default model and prompt on system_settings and users

Revision ID: 009
Revises: 008
Create Date: 2025-03-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("default_model_id", sa.String(36), nullable=True),
    )
    op.add_column(
        "system_settings",
        sa.Column("default_prompt_id", sa.String(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_system_settings_default_model",
        "system_settings",
        "model_registry",
        ["default_model_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_system_settings_default_prompt",
        "system_settings",
        "prompt_templates",
        ["default_prompt_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "users",
        sa.Column("default_model_id", sa.String(36), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("default_prompt_id", sa.String(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_default_model",
        "users",
        "model_registry",
        ["default_model_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_default_prompt",
        "users",
        "prompt_templates",
        ["default_prompt_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_default_prompt", "users", type_="foreignkey")
    op.drop_constraint("fk_users_default_model", "users", type_="foreignkey")
    op.drop_column("users", "default_prompt_id")
    op.drop_column("users", "default_model_id")

    op.drop_constraint("fk_system_settings_default_prompt", "system_settings", type_="foreignkey")
    op.drop_constraint("fk_system_settings_default_model", "system_settings", type_="foreignkey")
    op.drop_column("system_settings", "default_prompt_id")
    op.drop_column("system_settings", "default_model_id")
