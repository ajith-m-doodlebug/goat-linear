from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.db.base import Base


class ProjectModelLink(Base):
    __tablename__ = "project_model_links"

    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
