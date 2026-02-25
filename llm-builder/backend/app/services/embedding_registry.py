"""Embedding model registry: model_id -> vector size, optional query/passage prefixes. Used at ingest and RAG."""
from __future__ import annotations

# Model ID (sentence-transformers) -> (vector_size, default_query_prefix, default_passage_prefix)
# None prefix = no prefix applied
EMBEDDING_MODELS: dict[str, tuple[int, str | None, str | None]] = {
    "all-MiniLM-L6-v2": (384, None, None),
    "all-mpnet-base-v2": (768, None, None),
    "BAAI/bge-small-en-v1.5": (384, "Represent this sentence for searching relevant passages: ", None),
    "BAAI/bge-base-en-v1.5": (768, "Represent this sentence for searching relevant passages: ", None),
    "intfloat/e5-small-v2": (384, "query: ", "passage: "),
    "intfloat/e5-base-v2": (768, "query: ", "passage: "),
}

DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def get_vector_size(model_id: str) -> int:
    """Return vector dimension for model_id. Falls back to default model size if unknown."""
    if not model_id:
        model_id = DEFAULT_EMBEDDING_MODEL
    entry = EMBEDDING_MODELS.get(model_id)
    if entry:
        return entry[0]
    return EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL][0]


def get_query_prefix(model_id: str, config_prefix: str | None) -> str | None:
    """Return query prefix: config override, else registry default, else None."""
    if config_prefix is not None and config_prefix != "":
        return config_prefix
    if not model_id:
        model_id = DEFAULT_EMBEDDING_MODEL
    entry = EMBEDDING_MODELS.get(model_id)
    if entry:
        return entry[1]
    return EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL][1]


def get_passage_prefix(model_id: str) -> str | None:
    """Return passage prefix for documents (from registry only)."""
    if not model_id:
        model_id = DEFAULT_EMBEDDING_MODEL
    entry = EMBEDDING_MODELS.get(model_id)
    if entry:
        return entry[2]
    return EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL][2]


_loaded_models: dict[str, object] = {}


def get_embedding_model(model_id: str | None = None):
    """Load and cache SentenceTransformer by model_id. Uses default if model_id is None or unknown."""
    from sentence_transformers import SentenceTransformer

    mid = model_id or DEFAULT_EMBEDDING_MODEL
    if mid not in _loaded_models:
        _loaded_models[mid] = SentenceTransformer(mid)
    return _loaded_models[mid]


def encode_query(query: str, model_id: str | None = None, query_prefix: str | None = None) -> list[float]:
    """Encode a single query for retrieval. Applies query_prefix if provided (or from registry)."""
    mid = model_id or DEFAULT_EMBEDDING_MODEL
    prefix = get_query_prefix(mid, query_prefix)
    text = (prefix + query).strip() if prefix else query
    model = get_embedding_model(mid)
    return model.encode(text).tolist()


def encode_passages(
    texts: list[str],
    model_id: str | None = None,
    passage_prefix: str | None = None,
) -> list[list[float]]:
    """Encode document chunks. Applies passage_prefix if the model uses one (e.g. E5)."""
    mid = model_id or DEFAULT_EMBEDDING_MODEL
    pfix = passage_prefix if passage_prefix is not None else get_passage_prefix(mid)
    if pfix:
        texts = [(pfix + t).strip() for t in texts]
    model = get_embedding_model(mid)
    return [row.tolist() for row in model.encode(texts)]
