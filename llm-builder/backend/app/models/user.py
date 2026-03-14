import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String

from app.db.base import Base


class Role(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    DEVELOPER = "developer"
    TESTER = "tester"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(Enum(Role, values_callable=lambda x: [e.value for e in x]), default=Role.ADMIN, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    default_model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="SET NULL"), nullable=True)
    default_prompt_id = Column(String(36), ForeignKey("prompt_templates.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
