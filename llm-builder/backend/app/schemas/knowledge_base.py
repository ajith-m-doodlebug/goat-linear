from pydantic import BaseModel


class KnowledgeBaseBase(BaseModel):
    name: str
    description: str | None = None


class KnowledgeBaseCreate(KnowledgeBaseBase):
    config: dict | None = None  # chunk_strategy, chunk_size, chunk_overlap, embedding_model, embedding_query_prefix
    preset_id: str | None = None  # if set, config is resolved from preset and overrides body.config


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    config: dict | None = None
    preset_id: str | None = None  # if set, config is resolved from preset


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: str
    qdrant_collection_name: str
    config: dict | None = None
    created_at: str

    class Config:
        from_attributes = True
