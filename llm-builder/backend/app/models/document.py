from datetime import datetime
import enum
from sqlalchemy import Column, DateTime, String, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, index=True)
    knowledge_base_id = Column(String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(512), nullable=False)  # filename or URL
    source_type = Column(String(32), nullable=False, default="file")  # file, url
    storage_path = Column(String(1024), nullable=True)  # relative path for file uploads
    status = Column(
        Enum(DocumentStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=DocumentStatus.PENDING,
        nullable=False,
    )
    error_message = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    config = Column(JSONB, nullable=True)  # override chunking + embedding for this document
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
