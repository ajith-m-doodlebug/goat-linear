from pydantic import BaseModel, Field

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


class DocumentTestRequest(BaseModel):
    question: str | None = None
    request_body: dict | None = None
    table: str | None = None
    limit: int | None = Field(None, ge=1, le=200)
    top_k: int | None = Field(None, ge=1, le=20)


class DocumentTestResponse(BaseModel):
    ok: bool
    mode: str
    message: str | None = None
    snippets: list[str] | None = None
    citations: list[dict] | None = None
    api_ok: bool | None = None
    api_response: str | None = None
    database_preview: str | None = None
