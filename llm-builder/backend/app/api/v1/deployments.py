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
from app.models.knowledge_base import KnowledgeBase
from app.schemas.deployment import DeploymentCreate, DeploymentUpdate, DeploymentResponse
from app.schemas.deployment_version import (
    DeployRequest,
    DeployResponse,
    DeploymentVersionResponse,
)
from app.schemas.prompt_template import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse
from app.core.deps import get_current_user
from app.core.project_access import assert_project_view, require_project_edit, require_project_view
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


def _canvas_dict(val: Any) -> dict[str, Any] | None:
    if val is None:
        return None
    if isinstance(val, dict):
        return val
    return None


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
        canvas_state=_canvas_dict(d.canvas_state),
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


def _scoped_deployment(db: Session, deployment_id: str, project_id: str) -> Deployment:
    d = db.query(Deployment).filter(Deployment.id == deployment_id, Deployment.project_id == project_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    return d


def _assert_project_refs(
    db: Session,
    project_id: str,
    kb_id: str | None,
    im_id: str | None,
    prompt_id: str | None,
) -> None:
    if kb_id:
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not kb or kb.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Knowledge base not in this project")
    if im_id:
        im = db.query(IntentMapper).filter(IntentMapper.id == im_id).first()
        if not im or im.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Intent mapper not in this project")
    if prompt_id:
        pt = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_id).first()
        if not pt or pt.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prompt template not in this project")


# ---- Prompt templates ----
@router.get("/prompt-templates", response_model=list[PromptTemplateResponse])
def list_prompt_templates(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    templates = db.query(PromptTemplate).filter(PromptTemplate.project_id == project_id).order_by(PromptTemplate.name).all()
    return [_template_to_response(t) for t in templates]


@router.post("/prompt-templates", response_model=PromptTemplateResponse)
def create_prompt_template(
    project_id: str,
    body: PromptTemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    t = PromptTemplate(
        id=str(uuid.uuid4()),
        project_id=project_id,
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
    project_id: str,
    template_id: str,
    body: PromptTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    t = db.query(PromptTemplate).filter(PromptTemplate.id == template_id, PromptTemplate.project_id == project_id).first()
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
    project_id: str,
    template_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    t = db.query(PromptTemplate).filter(PromptTemplate.id == template_id, PromptTemplate.project_id == project_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt template not found")
    db.delete(t)
    db.commit()
    return None


# ---- Deployments ----
@router.get("", response_model=list[DeploymentResponse])
def list_deployments(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    deployments = db.query(Deployment).filter(Deployment.project_id == project_id).order_by(Deployment.created_at.desc()).all()
    return [_deployment_to_response(d) for d in deployments]


def _validate_deployment_kb_im(db: Session, kb_id: str | None, im_id: str | None) -> None:
    """Intent mapper is always tied to a KB; deployments may set both when using mapper routing."""
    if not im_id:
        return
    im_row = db.query(IntentMapper).filter(IntentMapper.id == im_id).first()
    if not im_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")
    if kb_id and kb_id != im_row.knowledge_base_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="knowledge_base_id must match the intent mapper's knowledge base",
        )


@router.post("", response_model=DeploymentResponse)
def create_deployment(
    project_id: str,
    body: DeploymentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    kb_id = body.knowledge_base_id
    im_id = body.intent_mapper_id
    _validate_deployment_kb_im(db, kb_id, im_id)
    _assert_project_refs(db, project_id, kb_id, im_id, body.prompt_template_id)
    d = Deployment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=body.name,
        model_id=body.model_id,
        knowledge_base_id=kb_id,
        intent_mapper_id=im_id,
        prompt_template_id=body.prompt_template_id,
        is_hosted=False,
        live_version=None,
        canvas_state=None,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _deployment_to_response(d)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(
    project_id: str,
    deployment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    d = _scoped_deployment(db, deployment_id, project_id)
    return _deployment_to_response(d)


@router.patch("/{deployment_id}", response_model=DeploymentResponse)
def update_deployment(
    project_id: str,
    deployment_id: str,
    body: DeploymentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    d = _scoped_deployment(db, deployment_id, project_id)
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        d.name = data["name"]
    if "model_id" in data:
        d.model_id = data["model_id"]
    if "knowledge_base_id" in data:
        d.knowledge_base_id = data["knowledge_base_id"]
    if "intent_mapper_id" in data:
        im_val = data["intent_mapper_id"]
        if im_val:
            im_row = db.query(IntentMapper).filter(IntentMapper.id == im_val).first()
            if not im_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intent mapper not found")
        d.intent_mapper_id = im_val
    if "prompt_template_id" in data:
        d.prompt_template_id = data["prompt_template_id"]
    if "is_hosted" in data:
        d.is_hosted = data["is_hosted"]
    if "live_version" in data:
        d.live_version = data["live_version"]
    if "canvas_state" in data:
        d.canvas_state = data["canvas_state"]

    _validate_deployment_kb_im(db, d.knowledge_base_id, d.intent_mapper_id)
    _assert_project_refs(db, project_id, d.knowledge_base_id, d.intent_mapper_id, d.prompt_template_id)

    db.commit()
    db.refresh(d)
    return _deployment_to_response(d)


@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(
    project_id: str,
    deployment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    d = _scoped_deployment(db, deployment_id, project_id)
    db.delete(d)
    db.commit()
    return None


@router.get("/{deployment_id}/export")
def export_deployment(
    project_id: str,
    deployment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    """Export deployment as a zip: config, vector snapshot, and ready-to-run OpenAI-compatible server."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    """Export a specific hosted version as a zip (frozen config + vector snapshot for that version)."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    body: DeployRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    """First-time Deploy: create first hosted version. Fails if deployment already has versions."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_view),
):
    """List all versions for this deployment."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    """Add a new version (freeze current deployment state)."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    """Make this version the running one (stops any other running version for this deployment)."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    """Stop this version (hosted endpoint will return 503 until another version is started)."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_project_edit),
):
    """Delete a version. If it was running, it is stopped first. Session messages and Qdrant data for this version are removed."""
    _scoped_deployment(db, deployment_id, project_id)
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
    project_id: str,
    deployment_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run RAG for this deployment. Body: { \"question\": \"...\" }. Returns response and citations."""
    assert_project_view(db, user, project_id)
    _scoped_deployment(db, deployment_id, project_id)
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
