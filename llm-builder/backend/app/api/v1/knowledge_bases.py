import os
import re
import uuid
import json
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document, DocumentStatus
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse
from app.schemas.document import DocumentResponse, DocumentUpdate, DocumentTestRequest, DocumentTestResponse
from app.schemas.document_extensions import DocumentApiCreate, DocumentDatabaseCreate
from app.services.document_crypto import encrypt_secret
from app.services.document_db_validate import validate_database_document
from app.core.deps import get_current_user
from app.core.project_access import require_project_edit, require_project_view
from app.core.config import get_settings
from app.core.queue import get_queue
from app.workers.ingest import run_ingest
from app.services.qdrant_client import get_qdrant
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.embedding_registry import encode_query as encode_query_with_model
from app.services.document_test import run_document_connection_test

router = APIRouter()

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".doc", ".html", ".htm"}
ALLOWED_EXTENSIONS_DOCUMENTATION = {".zip"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_HTTP_METHODS = frozenset({"GET", "POST", "PUT", "PATCH", "DELETE"})


def _safe_basename(filename: str) -> str:
    name = os.path.basename(filename or "document").strip() or "document"
    name = re.sub(r"[^\w\s.\-]", "", name)[:200]
    return name or "document"


def _format_utc(dt) -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    s = dt.isoformat()
    if s.endswith("+00:00"):
        s = s[:-6] + "Z"
    return s


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
        created_at=_format_utc(kb.created_at),
    )


def _public_doc_config(doc: Document) -> dict | None:
    config = getattr(doc, "config", None)
    if config is None or not isinstance(config, dict):
        return None
    out = dict(config)
    if doc.source_type == "database" and out.get("password_encrypted"):
        out["password_encrypted"] = "***"
    return out


def _doc_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        name=doc.name,
        source_type=doc.source_type,
        status=doc.status,
        error_message=doc.error_message,
        config=_public_doc_config(doc),
        created_at=_format_utc(doc.created_at),
    )


def _resolve_config_from_preset(
    preset_id: str | None,
    config: dict | None,
    user_id: str,
    project_id: str,
    db: Session,
) -> dict | None:
    """If preset_id is set, load preset config and merge with optional config; else return config."""
    if not preset_id:
        return config
    from app.models.rag_config_preset import RagConfigPreset

    preset = (
        db.query(RagConfigPreset)
        .filter(
            RagConfigPreset.id == preset_id,
            RagConfigPreset.user_id == user_id,
            RagConfigPreset.project_id == project_id,
        )
        .first()
    )
    if not preset:
        return config
    base = dict(preset.config or {})
    base.update(config or {})
    return base


def _get_kb_in_project(db: Session, kb_id: str, project_id: str) -> KnowledgeBase:
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id, KnowledgeBase.project_id == project_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return kb


@router.get("", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    bases = db.query(KnowledgeBase).filter(KnowledgeBase.project_id == project_id).order_by(KnowledgeBase.name).all()
    return [_kb_to_response(kb) for kb in bases]


@router.post("", response_model=KnowledgeBaseResponse)
def create_knowledge_base(
    project_id: str,
    body: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_edit),
):
    resolved = _resolve_config_from_preset(body.preset_id, body.config, str(user.id), project_id, db)
    collection_name = f"kb_{uuid.uuid4().hex[:16]}"
    kb = KnowledgeBase(
        id=str(uuid.uuid4()),
        project_id=project_id,
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
    project_id: str,
    kb_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    kb = _get_kb_in_project(db, kb_id, project_id)
    return _kb_to_response(kb)


@router.patch("/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    project_id: str,
    kb_id: str,
    body: KnowledgeBaseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_edit),
):
    kb = _get_kb_in_project(db, kb_id, project_id)
    if body.name is not None:
        kb.name = body.name
    if body.description is not None:
        kb.description = body.description
    if body.preset_id is not None or body.config is not None:
        resolved = _resolve_config_from_preset(body.preset_id, body.config, str(user.id), project_id, db)
        if resolved is not None:
            kb.config = resolved
    db.commit()
    db.refresh(kb)
    return _kb_to_response(kb)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    project_id: str,
    kb_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    kb = _get_kb_in_project(db, kb_id, project_id)
    db.delete(kb)
    db.commit()
    return None


