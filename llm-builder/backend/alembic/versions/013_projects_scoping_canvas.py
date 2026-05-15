"""Projects, membership, project_id scoping, deployment.canvas_state

Revision ID: 013
Revises: 012
Create Date: 2026-05-11

Expects scoped tables (knowledge bases, deployments, …) to be empty when this runs
(e.g. after ./setup.sh). No backfill / no seeded project; create projects from the app after login.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN CREATE TYPE project_member_access AS ENUM ('view', 'edit');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )
    member_access = postgresql.ENUM("view", "edit", name="project_member_access", create_type=False)

    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cloned_from_project_id", sa.String(length=36), nullable=True),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["cloned_from_project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_id"), "projects", ["id"], unique=False)
    op.create_index(op.f("ix_projects_owner_user_id"), "projects", ["owner_user_id"], unique=False)

    op.create_table(
        "project_members",
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("access", member_access, nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "user_id"),
    )

    op.add_column("knowledge_bases", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_knowledge_bases_project_id",
        "knowledge_bases",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_knowledge_bases_project_id"), "knowledge_bases", ["project_id"], unique=False)

    op.add_column("intent_mappers", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_intent_mappers_project_id",
        "intent_mappers",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_intent_mappers_project_id"), "intent_mappers", ["project_id"], unique=False)

    op.add_column("deployments", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_deployments_project_id",
        "deployments",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_deployments_project_id"), "deployments", ["project_id"], unique=False)
    op.add_column("deployments", sa.Column("canvas_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.add_column("prompt_templates", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_prompt_templates_project_id",
        "prompt_templates",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_prompt_templates_project_id"), "prompt_templates", ["project_id"], unique=False)

    op.add_column("rag_config_presets", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_rag_config_presets_project_id",
        "rag_config_presets",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_rag_config_presets_project_id"), "rag_config_presets", ["project_id"], unique=False)

    # Fresh DB after ./setup.sh: scoped tables must be empty so NOT NULL succeeds. Projects are created in-app.
    op.alter_column("knowledge_bases", "project_id", existing_type=sa.String(36), nullable=False)
    op.alter_column("intent_mappers", "project_id", existing_type=sa.String(36), nullable=False)
    op.alter_column("deployments", "project_id", existing_type=sa.String(36), nullable=False)
    op.alter_column("prompt_templates", "project_id", existing_type=sa.String(36), nullable=False)
    op.alter_column("rag_config_presets", "project_id", existing_type=sa.String(36), nullable=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_rag_config_presets_project_id"), table_name="rag_config_presets")
    op.drop_constraint("fk_rag_config_presets_project_id", "rag_config_presets", type_="foreignkey")
    op.drop_column("rag_config_presets", "project_id")

    op.drop_index(op.f("ix_prompt_templates_project_id"), table_name="prompt_templates")
    op.drop_constraint("fk_prompt_templates_project_id", "prompt_templates", type_="foreignkey")
    op.drop_column("prompt_templates", "project_id")

    op.drop_column("deployments", "canvas_state")
    op.drop_index(op.f("ix_deployments_project_id"), table_name="deployments")
    op.drop_constraint("fk_deployments_project_id", "deployments", type_="foreignkey")
    op.drop_column("deployments", "project_id")

    op.drop_index(op.f("ix_intent_mappers_project_id"), table_name="intent_mappers")
    op.drop_constraint("fk_intent_mappers_project_id", "intent_mappers", type_="foreignkey")
    op.drop_column("intent_mappers", "project_id")

    op.drop_index(op.f("ix_knowledge_bases_project_id"), table_name="knowledge_bases")
    op.drop_constraint("fk_knowledge_bases_project_id", "knowledge_bases", type_="foreignkey")
    op.drop_column("knowledge_bases", "project_id")

    op.drop_table("project_members")
    op.drop_index(op.f("ix_projects_owner_user_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_id"), table_name="projects")
    op.drop_table("projects")

    op.execute("DROP TYPE IF EXISTS project_member_access")
