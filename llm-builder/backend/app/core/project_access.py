"""Project membership checks for scoped APIs."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.project import Project, ProjectMember, ProjectMemberAccess
from app.models.user import Role, User
from app.core.deps import get_current_user


def get_project_row(db: Session, project_id: str) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.archived_at.is_(None)).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return p


def user_can_view_project(db: Session, user: User, project_id: str) -> bool:
    if user.role == Role.SUPER_ADMIN:
        return db.query(Project).filter(Project.id == project_id, Project.archived_at.is_(None)).first() is not None
    p = get_project_row(db, project_id)
    if p.owner_user_id == user.id:
        return True
    m = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .first()
    )
    return m is not None


def user_can_edit_project(db: Session, user: User, project_id: str) -> bool:
    if user.role == Role.SUPER_ADMIN:
        return db.query(Project).filter(Project.id == project_id, Project.archived_at.is_(None)).first() is not None
    if user.role == Role.TESTER:
        return False
    p = get_project_row(db, project_id)
    if p.owner_user_id == user.id:
        return True
    m = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .first()
    )
    return m is not None and m.access == ProjectMemberAccess.EDIT


def assert_project_view(db: Session, user: User, project_id: str) -> None:
    if not user_can_view_project(db, user, project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this project")


def assert_project_edit(db: Session, user: User, project_id: str) -> None:
    if not user_can_edit_project(db, user, project_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Edit access required")


def require_project_view(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    assert_project_view(db, user, project_id)
    return user


def require_project_edit(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    assert_project_edit(db, user, project_id)
    return user


def deployment_in_project(db: Session, deployment_id: str, project_id: str) -> bool:
    from app.models.deployment import Deployment

    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    return bool(d and d.project_id == project_id)
