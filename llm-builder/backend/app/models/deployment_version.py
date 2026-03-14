"""DeploymentVersion: frozen snapshot for hosted API (one per "Deploy" or "New version")."""
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class DeploymentVersion(Base):
    __tablename__ = "deployment_versions"

    id = Column(String(36), primary_key=True, index=True)
    deployment_id = Column(String(36), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True)
    version_label = Column(String(64), nullable=False)  # e.g. "v1", "v2"
    frozen_config = Column(JSONB, nullable=False)  # model, prompt, retriever, has_kb, vector_size, memory_enabled, memory_turns
    host_config = Column(JSONB, nullable=True)  # port, memory_enabled, memory_turns at deploy time
    status = Column(String(32), nullable=False, default="stopped")  # stopped | running
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)
