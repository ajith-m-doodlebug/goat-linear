from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.model_registry import ModelRegistry
from app.models.project_model_link import ProjectModelLink
from app.models.deployment import Deployment
from app.models.intent_mapper import IntentMapper
from app.api.v1.models import _model_allowed_for_deployment_picker, _sync_self_hosted_endpoint, _to_deployment_option
from app.core.project_access import require_project_edit, require_project_view
from app.schemas.project_model_link import ProjectModelLinkCreate
from app.schemas.model_registry import ModelRegistryDeploymentOption
from app.services.llm_client import complete

router = APIRouter()


def _deployment_or_routing_requires_model(db: Session, project_id: str, model_registry_id: str) -> bool:
    d = (
        db.query(Deployment)
        .filter(Deployment.project_id == project_id, Deployment.model_id == model_registry_id)
        .first()
    )
    if d:
        return True
    im = (
        db.query(IntentMapper)
        .filter(IntentMapper.project_id == project_id, IntentMapper.routing_model_id == model_registry_id)
        .first()
    )
    return im is not None


@router.get("/models", response_model=list[ModelRegistryDeploymentOption])
def list_project_models(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    link_ids = [r.model_id for r in db.query(ProjectModelLink).filter(ProjectModelLink.project_id == project_id).all()]
    if not link_ids:
        return []
    rows = db.query(ModelRegistry).filter(ModelRegistry.id.in_(link_ids)).order_by(ModelRegistry.name).all()
    changed = False
    for m in rows:
        changed = _sync_self_hosted_endpoint(m) or changed
    if changed:
        db.commit()
        rows = db.query(ModelRegistry).filter(ModelRegistry.id.in_(link_ids)).order_by(ModelRegistry.name).all()
    return [_to_deployment_option(m, db) for m in rows]


@router.post("/models", response_model=ModelRegistryDeploymentOption)
def link_project_model(
    project_id: str,
    body: ProjectModelLinkCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    mid = body.model_id.strip()
    model = db.query(ModelRegistry).filter(ModelRegistry.id == mid).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if _sync_self_hosted_endpoint(model):
        db.commit()
        db.refresh(model)
    if not _model_allowed_for_deployment_picker(db, model):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This model cannot be linked (self-hosted endpoints must be healthy)",
        )
    existing = (
        db.query(ProjectModelLink)
        .filter(ProjectModelLink.project_id == project_id, ProjectModelLink.model_id == mid)
        .first()
    )
    if not existing:
        db.add(ProjectModelLink(project_id=project_id, model_id=mid))
        db.commit()
    return _to_deployment_option(model, db)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_project_model(
    project_id: str,
    model_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    if _deployment_or_routing_requires_model(db, project_id, model_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Detach this model from deployments and intent mappers before removing it from the project",
        )
    db.query(ProjectModelLink).filter(ProjectModelLink.project_id == project_id, ProjectModelLink.model_id == model_id).delete()
    db.commit()
    return None


class TestPromptBody(BaseModel):
    prompt: str


@router.post("/models/{model_id}/test")
def test_linked_model(
    project_id: str,
    model_id: str,
    body: TestPromptBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    link = (
        db.query(ProjectModelLink)
        .filter(ProjectModelLink.project_id == project_id, ProjectModelLink.model_id == model_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model is not linked to this project")
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if _sync_self_hosted_endpoint(model):
        db.commit()
        db.refresh(model)
    if not _model_allowed_for_deployment_picker(db, model):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model is not runnable (unhealthy)")
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="prompt required")
    try:
        text_out = complete(model, prompt)
        return {"response": text_out}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
