import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.deployment import Deployment
from app.models.intent_mapper import IntentMapper
from app.models.deployment_version import DeploymentVersion
from app.models.prompt_template import PromptTemplate
from app.schemas.deployment import DeploymentCreate, DeploymentUpdate, DeploymentResponse
from app.schemas.deployment_version import (
    DeployRequest,
    DeployResponse,
    DeploymentVersionResponse,
)
from app.schemas.prompt_template import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse
from app.core.deps import get_current_user, require_admin
from app.services.rag import run_rag
from app.services.export_deployment import build_export_bundle, build_export_bundle_from_version
from app.services.hosted_deployment import (
    create_hosted_version,
    add_deployment_version,
    start_version,
    stop_version,
    delete_version,
)

router = APIRouter()


def _deployment_to_response(
    d: Deployment,
    has_hosted_versions: bool | None = None,
    hosted_status: str | None = None,
) -> DeploymentResponse:
    if has_hosted_versions is None:
        has_hosted_versions = d.is_hosted
    if hosted_status is None:
        hosted_status = "live" if d.live_version else ("stopped" if d.is_hosted else None)
    return DeploymentResponse(
        id=d.id,
        name=d.name,
        model_id=d.model_id,
        knowledge_base_id=d.knowledge_base_id,
        intent_mapper_id=d.intent_mapper_id,
        prompt_template_id=d.prompt_template_id,
        is_hosted=d.is_hosted,
        live_version=d.live_version,
        created_at=d.created_at.isoformat() if d.created_at else "",
        has_hosted_versions=has_hosted_versions,
        hosted_status=hosted_status,
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
def list_prompt_templates(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    templates = db.query(PromptTemplate).all()
    return [_template_to_response(t) for t in templates]


@router.post("/prompt-templates", response_model=PromptTemplateResponse)
def create_prompt_template(body: PromptTemplateCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
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
    template_id: str, body: PromptTemplateUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)
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


@router.delete("/prompt-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt_template(
    template_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    t = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt template not found")
    db.delete(t)
    db.commit()
    return None


# ---- Deployments ----
@router.get("", response_model=list[DeploymentResponse])
def list_deployments(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    deployments = db.query(Deployment).all()
    return [_deployment_to_response(d) for d in deployments]


def _resolve_kb_im_pair(kb: str | None, im: str | None) -> tuple[str | None, str | None]:
    if kb and im:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specify only one of knowledge_base_id or intent_mapper_id",
        )
    if kb:
        return kb, None
    if im:
        return None, im
    return kb, im


@router.post("", response_model=DeploymentResponse)
def create_deployment(body: DeploymentCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    kb_id, im_id = _resolve_kb_im_pair(body.knowledge_base_id, body.intent_mapper_id)
    if im_id:
        im_row = db.query(IntentMapper).filter(IntentMapper.id == im_id).first()
        if not im_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")
    d = Deployment(
        id=str(uuid.uuid4()),
        name=body.name,
        model_id=body.model_id,
        knowledge_base_id=kb_id,
        intent_mapper_id=im_id,
        prompt_template_id=body.prompt_template_id,
        is_hosted=False,
        live_version=None,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _deployment_to_response(d)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(deployment_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    return _deployment_to_response(d)


@router.patch("/{deployment_id}", response_model=DeploymentResponse)
def update_deployment(
    deployment_id: str, body: DeploymentUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    if body.name is not None:
        d.name = body.name
    if body.model_id is not None:
        d.model_id = body.model_id
    if body.knowledge_base_id is not None:
        d.knowledge_base_id = body.knowledge_base_id or None
        if body.knowledge_base_id:
            d.intent_mapper_id = None
    if body.intent_mapper_id is not None:
        im_val = body.intent_mapper_id or None
        if im_val:
            im_row = db.query(IntentMapper).filter(IntentMapper.id == im_val).first()
            if not im_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")
            d.knowledge_base_id = None
        d.intent_mapper_id = im_val
    if body.prompt_template_id is not None:
        d.prompt_template_id = body.prompt_template_id
    if body.is_hosted is not None:
        d.is_hosted = body.is_hosted
    if body.live_version is not None:
        d.live_version = body.live_version
    db.commit()
    db.refresh(d)
    return _deployment_to_response(d)


@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(deployment_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    db.delete(d)
    db.commit()
    return None


@router.get("/{deployment_id}/export")
def export_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Export deployment as a zip: config, vector snapshot, and ready-to-run OpenAI-compatible server."""
    try:
        zip_bytes = build_export_bundle(db, deployment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    name = (d.name if d else "deployment").replace(" ", "-")
    filename = f"{name}-export.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{deployment_id}/versions/{version_id}/export")
def export_deployment_version(
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Export a specific hosted version as a zip (frozen config + vector snapshot for that version)."""
    v = (
        db.query(DeploymentVersion)
        .filter(
            DeploymentVersion.id == version_id,
            DeploymentVersion.deployment_id == deployment_id,
        )
        .first()
    )
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    try:
        zip_bytes = build_export_bundle_from_version(db, deployment_id, version_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    name = (dep.name if dep else "deployment").replace(" ", "-")
    filename = f"{name}-{v.version_label}-export.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---- Hosted deploy and versions ----
@router.post("/{deployment_id}/deploy", response_model=DeployResponse)
def deploy_deployment(
    deployment_id: str,
    body: DeployRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """First-time Deploy: create first hosted version. Fails if deployment already has versions."""
    try:
        v = create_hosted_version(
            db,
            deployment_id,
            memory_enabled=body.memory_enabled,
            memory_turns=body.memory_turns,
        )
    except ValueError as e:
        if "already has hosted versions" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    base = str(request.base_url).rstrip("/")
    endpoint_url = f"{base}/hosted/{deployment_id}/v1/chat/completions"
    return DeployResponse(
        version_id=v.id,
        version_label=v.version_label,
        endpoint_url=endpoint_url,
        status=v.status,
    )


@router.get("/{deployment_id}/versions", response_model=list[DeploymentVersionResponse])
def list_deployment_versions(
    deployment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all versions for this deployment."""
    d = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    versions = (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.deployment_id == deployment_id)
        .order_by(DeploymentVersion.created_at.desc())
        .all()
    )
    return [
        DeploymentVersionResponse(
            id=v.id,
            deployment_id=v.deployment_id,
            version_label=v.version_label,
            status=v.status,
            memory_enabled=v.frozen_config.get("memory_enabled", False) if v.frozen_config else False,
            created_at=v.created_at.isoformat() if v.created_at else "",
            started_at=v.started_at.isoformat() if v.started_at else None,
            stopped_at=v.stopped_at.isoformat() if v.stopped_at else None,
        )
        for v in versions
    ]


@router.post("/{deployment_id}/versions", response_model=DeployResponse)
def create_new_version(
    deployment_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Add a new version (freeze current deployment state)."""
    try:
        v = add_deployment_version(db, deployment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    base = str(request.base_url).rstrip("/")
    endpoint_url = f"{base}/hosted/{deployment_id}/v1/chat/completions"
    return DeployResponse(
        version_id=v.id,
        version_label=v.version_label,
        endpoint_url=endpoint_url,
        status=v.status,
    )


@router.post("/{deployment_id}/versions/{version_id}/start", response_model=DeploymentVersionResponse)
def start_deployment_version(
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Make this version the running one (stops any other running version for this deployment)."""
    v = db.query(DeploymentVersion).filter(
        DeploymentVersion.id == version_id,
        DeploymentVersion.deployment_id == deployment_id,
    ).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    try:
        v = start_version(db, version_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return DeploymentVersionResponse(
        id=v.id,
        deployment_id=v.deployment_id,
        version_label=v.version_label,
        status=v.status,
        memory_enabled=v.frozen_config.get("memory_enabled", False) if v.frozen_config else False,
        created_at=v.created_at.isoformat() if v.created_at else "",
        started_at=v.started_at.isoformat() if v.started_at else None,
        stopped_at=v.stopped_at.isoformat() if v.stopped_at else None,
    )


@router.post("/{deployment_id}/versions/{version_id}/stop", response_model=DeploymentVersionResponse)
def stop_deployment_version(
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Stop this version (hosted endpoint will return 503 until another version is started)."""
    v = db.query(DeploymentVersion).filter(
        DeploymentVersion.id == version_id,
        DeploymentVersion.deployment_id == deployment_id,
    ).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    try:
        v = stop_version(db, version_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return DeploymentVersionResponse(
        id=v.id,
        deployment_id=v.deployment_id,
        version_label=v.version_label,
        status=v.status,
        memory_enabled=v.frozen_config.get("memory_enabled", False) if v.frozen_config else False,
        created_at=v.created_at.isoformat() if v.created_at else "",
        started_at=v.started_at.isoformat() if v.started_at else None,
        stopped_at=v.stopped_at.isoformat() if v.stopped_at else None,
    )


@router.delete("/{deployment_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment_version(
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Delete a version. If it was running, it is stopped first. Session messages and Qdrant data for this version are removed."""
    v = db.query(DeploymentVersion).filter(
        DeploymentVersion.id == version_id,
        DeploymentVersion.deployment_id == deployment_id,
    ).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    try:
        delete_version(db, deployment_id, version_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")


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
        return {"response": response_text, "citations": citations}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
