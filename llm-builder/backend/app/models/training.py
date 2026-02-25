from datetime import datetime
import enum
from sqlalchemy import Column, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class TrainingJobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TrainingDataset(Base):
    __tablename__ = "training_datasets"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    storage_path = Column(String(1024), nullable=False)
    format = Column(String(32), nullable=False, default="jsonl")  # jsonl, json
    row_count = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(String(36), primary_key=True, index=True)
    dataset_id = Column(String(36), ForeignKey("training_datasets.id", ondelete="CASCADE"), nullable=False)
    base_model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(32), nullable=False, default=TrainingJobStatus.QUEUED.value)
    config = Column(JSONB, nullable=True)  # epochs, lr, lora_r, etc.
    error_message = Column(Text, nullable=True)
    result_model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="SET NULL"), nullable=True)
    metrics = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
