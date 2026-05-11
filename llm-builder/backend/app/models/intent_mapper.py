from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from app.db.base import Base


class IntentMapper(Base):
    __tablename__ = "intent_mappers"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    routing_model_id = Column(String(36), ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False)
    knowledge_base_id = Column(String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntentMapperDocument(Base):
    """Per-document intent description for a mapper (links mapper → KB document)."""

    __tablename__ = "intent_mapper_documents"

    intent_mapper_id = Column(String(36), ForeignKey("intent_mappers.id", ondelete="CASCADE"), primary_key=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    intent_text = Column(Text, nullable=False)
