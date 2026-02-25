from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from app.core.config import get_settings

# Vector size for default embedding model (e.g. all-MiniLM-L6-v2 = 384, bge-small = 384)
DEFAULT_VECTOR_SIZE = 384


def get_qdrant() -> QdrantClient:
    settings = get_settings()
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
    )


def ensure_collection(client: QdrantClient, collection_name: str, vector_size: int = DEFAULT_VECTOR_SIZE) -> None:
    collections = client.get_collections().collections
    if not any(c.name == collection_name for c in collections):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )


def upsert_points(
    client: QdrantClient,
    collection_name: str,
    points: list[PointStruct],
) -> None:
    if points:
        client.upsert(collection_name=collection_name, points=points)


def delete_points_by_document(client: QdrantClient, collection_name: str, document_id: str) -> None:
    """Delete all points in collection that belong to the given document."""
    from qdrant_client.models import FilterSelector
    try:
        client.delete(
            collection_name=collection_name,
            points_selector=FilterSelector(
                filter=Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))])
            ),
        )
    except Exception:
        pass
