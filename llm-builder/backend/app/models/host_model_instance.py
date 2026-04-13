from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class HostModelInstance(Base):
    __tablename__ = "host_model_instances"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    engine = Column(String(32), nullable=False, default="vllm")
    model_source = Column(String(32), nullable=False, default="local_path")
    model_ref = Column(String(1024), nullable=False)
    served_model_name = Column(String(255), nullable=False)
    gpu_ids = Column(String(128), nullable=False, default="0")
    tensor_parallel_size = Column(Integer, nullable=False, default=1)
    port = Column(Integer, nullable=False, unique=True)
    base_url = Column(String(1024), nullable=False)
    api_key = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="creating")
    health_message = Column(Text, nullable=True)
    container_id = Column(String(128), nullable=True)
    last_log_excerpt = Column(Text, nullable=True)
    config = Column(JSONB, nullable=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
