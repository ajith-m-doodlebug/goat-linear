import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text

from app.db.base import Base


class ProjectMemberAccess(str, enum.Enum):
    VIEW = "view"
    EDIT = "edit"


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    cloned_from_project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    archived_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    access = Column(
        Enum(ProjectMemberAccess, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ProjectMemberAccess.VIEW,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
