"""Ingest document: parse, chunk, embed, store in Qdrant."""
import os
import uuid

from app.core.config import get_settings
from app.db.base import SessionLocal
from app.models.document import Document, DocumentStatus
from app.models.knowledge_base import KnowledgeBase
from app.schemas.rag_config import resolve_effective_config, resolve_embedding_for_kb
from app.services.document_parser import extract_text_from_file, chunk_text
from app.services.documentation_parser import extract_documentation_from_zip
from app.services.embedding_registry import encode_passages, get_vector_size
from app.services.keywords import extract_keywords_from_text
from app.services.qdrant_client import (
    get_qdrant,
    ensure_collection,
    upsert_points,
    delete_points_by_document,
)
from qdrant_client.models import PointStruct

MAX_KEYWORDS_PER_CHUNK = 300


def run_ingest(document_id: str) -> None:
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return
        if doc.status not in (DocumentStatus.PENDING, DocumentStatus.FAILED):
            return
        doc.status = DocumentStatus.PROCESSING
        db.commit()

        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == doc.knowledge_base_id).first()
        if not kb:
            doc.status = DocumentStatus.FAILED
            doc.error_message = "Knowledge base not found"
            db.commit()
            return

        base = get_settings().upload_dir
        full_path = os.path.join(base, doc.storage_path) if doc.storage_path else ""

        if doc.source_type == "documentation_zip" and doc.storage_path and full_path.endswith(".zip"):
            if not os.path.isfile(full_path):
                doc.status = DocumentStatus.FAILED
                doc.error_message = f"File not found: {full_path}"
                db.commit()
                return
            try:
                doc_chunks = extract_documentation_from_zip(full_path)
            except Exception as e:
                doc.status = DocumentStatus.FAILED
                doc.error_message = str(e)[:2000]
                db.commit()
                return
            if not doc_chunks:
                doc.status = DocumentStatus.COMPLETED
                doc.error_message = None
                db.commit()
                return
            emb_config = resolve_embedding_for_kb(kb.config)
            embedding_model = emb_config.get("embedding_model") or "all-MiniLM-L6-v2"
            vector_size = get_vector_size(embedding_model)
            client = get_qdrant()
            ensure_collection(client, kb.qdrant_collection_name, vector_size=vector_size)
            delete_points_by_document(client, kb.qdrant_collection_name, doc.id)
            chunks = [t for t, _ in doc_chunks]
            vectors = encode_passages(chunks, model_id=embedding_model)
            points = []
            for i, ((chunk, meta), vec) in enumerate(zip(doc_chunks, vectors)):
                kw = extract_keywords_from_text(chunk, min_len=2, stop=None)[:MAX_KEYWORDS_PER_CHUNK]
                payload = {
                    "document_id": doc.id,
                    "chunk_index": i,
                    "text": chunk,
                    "source": doc.name,
                    "keywords": kw,
                }
                payload["source_path"] = meta.get("source_path")
                payload["breadcrumb"] = meta.get("breadcrumb")
                payload["heading"] = meta.get("heading")
                payload["section_index"] = meta.get("section_index")
                payload["total_sections_in_file"] = meta.get("total_sections_in_file")
                if meta.get("prev_heading") is not None:
                    payload["prev_heading"] = meta["prev_heading"]
                if meta.get("next_heading") is not None:
                    payload["next_heading"] = meta["next_heading"]
                points.append(
                    PointStruct(id=str(uuid.uuid4()), vector=vec, payload=payload)
                )
            upsert_points(client, kb.qdrant_collection_name, points)
        elif doc.source_type == "file" and doc.storage_path:
            if not os.path.isfile(full_path):
                doc.status = DocumentStatus.FAILED
                doc.error_message = f"File not found: {full_path}"
                db.commit()
                return
            text = extract_text_from_file(full_path)
            if not text.strip():
                doc.status = DocumentStatus.COMPLETED
                doc.error_message = None
                db.commit()
                return
            effective = resolve_effective_config(doc.config, kb.config)
            strategy = effective.get("chunk_strategy") or "fixed"
            chunk_size = effective.get("chunk_size") or 512
            chunk_overlap = effective.get("chunk_overlap") or 50
            chunks = chunk_text(text, strategy=strategy, chunk_size=chunk_size, overlap=chunk_overlap)
            if not chunks:
                doc.status = DocumentStatus.COMPLETED
                db.commit()
                return
            emb_config = resolve_embedding_for_kb(kb.config)
            embedding_model = emb_config.get("embedding_model") or "all-MiniLM-L6-v2"
            vector_size = get_vector_size(embedding_model)
            client = get_qdrant()
            ensure_collection(client, kb.qdrant_collection_name, vector_size=vector_size)
            delete_points_by_document(client, kb.qdrant_collection_name, doc.id)
            vectors = encode_passages(chunks, model_id=embedding_model)
            points = []
            for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
                kw = extract_keywords_from_text(chunk, min_len=2, stop=None)[:MAX_KEYWORDS_PER_CHUNK]
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vec,
                        payload={
                            "document_id": doc.id,
                            "chunk_index": i,
                            "text": chunk,
                            "source": doc.name,
                            "keywords": kw,
                        },
                    )
                )
            upsert_points(client, kb.qdrant_collection_name, points)
        else:
            doc.status = DocumentStatus.FAILED
            doc.error_message = "Unsupported source type or missing path"
            db.commit()
            return

        doc.status = DocumentStatus.COMPLETED
        doc.error_message = None
        db.commit()
    except Exception as e:
        if db:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                doc.error_message = str(e)[:2000]
            db.commit()
        raise
    finally:
        db.close()
