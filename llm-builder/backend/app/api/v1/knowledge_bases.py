import os
import re
import uuid
from typing import Annotated

import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document, DocumentStatus
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse
from app.schemas.document import DocumentResponse, DocumentUpdate
from app.core.deps import get_current_user, require_admin
from app.core.config import get_settings
from app.core.queue import get_queue
from app.workers.ingest import run_ingest
from app.services.qdrant_client import get_qdrant
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.embedding_registry import encode_query as encode_query_with_model

router = APIRouter()

# Safe upload: only types the ingest worker can parse; max 50 MB
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".doc", ".html", ".htm"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _safe_basename(filename: str) -> str:
    """Return a safe filename (no path, no dangerous chars)."""
    name = os.path.basename(filename or "document").strip() or "document"
    name = re.sub(r"[^\w\s.\-]", "", name)[:200]
    return name or "document"


def _kb_to_response(kb: KnowledgeBase) -> KnowledgeBaseResponse:
    config = getattr(kb, "config", None)
    if config is not None and not isinstance(config, dict):
        config = None
    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        qdrant_collection_name=kb.qdrant_collection_name,
        config=config,
        created_at=kb.created_at.isoformat() if kb.created_at else "",
    )


def _doc_to_response(doc: Document) -> DocumentResponse:
    config = getattr(doc, "config", None)
    if config is not None and not isinstance(config, dict):
        config = None
    return DocumentResponse(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        name=doc.name,
        source_type=doc.source_type,
        status=doc.status,
        error_message=doc.error_message,
        config=config,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
    )


def _resolve_config_from_preset(preset_id: str | None, config: dict | None, user_id: str, db: Session) -> dict | None:
    """If preset_id is set, load preset config and merge with optional config; else return config."""
    if not preset_id:
        return config
    from app.models.rag_config_preset import RagConfigPreset
    preset = db.query(RagConfigPreset).filter(RagConfigPreset.id == preset_id, RagConfigPreset.user_id == user_id).first()
    if not preset:
        return config
    base = dict(preset.config or {})
    base.update(config or {})
    return base


@router.get("", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    bases = db.query(KnowledgeBase).all()
    return [_kb_to_response(kb) for kb in bases]


@router.post("", response_model=KnowledgeBaseResponse)
def create_knowledge_base(
    body: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    resolved = _resolve_config_from_preset(body.preset_id, body.config, str(user.id), db)
    collection_name = f"kb_{uuid.uuid4().hex[:16]}"
    kb = KnowledgeBase(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        qdrant_collection_name=collection_name,
        config=resolved,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return _kb_to_response(kb)


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(
    kb_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return _kb_to_response(kb)


@router.patch("/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    kb_id: str,
    body: KnowledgeBaseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    if body.name is not None:
        kb.name = body.name
    if body.description is not None:
        kb.description = body.description
    if body.preset_id is not None or body.config is not None:
        resolved = _resolve_config_from_preset(body.preset_id, body.config, str(user.id), db)
        if resolved is not None:
            kb.config = resolved
    db.commit()
    db.refresh(kb)
    return _kb_to_response(kb)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    kb_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    db.delete(kb)
    db.commit()
    return None


@router.get("/{kb_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    kb_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    docs = db.query(Document).filter(Document.knowledge_base_id == kb_id).order_by(Document.created_at.desc()).all()
    return [_doc_to_response(d) for d in docs]


@router.post("/{kb_id}/upload", response_model=DocumentResponse)
async def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    config: str | None = Form(None),
    preset_id: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    safe_name = _safe_basename(file.filename or "document")
    ext = os.path.splitext(safe_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Use: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    settings = get_settings()
    upload_dir = os.path.join(settings.upload_dir, kb_id)
    os.makedirs(upload_dir, exist_ok=True)
    doc_id = str(uuid.uuid4())
    storage_path = os.path.join(kb_id, f"{doc_id}{ext}")
    full_path = os.path.join(settings.upload_dir, storage_path)
    content = b""
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        if len(content) + len(chunk) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Max size: {MAX_UPLOAD_BYTES // (1024*1024)} MB",
            )
        content += chunk
    with open(full_path, "wb") as f:
        f.write(content)

    doc_config = None
    if config or preset_id:
        config_dict = None
        if config:
            try:
                config_dict = json.loads(config) if isinstance(config, str) else config
            except (json.JSONDecodeError, TypeError):
                config_dict = None
        doc_config = _resolve_config_from_preset(preset_id, config_dict, str(user.id), db)

    doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        name=safe_name,
        source_type="file",
        storage_path=storage_path,
        status=DocumentStatus.PENDING,
        config=doc_config,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    queue = get_queue()
    queue.enqueue(run_ingest, doc_id, job_timeout="10m")
    return _doc_to_response(doc)


@router.post("/{kb_id}/search")
def search(
    kb_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Search knowledge base by query. Body: { \"query\": \"...\", \"top_k\": 5 }"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    query_text = body.get("query") or ""
    top_k = min(int(body.get("top_k", 5)), 20)
    if not query_text.strip():
        return {"results": []}
    emb = resolve_embedding_for_kb(kb.config)
    vector = encode_query_with_model(
        query_text.strip(),
        model_id=emb.get("embedding_model"),
        query_prefix=emb.get("embedding_query_prefix"),
    )
    client = get_qdrant()
    try:
        results = client.search(
            collection_name=kb.qdrant_collection_name,
            query_vector=vector,
            limit=top_k,
            with_payload=True,
        )
        return {
            "results": [
                {"text": r.payload.get("text", ""), "source": r.payload.get("source", ""), "score": r.score}
                for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.patch("/{kb_id}/documents/{document_id}", response_model=DocumentResponse)
def update_document(
    kb_id: str,
    document_id: str,
    body: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    doc = db.query(Document).filter(Document.id == document_id, Document.knowledge_base_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if body.name is not None:
        doc.name = body.name
    if body.preset_id is not None or body.config is not None:
        resolved = _resolve_config_from_preset(body.preset_id, body.config, str(user.id), db)
        if resolved is not None:
            doc.config = resolved
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


@router.delete("/{kb_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    kb_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    doc = db.query(Document).filter(Document.id == document_id, Document.knowledge_base_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    db.delete(doc)
    db.commit()
    return None


@router.post("/{kb_id}/documents/{document_id}/ingest", response_model=DocumentResponse)
def trigger_ingest(
    kb_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    doc = db.query(Document).filter(Document.id == document_id, Document.knowledge_base_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.status == DocumentStatus.PROCESSING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document already processing")
    doc.status = DocumentStatus.PENDING
    doc.error_message = None
    db.commit()
    db.refresh(doc)
    queue = get_queue()
    queue.enqueue(run_ingest, document_id, job_timeout="10m")
    return _doc_to_response(doc)
