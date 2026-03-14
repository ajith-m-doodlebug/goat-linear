from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.db.base import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(String(36), primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    allowed_email_domain = Column(String(255), nullable=False)
    setup_completed_at = Column(DateTime, nullable=True)
    default_model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="SET NULL"), nullable=True)
    default_prompt_id = Column(String(36), ForeignKey("prompt_templates.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
