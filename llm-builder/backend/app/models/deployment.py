from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(String(36), primary_key=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False)
    knowledge_base_id = Column(String(36), ForeignKey("knowledge_bases.id", ondelete="SET NULL"), nullable=True)
    intent_mapper_id = Column(String(36), ForeignKey("intent_mappers.id", ondelete="SET NULL"), nullable=True)
    prompt_template_id = Column(String(36), ForeignKey("prompt_templates.id", ondelete="SET NULL"), nullable=True)
    is_hosted = Column(Boolean, nullable=False, default=False)
    live_version = Column(String(36), ForeignKey("deployment_versions.id", ondelete="SET NULL"), nullable=True)
    canvas_state = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
