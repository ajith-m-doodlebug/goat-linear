import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import get_db
from app.models.user import User
from app.models.model_registry import ModelRegistry
from app.models.host_model_instance import HostModelInstance
from app.schemas.model_registry import (
    ModelRegistryCreate,
    ModelRegistryDeploymentOption,
    ModelRegistryUpdate,
    ModelRegistryResponse,
)
from app.core.deps import get_current_user, require_admin
from app.services.llm_client import complete, health_check

router = APIRouter()


def _normalized_self_hosted_endpoint(endpoint_url: str | None) -> str | None:
    if not endpoint_url:
        return endpoint_url
    settings = get_settings()
    pub = (settings.host_models_public_base_url or "").strip().rstrip("/")
    if not pub:
        return endpoint_url
    src = urlparse(endpoint_url.strip().rstrip("/"))
    dst = urlparse(pub)
    if src.scheme not in ("http", "https") or dst.scheme not in ("http", "https"):
        return endpoint_url
    if not src.hostname or not dst.hostname:
        return endpoint_url
    if src.hostname.lower() != dst.hostname.lower():
        return endpoint_url
    if dst.port is None:
        return endpoint_url
    return f"{src.scheme}://{dst.hostname}:{dst.port}"


def _sync_self_hosted_endpoint(model: ModelRegistry) -> bool:
    if model.provider != "ragline_self_hosted":
        return False
    normalized = _normalized_self_hosted_endpoint(model.endpoint_url)
    if (normalized or "") == (model.endpoint_url or ""):
        return False
    model.endpoint_url = normalized
    return True


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
        created_at=m.created_at.isoformat() if m.created_at else "",
    )


@router.get("", response_model=list[ModelRegistryResponse])
def list_models(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    models = db.query(ModelRegistry).all()
    changed = False
    for m in models:
        changed = _sync_self_hosted_endpoint(m) or changed
    if changed:
        db.commit()
        for m in models:
            db.refresh(m)
    return [_model_to_response(m) for m in models]


def _host_status_for_model(db: Session, m: ModelRegistry) -> str | None:
    if m.provider != "ragline_self_hosted":
        return None
    cfg = m.config if isinstance(m.config, dict) else {}
    inst_id = cfg.get("host_model_instance_id")
    if not inst_id:
        return None
    inst = db.query(HostModelInstance).filter(HostModelInstance.id == inst_id).first()
    return str(inst.status) if inst else None


def _model_allowed_for_deployment_picker(db: Session, m: ModelRegistry) -> bool:
    if m.provider != "ragline_self_hosted":
        return True
    cfg = m.config if isinstance(m.config, dict) else {}
    inst_id = cfg.get("host_model_instance_id")
    if not inst_id:
        return False
    inst = db.query(HostModelInstance).filter(HostModelInstance.id == inst_id).first()
    return bool(inst and inst.status == "healthy")


def _to_deployment_option(m: ModelRegistry, db: Session) -> ModelRegistryDeploymentOption:
    return ModelRegistryDeploymentOption(
        id=m.id,
        name=m.name,
        model_type=m.model_type,
        provider=m.provider,
        endpoint_url=m.endpoint_url,
        model_id=m.model_id,
        version=m.version,
        created_at=m.created_at.isoformat() if m.created_at else "",
        host_instance_status=_host_status_for_model(db, m),
    )


@router.get("/available-for-deployment", response_model=list[ModelRegistryDeploymentOption])
def list_models_available_for_deployment(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """All models safe for builders: excludes unhealthy ragline_self_hosted registry rows."""
    _ = user  # any authenticated user with project access uses this from UI
    models_list = db.query(ModelRegistry).order_by(ModelRegistry.name).all()
    changed = False
    for m in models_list:
        changed = _sync_self_hosted_endpoint(m) or changed
    if changed:
        db.commit()
        for m in models_list:
            db.refresh(m)
    out = [m for m in models_list if _model_allowed_for_deployment_picker(db, m)]
    return [_to_deployment_option(m, db) for m in out]


@router.get("/self-hosted-healthy-options", response_model=list[ModelRegistryDeploymentOption])
def list_self_hosted_healthy_options(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ragline self-hosted registry rows whose host instance is healthy (for linking into a project)."""
    _ = user
    models_list = db.query(ModelRegistry).filter(ModelRegistry.provider == "ragline_self_hosted").order_by(ModelRegistry.name).all()
    changed = False
    for m in models_list:
        changed = _sync_self_hosted_endpoint(m) or changed
    if changed:
        db.commit()
        models_list = db.query(ModelRegistry).filter(ModelRegistry.provider == "ragline_self_hosted").order_by(ModelRegistry.name).all()
    out = [m for m in models_list if _model_allowed_for_deployment_picker(db, m)]
    return [_to_deployment_option(m, db) for m in out]


@router.post("", response_model=ModelRegistryResponse)
def create_model(
    body: ModelRegistryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
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
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


@router.get("/{model_id}", response_model=ModelRegistryResponse)
def get_model(
  model_id: str,
  db: Session = Depends(get_db),
  _: User = Depends(require_admin),
):
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if _sync_self_hosted_endpoint(model):
        db.commit()
        db.refresh(model)
    return _model_to_response(model)


@router.patch("/{model_id}", response_model=ModelRegistryResponse)
def update_model(
  model_id: str,
  body: ModelRegistryUpdate,
  db: Session = Depends(get_db),
  _: User = Depends(require_admin),
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
  _: User = Depends(require_admin),
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
  _: User = Depends(require_admin),
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
  _: User = Depends(require_admin),
):
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    ok = health_check(model)
    return {"status": "ok" if ok else "unreachable"}
