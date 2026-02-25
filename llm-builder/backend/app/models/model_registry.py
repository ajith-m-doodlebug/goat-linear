from datetime import datetime
import enum
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class ModelProvider(str, enum.Enum):
    OLLAMA = "ollama"
    VLLM = "vllm"
    OPENAI = "openai"
    CUSTOM = "custom"


class ModelType(str, enum.Enum):
    BASE = "base"
    FINE_TUNED = "fine_tuned"


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    model_type = Column(String(32), nullable=False, default=ModelType.BASE.value)
    provider = Column(String(32), nullable=False)  # ollama, vllm, openai, custom
    endpoint_url = Column(String(1024), nullable=True)  # base URL for API
    model_id = Column(String(255), nullable=False)  # e.g. llama2, gpt-4, model name
    api_key_encrypted = Column(Text, nullable=True)  # optional; for openai/custom
    config = Column(JSONB, nullable=True)  # extra params (temperature, max_tokens, etc.)
    version = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
