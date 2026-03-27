"""HostedSessionMessage: conversation history for hosted API when memory is enabled."""
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class HostedSessionMessage(Base):
    __tablename__ = "hosted_session_messages"

    id = Column(String(36), primary_key=True, index=True)
    deployment_id = Column(String(36), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id = Column(String(36), ForeignKey("deployment_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(255), nullable=False, index=True)  # client-provided
    role = Column(String(32), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    attachments = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
