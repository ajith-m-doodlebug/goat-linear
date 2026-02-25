from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    api_key_id = Column(String(36), nullable=True, index=True)
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(36), nullable=True)
    request_id = Column(String(64), nullable=True)
    details = Column(JSONB, nullable=True)  # sanitized payload for sensitive actions
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False)  # hash of the secret key
    key_prefix = Column(String(16), nullable=False)  # first chars for display, e.g. "llmb_..."
    scopes = Column(JSONB, nullable=True)  # e.g. ["deployments:run", "models:read"]
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
