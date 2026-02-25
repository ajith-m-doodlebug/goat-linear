from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    qdrant_collection_name = Column(String(255), unique=True, nullable=False, index=True)
    config = Column(JSONB, nullable=True)  # chunk_strategy, chunk_size, chunk_overlap, embedding_model, embedding_query_prefix
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
