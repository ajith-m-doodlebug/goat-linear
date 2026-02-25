from pydantic import BaseModel
from app.models.document import DocumentStatus


class DocumentUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None
    preset_id: str | None = None


class DocumentResponse(BaseModel):
    id: str
    knowledge_base_id: str
    name: str
    source_type: str
    status: DocumentStatus
    error_message: str | None
    config: dict | None = None  # override for chunking/embedding for this document
    created_at: str

    class Config:
        from_attributes = True
