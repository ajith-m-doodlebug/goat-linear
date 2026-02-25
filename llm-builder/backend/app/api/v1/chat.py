import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.models.deployment import Deployment
from app.core.deps import get_current_user
from app.services.rag import run_rag

router = APIRouter()


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
        {"id": s.id, "deployment_id": s.deployment_id, "title": s.title, "updated_at": s.updated_at.isoformat() if s.updated_at else ""}
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
        {"id": m.id, "role": m.role, "content": m.content, "citations": m.citations, "created_at": m.created_at.isoformat() if m.created_at else ""}
        for m in messages
    ]


@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Body: { content: string }. Runs RAG, saves user + assistant message, returns response and citations."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="content required")

    # Load last N turns for memory
    dep = db.query(Deployment).filter(Deployment.id == session.deployment_id).first()
    memory_turns = int(dep.memory_turns or "10") if dep else 10
    past = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.desc()).limit(memory_turns * 2).all()
    chat_history = [{"role": m.role, "content": m.content} for m in reversed(past)]

    response_text, citations = run_rag(session.deployment_id, content, chat_history=chat_history)

    user_msg = ChatMessage(id=str(uuid.uuid4()), session_id=session_id, role="user", content=content)
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
