"""Hosted deployment API: GET /hosted/{deployment_id}/health, POST /hosted/{deployment_id}/v1/chat/completions.
No auth required; these are public API endpoints for the deployed RAG."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.base import get_db
from app.models.deployment_version import DeploymentVersion
from app.services.hosted_deployment import (
    get_running_version_for_deployment,
    get_hosted_session_messages,
    add_hosted_session_messages,
)
from app.services.hosted_chat import run_hosted_rag

router = APIRouter()


def _get_running_version(db: Session, deployment_id: str) -> DeploymentVersion | None:
    return get_running_version_for_deployment(db, deployment_id)


class ChatMessage(BaseModel):
    role: str
    content: str | None = None


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    stream: bool = False
    session_id: str | None = None


@router.get("/{deployment_id}/health")
def hosted_health(deployment_id: str, db: Session = Depends(get_db)):
    """Health check for a hosted deployment. 200 if a version is running, 503 otherwise."""
    v = _get_running_version(db, deployment_id)
    if not v:
        return JSONResponse(
            content={"status": "not_running", "detail": "No running version for this deployment"},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return {"status": "ok"}


@router.post("/{deployment_id}/v1/chat/completions")
def hosted_chat_completions(
    deployment_id: str,
    body: ChatCompletionRequest,
    db: Session = Depends(get_db),
    x_session_id: Optional[str] = Header(None, alias="X-Session-Id"),
):
    """
    OpenAI-style chat completions for the hosted deployment.
    Question = last user message in body.messages.
    Optional session_id in body or X-Session-Id header for conversation memory (when enabled for this version).
    """
    if body.stream:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Streaming not supported")
    v = _get_running_version(db, deployment_id)
    if not v:
        return JSONResponse(
            content={"error": "No running version for this deployment"},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    question = ""
    for m in reversed(body.messages or []):
        if m.role == "user" and (m.content or "").strip():
            question = (m.content or "").strip()
            break
    if not question:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user message found")

    session_id = body.session_id or x_session_id
    memory_enabled = (v.frozen_config or {}).get("memory_enabled", False)
    memory_turns = int((v.frozen_config or {}).get("memory_turns", 10))
    chat_history = None
    if memory_enabled and session_id:
        chat_history = get_hosted_session_messages(db, deployment_id, v.id, session_id, limit=memory_turns)

    # Use only the running version's frozen config (frozen KB snapshot, model, prompt)
    response_text, citations = run_hosted_rag(v, question, chat_history=chat_history)

    if memory_enabled and session_id:
        user_content = question
        add_hosted_session_messages(
            db,
            deployment_id,
            v.id,
            session_id,
            [("user", user_content), ("assistant", response_text)],
            max_messages=memory_turns * 4,
        )

    model_id = (v.frozen_config or {}).get("model") or {}
    model_id = model_id.get("model_id", "default")
    return {
        "id": "hosted-1",
        "object": "chat.completion",
        "model": model_id,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": response_text},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
