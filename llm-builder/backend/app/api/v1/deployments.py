import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.deployment import Deployment
from app.models.prompt_template import PromptTemplate
from app.schemas.deployment import DeploymentCreate, DeploymentUpdate, DeploymentResponse
from app.schemas.prompt_template import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse
from app.core.deps import get_current_user, require_builder
from app.services.rag import run_rag
from app.core.audit import log_audit

router = APIRouter()


def _deployment_to_response(d: Deployment) -> DeploymentResponse:
    return DeploymentResponse(
        id=d.id,
        name=d.name,
        model_id=d.model_id,
        knowledge_base_id=d.knowledge_base_id,
        prompt_template_id=d.prompt_template_id,
        memory_turns=d.memory_turns,
        config=d.config,
        version=d.version,
        created_at=d.created_at.isoformat() if d.created_at else "",
    )


def _template_to_response(t: PromptTemplate) -> PromptTemplateResponse:
    return PromptTemplateResponse(
        id=t.id,
        name=t.name,
        content=t.content,
        version=t.version,
        created_at=t.created_at.isoformat() if t.created_at else "",
    )


# ---- Prompt templates ----
@router.get("/prompt-templates", response_model=list[PromptTemplateResponse])
def list_prompt_templates(db: Session = Depends(get_db), _: User = Depends(require_builder)):
    templates = db.query(PromptTemplate).all()
    return [_template_to_response(t) for t in templates]


@router.post("/prompt-templates", response_model=PromptTemplateResponse)
def create_prompt_template(body: PromptTemplateCreate, db: Session = Depends(get_db), _: User = Depends(require_builder)):
    t = PromptTemplate(
        id=str(uuid.uuid4()),
        name=body.name,
        content=body.content,
        version=body.version,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _template_to_response(t)


@router.patch("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
def update_prompt_template(
    template_id: str, body: PromptTemplateUpdate, db: Session = Depends(get_db), _: User = Depends(require_builder)
):
    t = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt template not found")
    if body.name is not None:
        t.name = body.name
    if body.content is not None:
        t.content = body.content
    if body.version is not None:
        t.version = body.version
    db.commit()
    db.refresh(t)
    return _template_to_response(t)


# ---- Deployments ----
@router.get("", response_model=list[DeploymentResponse])
def list_deployments(db: Session = Depends(get_db), _: User = Depends(require_builder)):
    deployments = db.query(Deployment).all()
    return [_deployment_to_response(d) for d in deployments]


@router.post("", response_model=DeploymentResponse)
def create_deployment(body: DeploymentCreate, db: Session = Depends(get_db), _: User = Depends(require_builder)):
    d = Deployment(
        id=str(uuid.uuid4()),
        name=body.name,
        model_id=body.model_id,
        knowledge_base_id=body.knowledge_base_id,
        prompt_template_id=body.prompt_template_id,
        memory_turns=body.memory_turns,
        config=body.config,
        version=body.version,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _deployment_to_response(d)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(deployment_id: str, db: Session = Depends(get_db), _: User = Depends(require_builder)):
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    return _deployment_to_response(d)


@router.patch("/{deployment_id}", response_model=DeploymentResponse)
def update_deployment(
    deployment_id: str, body: DeploymentUpdate, db: Session = Depends(get_db), _: User = Depends(require_builder)
):
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    if body.name is not None:
        d.name = body.name
    if body.model_id is not None:
        d.model_id = body.model_id
    if body.knowledge_base_id is not None:
        d.knowledge_base_id = body.knowledge_base_id
    if body.prompt_template_id is not None:
        d.prompt_template_id = body.prompt_template_id
    if body.memory_turns is not None:
        d.memory_turns = body.memory_turns
    if body.config is not None:
        d.config = body.config
    if body.version is not None:
        d.version = body.version
    db.commit()
    db.refresh(d)
    return _deployment_to_response(d)


@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(deployment_id: str, db: Session = Depends(get_db), _: User = Depends(require_builder)):
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    db.delete(d)
    db.commit()
    return None


@router.post("/{deployment_id}/run")
def run_deployment(
    deployment_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run RAG for this deployment. Body: { \"question\": \"...\" }. Returns response and citations."""
    question = (body.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question required")
    try:
        response_text, citations = run_rag(deployment_id, question)
        log_audit(user_id=user.id, action="deployment.run", resource_type="deployment", resource_id=deployment_id, details={"question_length": len(question)})
        return {"response": response_text, "citations": citations}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
