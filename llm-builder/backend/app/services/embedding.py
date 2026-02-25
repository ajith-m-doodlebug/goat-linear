"""Lazy-loaded embedding model for query encoding (e.g. retrieval). Same model as worker."""
_model = None
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def get_embedding_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def encode_query(query: str) -> list[float]:
    model = get_embedding_model()
    return model.encode(query).tolist()
