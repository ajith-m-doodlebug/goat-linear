from pydantic import BaseModel

from app.services.document_parser import DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, DEFAULT_STRATEGY
from app.services.embedding_registry import DEFAULT_EMBEDDING_MODEL


def app_defaults() -> dict:
    """Default RAG config when KB and document have no config."""
    return {
        "chunk_strategy": DEFAULT_STRATEGY,
        "chunk_size": DEFAULT_CHUNK_SIZE,
        "chunk_overlap": DEFAULT_CHUNK_OVERLAP,
        "embedding_model": DEFAULT_EMBEDDING_MODEL,
        "embedding_query_prefix": None,
    }


def resolve_effective_config(
    document_config: dict | None,
    kb_config: dict | None,
) -> dict:
    """effective = document.config ?? knowledge_base.config ?? app_defaults (merge)."""
    base = {**app_defaults(), **(kb_config or {}), **(document_config or {})}
    return {k: v for k, v in base.items() if v is not None}


def resolve_embedding_for_kb(kb_config: dict | None) -> dict:
    """Embedding (model + query prefix) from KB only, so one KB = one vector size."""
    base = app_defaults()
    if kb_config:
        if kb_config.get("embedding_model"):
            base["embedding_model"] = kb_config["embedding_model"]
        if "embedding_query_prefix" in kb_config:
            base["embedding_query_prefix"] = kb_config["embedding_query_prefix"]
    return base


# Same shape used in KB config and document config
class RagConfigSchema(BaseModel):
    chunk_strategy: str | None = None  # fixed, paragraph, sentence, recursive
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    embedding_model: str | None = None
    embedding_query_prefix: str | None = None


class RagConfigPresetCreate(BaseModel):
    name: str
    description: str | None = None
    config: dict = {}  # chunk_strategy, chunk_size, chunk_overlap, embedding_model, embedding_query_prefix


class RagConfigPresetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    config: dict | None = None


class RagConfigPresetResponse(BaseModel):
    id: str
    name: str
    description: str | None
    config: dict
    created_at: str

    class Config:
        from_attributes = True