@router.get("/{kb_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    project_id: str,
    kb_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    _get_kb_in_project(db, kb_id, project_id)
    docs = db.query(Document).filter(Document.knowledge_base_id == kb_id).order_by(Document.created_at.desc()).all()
    return [_doc_to_response(d) for d in docs]


@router.post("/{kb_id}/documents/api", response_model=DocumentResponse)
def create_api_document(
    project_id: str,
    kb_id: str,
    body: DocumentApiCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    _get_kb_in_project(db, kb_id, project_id)
    method = (body.method or "GET").strip().upper()
    if method not in ALLOWED_HTTP_METHODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid HTTP method")
    doc_id = str(uuid.uuid4())
    cfg = {
        "method": method,
        "url": (body.url or "").strip(),
        "headers": body.headers or {},
        "body": body.body,
        "example_response": body.example_response,
        "execute_at_runtime": body.execute_at_runtime,
    }
    doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        name=body.name.strip() or "API",
        source_type="api",
        storage_path=None,
        status=DocumentStatus.COMPLETED,
        config=cfg,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


@router.post("/{kb_id}/documents/database", response_model=DocumentResponse)
def create_database_document(
    project_id: str,
    kb_id: str,
    body: DocumentDatabaseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    _get_kb_in_project(db, kb_id, project_id)
    ok, err, tables = validate_database_document(
        body.engine,
        host=body.host,
        port=body.port,
        database=body.database,
        user=body.user,
        password=body.password,
        sqlite_path=body.sqlite_path,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Database validation failed: {err}")

    pwd_enc = encrypt_secret(body.password or "") if body.password else ""
    cfg = {
        "engine": (body.engine or "").strip().lower(),
        "host": body.host,
        "port": body.port,
        "database": body.database,
        "user": body.user,
        "password_encrypted": pwd_enc,
        "sqlite_path": body.sqlite_path,
        "default_schema": body.default_schema,
        "allowed_tables": tables,
    }
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        name=body.name.strip() or "Database",
        source_type="database",
        storage_path=None,
        status=DocumentStatus.COMPLETED,
        config=cfg,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


@router.post("/{kb_id}/upload", response_model=DocumentResponse)
async def upload_document(
    project_id: str,
    kb_id: str,
    file: UploadFile = File(...),
    config: str | None = Form(None),
    preset_id: str | None = Form(None),
    upload_type: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_project_edit),
):
    _get_kb_in_project(db, kb_id, project_id)
    safe_name = _safe_basename(file.filename or "document")
    ext = os.path.splitext(safe_name)[1].lower()
    is_documentation_zip = (
        (upload_type or "").strip().lower() == "documentation"
        and ext in ALLOWED_EXTENSIONS_DOCUMENTATION
    )
    if not is_documentation_zip and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Use: {', '.join(sorted(ALLOWED_EXTENSIONS))} or .zip for documentation.",
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
        doc_config = _resolve_config_from_preset(preset_id, config_dict, str(user.id), project_id, db)

    source_type = "documentation_zip" if is_documentation_zip else "file"
    doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        name=safe_name,
        source_type=source_type,
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
    project_id: str,
    kb_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    """Search knowledge base by query. Body: { \"query\": \"...\", \"top_k\": 5 }"""
    kb = _get_kb_in_project(db, kb_id, project_id)
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
        resp = client.query_points(
            collection_name=kb.qdrant_collection_name,
            query=vector,
            limit=top_k,
            with_payload=True,
        )
        results = getattr(resp, "points", None) or []
        out = []
        for r in results:
            p = r.payload or {}
            item = {"text": p.get("text", ""), "source": p.get("source", ""), "score": r.score}
            if p.get("source_path") is not None:
                item["source_path"] = p["source_path"]
            if p.get("breadcrumb") is not None:
                item["breadcrumb"] = p["breadcrumb"]
            if p.get("heading") is not None:
                item["heading"] = p["heading"]
            if p.get("section_index") is not None:
                item["section_index"] = p["section_index"]
            out.append(item)
        return {"results": out}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/{kb_id}/documents/{document_id}/test", response_model=DocumentTestResponse)
def test_document(
    project_id: str,
    kb_id: str,
    document_id: str,
    body: DocumentTestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    """Verify connectivity: hybrid retrieval (file/url/zip), HTTP call (api), or SELECT preview (database)."""
    kb = _get_kb_in_project(db, kb_id, project_id)
    doc = db.query(Document).filter(Document.id == document_id, Document.knowledge_base_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    result = run_document_connection_test(
        db,
        kb,
        doc,
        question=body.question,
        request_body=body.request_body,
        table=body.table,
        limit=body.limit,
        top_k=body.top_k,
    )
    return DocumentTestResponse(**result)


@router.patch("/{kb_id}/documents/{document_id}", response_model=DocumentResponse)
def update_document(
    project_id: str,
    kb_id: str,
    document_id: str,
    body: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_project_edit),
):
    _get_kb_in_project(db, kb_id, project_id)
    doc = db.query(Document).filter(Document.id == document_id, Document.knowledge_base_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if body.name is not None:
        doc.name = body.name
    if body.preset_id is not None or body.config is not None:
        resolved = _resolve_config_from_preset(body.preset_id, body.config, str(user.id), project_id, db)
        if resolved is not None:
            doc.config = resolved
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


@router.delete("/{kb_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    project_id: str,
    kb_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    _get_kb_in_project(db, kb_id, project_id)
    doc = db.query(Document).filter(Document.id == document_id, Document.knowledge_base_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    db.delete(doc)
    db.commit()
    return None


@router.post("/{kb_id}/documents/{document_id}/ingest", response_model=DocumentResponse)
def trigger_ingest(
    project_id: str,
    kb_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    _get_kb_in_project(db, kb_id, project_id)
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
