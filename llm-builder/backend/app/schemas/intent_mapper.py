from typing import Any

from pydantic import BaseModel, Field


class IntentMapperDocumentItem(BaseModel):
    document_id: str
    intent_text: str = ""


class IntentMapperCreate(BaseModel):
    name: str
    routing_model_id: str
    knowledge_base_id: str
    documents: list[IntentMapperDocumentItem] = Field(default_factory=list)


class IntentMapperUpdate(BaseModel):
    name: str | None = None
    routing_model_id: str | None = None
    knowledge_base_id: str | None = None
    documents: list[IntentMapperDocumentItem] | None = None


class IntentMapperResponse(BaseModel):
    id: str
    name: str
    routing_model_id: str
    knowledge_base_id: str
    created_at: str

    class Config:
        from_attributes = True


class IntentMapperDetailResponse(IntentMapperResponse):
    documents: list[IntentMapperDocumentItem]


class IntentMapperTestRequest(BaseModel):
    question: str


class IntentMapperDocumentGuideItem(BaseModel):
    """Per-document view of what a deployment would use after routing."""

    document_id: str
    name: str
    source_type: str
    intent_text: str = ""
    selected: bool = False
    search_query: str | None = None
    api_method: str | None = None
    api_url: str | None = None
    api_body_template: str | None = None
    api_body_effective: Any | None = None
    database_allowed_tables: list[str] = Field(default_factory=list)
    database_table_effective: str | None = None
    database_limit_effective: int | None = None


class IntentMapperTestResponse(BaseModel):
    question: str
    router_error: str | None = None
    requested_document_id: str | None = None
    router_reason: str | None = None
    fallback_used: bool = False
    error: str | None = None
    selected_document_id: str | None = None
    documents: list[IntentMapperDocumentGuideItem] = Field(default_factory=list)
