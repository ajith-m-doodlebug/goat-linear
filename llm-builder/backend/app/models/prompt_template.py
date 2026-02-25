from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # e.g. "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
    version = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
