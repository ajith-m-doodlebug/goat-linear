import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_super_admin
from app.db.base import SessionLocal, get_db
from app.models.host_model_instance import HostModelInstance
from app.models.model_registry import ModelRegistry
from app.models.user import User
from app.schemas.host_model_instance import (
    HostModelInstanceCreate,
    HostModelInstanceResponse,
    HostModelInstanceUpdate,
    HostModelRegisterRequest,
    HostModelRegisterResponse,
)
from app.core.config import get_settings
from app.services.vllm_hosting import (
    client_facing_base_url,
    check_health,
    ensure_gpu_available,
    fetch_logs,
    get_instance_endpoint,
    preflight_status,
    remove_container,
    start_instance,
    stop_instance,
    validate_instance_config,
    validate_local_path,
    wait_for_health_ready,
)

router = APIRouter()

# OpenAI-compatible inference hosted on this stack (e.g. vLLM from Host Models).
REGISTERED_MODEL_PROVIDER = "ragline_self_hosted"


def _allocate_inference_publish_port(db: Session) -> int:
    floor = max(1025, int(get_settings().host_models_inference_publish_port_floor))
    mx = db.query(func.max(HostModelInstance.port)).scalar()
    candidate = max(floor, (mx if mx is not None else floor - 1) + 1)
    while candidate <= 65535:
        taken = db.query(HostModelInstance).filter(HostModelInstance.port == candidate).first()
        if taken is None:
            return candidate
        candidate += 1
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No free TCP ports left for inference containers",
    )


def _to_response(m: HostModelInstance) -> HostModelInstanceResponse:
    public_base = client_facing_base_url(m)
    return HostModelInstanceResponse(
        id=m.id,
        name=m.name,
        engine=m.engine,
        model_source=m.model_source,
        model_ref=m.model_ref,
        served_model_name=m.served_model_name,
        gpu_ids=m.gpu_ids,
        tensor_parallel_size=m.tensor_parallel_size,
        port=m.port,
        base_url=public_base,
        status=m.status,  # type: ignore[arg-type]
        health_message=m.health_message,
        container_id=m.container_id,
        last_log_excerpt=m.last_log_excerpt,
        config=m.config,
        created_by=m.created_by,
        created_at=m.created_at.isoformat() if m.created_at else "",
    )


