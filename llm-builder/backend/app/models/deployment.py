from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False)
    knowledge_base_id = Column(String(36), ForeignKey("knowledge_bases.id", ondelete="SET NULL"), nullable=True)
    prompt_template_id = Column(String(36), ForeignKey("prompt_templates.id", ondelete="SET NULL"), nullable=True)
    memory_turns = Column(String(16), nullable=True)  # e.g. "10" for last N turns
    config = Column(JSONB, nullable=True)  # top_k, temperature, etc.
    version = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
