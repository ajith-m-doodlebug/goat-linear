import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.model_registry import ModelRegistry
from app.schemas.model_registry import ModelRegistryCreate, ModelRegistryUpdate, ModelRegistryResponse
from app.core.deps import get_current_user, require_builder
from app.services.llm_client import complete, health_check

router = APIRouter()


def _model_to_response(m: ModelRegistry) -> ModelRegistryResponse:
    return ModelRegistryResponse(
        id=m.id,
        name=m.name,
        model_type=m.model_type,
        provider=m.provider,
        endpoint_url=m.endpoint_url,
        model_id=m.model_id,
        api_key_encrypted=m.api_key_encrypted,
        config=m.config,
        version=m.version,
        base_model_id=m.base_model_id,
        training_metadata=m.training_metadata,
        created_at=m.created_at.isoformat() if m.created_at else "",
    )


@router.get("", response_model=list[ModelRegistryResponse])
def list_models(
    db: Session = Depends(get_db),
    _: User = Depends(require_builder),
):
    models = db.query(ModelRegistry).all()
    return [_model_to_response(m) for m in models]


@router.post("", response_model=ModelRegistryResponse)
def create_model(
    body: ModelRegistryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_builder),
):
    model = ModelRegistry(
        id=str(uuid.uuid4()),
        name=body.name,
        model_type=body.model_type,
        provider=body.provider,
        endpoint_url=body.endpoint_url,
        model_id=body.model_id,
        api_key_encrypted=body.api_key_encrypted,
        config=body.config,
        version=body.version,
        base_model_id=body.base_model_id,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


@router.get("/{model_id}", response_model=ModelRegistryResponse)
def get_model(
  model_id: str,
  db: Session = Depends(get_db),
  _: User = Depends(require_builder),
):
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return _model_to_response(model)


@router.patch("/{model_id}", response_model=ModelRegistryResponse)
def update_model(
  model_id: str,
  body: ModelRegistryUpdate,
  db: Session = Depends(get_db),
  _: User = Depends(require_builder),
):
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if body.name is not None:
        model.name = body.name
    if body.endpoint_url is not None:
        model.endpoint_url = body.endpoint_url
    if body.model_id is not None:
        model.model_id = body.model_id
    if body.api_key_encrypted is not None:
        model.api_key_encrypted = body.api_key_encrypted
    if body.config is not None:
        model.config = body.config
    if body.version is not None:
        model.version = body.version
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
  model_id: str,
  db: Session = Depends(get_db),
  _: User = Depends(require_builder),
):
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    db.delete(model)
    db.commit()
    return None


@router.post("/{model_id}/test")
def test_model(
  model_id: str,
  body: dict,
  db: Session = Depends(get_db),
  _: User = Depends(require_builder),
):
    """Send a test prompt and return the model response. Body: { \"prompt\": \"...\" }"""
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="prompt required")
    try:
        response_text = complete(model, prompt)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/{model_id}/health")
def model_health(
  model_id: str,
  db: Session = Depends(get_db),
  _: User = Depends(require_builder),
):
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    ok = health_check(model)
    return {"status": "ok" if ok else "unreachable"}