def _get_instance(db: Session, instance_id: str) -> HostModelInstance:
    item = db.query(HostModelInstance).filter(HostModelInstance.id == instance_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted model not found")
    return item


def _execute_start(db: Session, instance_id: str) -> HostModelInstance:
    item = _get_instance(db, instance_id)
    try:
        validate_instance_config(item)
        ensure_gpu_available()
        validate_local_path(item)
        item.status = "starting"
        item.health_message = "Starting inference container"
        db.commit()
        container_id, base_url = start_instance(item)
        item.container_id = container_id
        item.base_url = base_url
        item.last_log_excerpt = None
        db.commit()
        ok, msg = wait_for_health_ready(item)
        if ok:
            item.status = "healthy"
            item.health_message = msg
        else:
            item.status = "error"
            tw = get_settings().host_models_health_timeout_seconds
            item.health_message = (
                f"/health not ready within {tw}s (large models can exceed this while loading weights). "
                f"Last: {msg}. Check Logs — if the server is still starting, increase HOST_MODELS_HEALTH_TIMEOUT_SECONDS "
                "and click Start again (the container will be recreated)."
            )
    except Exception as e:
        item.status = "error"
        err = str(e)
        item.health_message = err
        item.container_id = None
        item.base_url = ""
        item.last_log_excerpt = (
            f"(Inference container was not created or exited immediately — no docker logs yet)\n{err}"[-50000:]
        )
    db.commit()
    db.refresh(item)
    return item


def _background_start_host_model(instance_id: str) -> None:
    db = SessionLocal()
    try:
        _execute_start(db, instance_id)
    finally:
        db.close()


@router.get("", response_model=list[HostModelInstanceResponse])
def list_host_models(db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    rows = db.query(HostModelInstance).order_by(HostModelInstance.created_at.desc()).all()
    return [_to_response(r) for r in rows]


@router.get("/preflight")
def get_host_models_preflight(_: User = Depends(require_super_admin)):
    return preflight_status()


@router.post("", response_model=HostModelInstanceResponse)
def create_host_model(
    body: HostModelInstanceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
):
    served = body.served_model_name.strip()
    if db.query(HostModelInstance).filter(HostModelInstance.served_model_name == served).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Served model name already in use (it becomes the OpenAI `model` id)",
        )
    publish_port = _allocate_inference_publish_port(db)
    instance = HostModelInstance(
        id=str(uuid.uuid4()),
        name=body.name.strip(),
        engine=body.engine,
        model_source="local_path",
        model_ref=body.model_ref.strip(),
        served_model_name=served,
        gpu_ids=body.gpu_ids.strip() or "0",
        tensor_parallel_size=body.tensor_parallel_size,
        port=publish_port,
        base_url="",
        api_key=body.api_key,
        status="creating",
        config=body.config,
        created_by=user.id,
    )
    if not instance.name or not instance.model_ref or not instance.served_model_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing required fields")
    try:
        validate_instance_config(instance)
        validate_local_path(instance)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    db.add(instance)
    db.commit()
    db.refresh(instance)
    if body.autostart:
        instance.status = "starting"
        instance.health_message = "Starting inference container"
        db.commit()
        db.refresh(instance)
        background_tasks.add_task(_background_start_host_model, instance.id)
        return _to_response(instance)
    instance.status = "stopped"
    instance.health_message = "Created but not started"
    db.commit()
    db.refresh(instance)
    return _to_response(instance)


@router.patch("/{instance_id}", response_model=HostModelInstanceResponse)
def update_host_model(
    instance_id: str,
    body: HostModelInstanceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    if body.name is not None:
        item.name = body.name.strip()
    if body.gpu_ids is not None:
        item.gpu_ids = body.gpu_ids.strip() or "0"
    if body.tensor_parallel_size is not None:
        item.tensor_parallel_size = body.tensor_parallel_size
    if body.api_key is not None:
        item.api_key = body.api_key
    if body.config is not None:
        item.config = body.config
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.post("/{instance_id}/start", response_model=HostModelInstanceResponse)
def start_host_model(
    instance_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    try:
        validate_instance_config(item)
        ensure_gpu_available()
        validate_local_path(item)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    item.status = "starting"
    item.health_message = "Starting inference container"
    db.commit()
    db.refresh(item)
    background_tasks.add_task(_background_start_host_model, instance_id)
    return _to_response(item)


@router.post("/{instance_id}/stop", response_model=HostModelInstanceResponse)
def stop_host_model(
    instance_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    try:
        item.status = "stopping"
        db.commit()
        stop_instance(item)
        remove_container(item)
        item.status = "stopped"
        item.health_message = "Stopped"
        item.container_id = None
    except Exception as e:
        item.status = "error"
        item.health_message = str(e)
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.get("/{instance_id}/health", response_model=HostModelInstanceResponse)
def health_host_model(
    instance_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    ok, msg = check_health(item, read_timeout=30.0)
    item.status = "healthy" if ok else ("stopped" if not item.container_id else "starting")
    item.health_message = msg
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.get("/{instance_id}/logs")
def logs_host_model(
    instance_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    try:
        logs = fetch_logs(item, tail=300)
        if "No Docker container" in logs and (item.last_log_excerpt or "").strip():
            logs = f"{item.last_log_excerpt.strip()}\n\n--- docker logs ---\n{logs}"
        item.last_log_excerpt = logs[-10000:] if logs else ""
        db.commit()
        return {"logs": item.last_log_excerpt or ""}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/{instance_id}/register-model", response_model=HostModelRegisterResponse)
def register_hosted_model(
    instance_id: str,
    body: HostModelRegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    public_base = client_facing_base_url(item)
    if (item.base_url or "").rstrip("/") != public_base.rstrip("/"):
        item.base_url = public_base
        db.commit()
        db.refresh(item)
    existing = (
        db.query(ModelRegistry)
        .filter(
            ModelRegistry.provider == REGISTERED_MODEL_PROVIDER,
            ModelRegistry.endpoint_url == public_base,
            ModelRegistry.model_id == item.served_model_name,
        )
        .first()
    )
    if existing:
        return HostModelRegisterResponse(
            model_id=existing.id,
            name=existing.name,
            provider=existing.provider,
            endpoint_url=get_instance_endpoint(item),
            model_ref=item.model_ref,
        )
    model = ModelRegistry(
        id=str(uuid.uuid4()),
        name=(body.name or item.name).strip(),
        model_type="base",
        provider=REGISTERED_MODEL_PROVIDER,
        endpoint_url=public_base,
        model_id=item.served_model_name,
        api_key_encrypted=item.api_key,
        config={"host_model_instance_id": item.id},
        version=None,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return HostModelRegisterResponse(
        model_id=model.id,
        name=model.name,
        provider=model.provider,
        endpoint_url=get_instance_endpoint(item),
        model_ref=item.model_ref,
    )


@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_host_model(
    instance_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    item = _get_instance(db, instance_id)
    try:
        remove_container(item)
    except Exception:
        pass
    db.delete(item)
    db.commit()
    return None
