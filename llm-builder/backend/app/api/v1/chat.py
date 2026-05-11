import threading
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.models.deployment import Deployment
from app.models.knowledge_base import KnowledgeBase
from app.models.intent_mapper import IntentMapper
from app.models.deployment_version import DeploymentVersion
from app.core.deps import get_current_user
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.rag import run_rag
from app.services.chat_attachments import validate_images_from_body
from app.services.embedding_registry import warm_embedding_model

router = APIRouter()


def _utc_rfc3339(dt: datetime | None) -> str:
    """Serialize DB datetimes for JSON. Naive values are UTC (datetime.utcnow); browsers need Z to parse correctly."""
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _warm_deployment_embedding_model(deployment_id: str) -> None:
    """Load the embedding model for this deployment's KB (for first-message speed). Runs in background."""
    from app.db.base import SessionLocal
    db = SessionLocal()
    try:
        dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not dep:
            return
        kb_id = dep.knowledge_base_id
        if not kb_id and dep.intent_mapper_id:
            im = db.query(IntentMapper).filter(IntentMapper.id == dep.intent_mapper_id).first()
            if im:
                kb_id = im.knowledge_base_id
        if not kb_id:
            return
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not kb:
            return
        emb = resolve_embedding_for_kb(kb.config)
        model_id = emb.get("embedding_model")
        if model_id:
            warm_embedding_model(model_id)
    except Exception:
        pass
    finally:
        db.close()


@router.post("/sessions")
def create_session(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Body: { deployment_id: string, title?: string }. Returns session id."""
    deployment_id = body.get("deployment_id")
    if not deployment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="deployment_id required")
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    session = ChatSession(
        id=str(uuid.uuid4()),
        deployment_id=deployment_id,
        user_id=user.id,
        title=body.get("title") or f"Chat {dep.name}",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    if dep.knowledge_base_id or dep.intent_mapper_id:
        t = threading.Thread(target=_warm_deployment_embedding_model, args=(deployment_id,), daemon=True)
        t.start()
    return {"id": session.id, "deployment_id": deployment_id, "title": session.title}


@router.get("/sessions")
def list_sessions(
    deployment_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ChatSession).filter(ChatSession.user_id == user.id)
    if deployment_id:
        q = q.filter(ChatSession.deployment_id == deployment_id)
    sessions = q.order_by(ChatSession.updated_at.desc()).limit(50).all()
    return [
        {"id": s.id, "deployment_id": s.deployment_id, "title": s.title, "updated_at": _utc_rfc3339(s.updated_at)}
        for s in sessions
    ]


@router.patch("/sessions/{session_id}")
def update_session(
    session_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Body: { title: string }. Rename the chat session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    title = body.get("title")
    if title is not None:
        session.title = (title or "").strip() or session.title
    db.commit()
    db.refresh(session)
    return {"id": session.id, "deployment_id": session.deployment_id, "title": session.title}


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a chat session and its messages."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}


@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "attachments": m.attachments,
            "citations": m.citations,
            "created_at": _utc_rfc3339(m.created_at),
        }
        for m in messages
    ]


@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Body: { content?: string, images?: [{ media_type, data }] }. Runs RAG, saves messages, returns response."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    content = (body.get("content") or "").strip()
    try:
        images = validate_images_from_body(body.get("images"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not content and not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content or images required",
        )

    dep = db.query(Deployment).filter(Deployment.id == session.deployment_id).first()
    memory_turns = 10
    if dep and dep.live_version:
        v = db.query(DeploymentVersion).filter(
            DeploymentVersion.id == dep.live_version,
            DeploymentVersion.deployment_id == dep.id,
        ).first()
        if v and v.frozen_config:
            memory_turns = int(v.frozen_config.get("memory_turns", 10))
    past = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.desc()).limit(memory_turns * 2).all()
    chat_history = [{"role": m.role, "content": m.content} for m in reversed(past)]

    response_text, citations = run_rag(
        session.deployment_id, content, chat_history=chat_history, images=images or None
    )

    user_content = content if content else ""
    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=user_content,
        attachments=images if images else None,
    )
    assistant_msg = ChatMessage(id=str(uuid.uuid4()), session_id=session_id, role="assistant", content=response_text, citations=citations)
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()

    return {"response": response_text, "citations": citations, "message_id": assistant_msg.id}


@router.get("/sessions/{session_id}/messages/stream")
def stream_message_placeholder(
    session_id: str,
):
    """Placeholder: streaming can be added here (SSE). Use POST /messages for now."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Use POST /messages for now")
