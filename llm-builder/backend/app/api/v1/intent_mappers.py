import uuid
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.intent_mapper import IntentMapper, IntentMapperDocument
from app.models.deployment import Deployment
from app.schemas.intent_mapper import (
    IntentMapperCreate,
    IntentMapperUpdate,
    IntentMapperResponse,
    IntentMapperDetailResponse,
    IntentMapperDocumentItem,
    IntentMapperTestRequest,
    IntentMapperTestResponse,
)
from app.core.deps import require_admin
from app.services.intent_routing import preview_intent_mapper

router = APIRouter()


def _utc(dt) -> str:
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


def _to_response(m: IntentMapper) -> IntentMapperResponse:
    return IntentMapperResponse(
        id=m.id,
        name=m.name,
        routing_model_id=m.routing_model_id,
        knowledge_base_id=m.knowledge_base_id,
        created_at=_utc(m.created_at),
    )


def _detail(db: Session, mapper_id: str) -> IntentMapperDetailResponse:
    m = db.query(IntentMapper).filter(IntentMapper.id == mapper_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")
    rows = db.query(IntentMapperDocument).filter(IntentMapperDocument.intent_mapper_id == mapper_id).all()
    docs = [
        IntentMapperDocumentItem(document_id=r.document_id, intent_text=r.intent_text or "")
        for r in rows
    ]
    base = _to_response(m)
    return IntentMapperDetailResponse(**base.model_dump(), documents=docs)


@router.get("", response_model=list[IntentMapperResponse])
def list_intent_mappers(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(IntentMapper).order_by(IntentMapper.created_at.desc()).all()
    return [_to_response(m) for m in rows]


@router.post("", response_model=IntentMapperDetailResponse)
def create_intent_mapper(
    body: IntentMapperCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == body.knowledge_base_id).first()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    mid = str(uuid.uuid4())
    m = IntentMapper(
        id=mid,
        name=body.name.strip(),
        routing_model_id=body.routing_model_id,
        knowledge_base_id=body.knowledge_base_id,
    )
    db.add(m)

    seen_docs = set()
    for item in body.documents:
        if item.document_id in seen_docs:
            continue
        seen_docs.add(item.document_id)
        doc = db.query(Document).filter(
            Document.id == item.document_id,
            Document.knowledge_base_id == body.knowledge_base_id,
        ).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document not in knowledge base: {item.document_id}",
            )
        db.add(
            IntentMapperDocument(
                intent_mapper_id=mid,
                document_id=item.document_id,
                intent_text=item.intent_text or "",
            )
        )

    db.commit()
    db.refresh(m)
    return _detail(db, mid)


@router.get("/{mapper_id}", response_model=IntentMapperDetailResponse)
def get_intent_mapper(mapper_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return _detail(db, mapper_id)


@router.patch("/{mapper_id}", response_model=IntentMapperDetailResponse)
def update_intent_mapper(
    mapper_id: str,
    body: IntentMapperUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    m = db.query(IntentMapper).filter(IntentMapper.id == mapper_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")

    if body.name is not None:
        m.name = body.name.strip()
    if body.routing_model_id is not None:
        m.routing_model_id = body.routing_model_id
    kb_id = m.knowledge_base_id
    if body.knowledge_base_id is not None:
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == body.knowledge_base_id).first()
        if not kb:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
        m.knowledge_base_id = body.knowledge_base_id
        kb_id = body.knowledge_base_id

    if body.documents is not None:
        db.query(IntentMapperDocument).filter(IntentMapperDocument.intent_mapper_id == mapper_id).delete()
        seen_docs = set()
        for item in body.documents:
            if item.document_id in seen_docs:
                continue
            seen_docs.add(item.document_id)
            doc = db.query(Document).filter(
                Document.id == item.document_id,
                Document.knowledge_base_id == kb_id,
            ).first()
            if not doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Document not in knowledge base: {item.document_id}",
                )
            db.add(
                IntentMapperDocument(
                    intent_mapper_id=mapper_id,
                    document_id=item.document_id,
                    intent_text=item.intent_text or "",
                )
            )

    db.commit()
    db.refresh(m)
    return _detail(db, mapper_id)


@router.post("/{mapper_id}/test", response_model=IntentMapperTestResponse)
def test_intent_mapper(
    mapper_id: str,
    body: IntentMapperTestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        result = preview_intent_mapper(db, mapper_id, body.question)
        return IntentMapperTestResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{mapper_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_intent_mapper(mapper_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    m = db.query(IntentMapper).filter(IntentMapper.id == mapper_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")
    db.query(Deployment).filter(Deployment.intent_mapper_id == mapper_id).update(
        {Deployment.intent_mapper_id: None},
        synchronize_session=False,
    )
    db.delete(m)
    db.commit()
    return None
