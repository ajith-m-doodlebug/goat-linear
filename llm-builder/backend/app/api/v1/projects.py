import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User, Role
from app.models.project import Project, ProjectMember, ProjectMemberAccess
from app.models.project_model_link import ProjectModelLink
from app.models.prompt_template import PromptTemplate
from app.models.intent_mapper import IntentMapper, IntentMapperDocument
from app.models.deployment import Deployment
from app.schemas.project import (
    ProjectCloneRequest,
    ProjectCreate,
    ProjectMemberInvite,
    ProjectMemberResponse,
    ProjectMemberUpdateAccess,
    ProjectResponse,
    ProjectUpdate,
)
from app.core.deps import get_current_user
from app.core.project_access import assert_project_edit, assert_project_view

router = APIRouter()


def _proj_to_response(p: Project) -> ProjectResponse:
    return ProjectResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        owner_user_id=p.owner_user_id,
        cloned_from_project_id=p.cloned_from_project_id,
        created_at=p.created_at.isoformat() if p.created_at else "",
    )


def _projects_visible_to_user(db: Session, user: User) -> list[Project]:
    if user.role == Role.SUPER_ADMIN:
        return db.query(Project).filter(Project.archived_at.is_(None)).order_by(Project.created_at.desc()).all()
    member_ids = [r.project_id for r in db.query(ProjectMember).filter(ProjectMember.user_id == user.id).all()]
    owned = db.query(Project.id).filter(Project.owner_user_id == user.id, Project.archived_at.is_(None)).all()
    ids = set(member_ids) | {o[0] for o in owned}
    if not ids:
        return []
    return db.query(Project).filter(Project.id.in_(ids), Project.archived_at.is_(None)).order_by(Project.created_at.desc()).all()


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [_proj_to_response(p) for p in _projects_visible_to_user(db, user)]


@router.post("", response_model=ProjectResponse)
def create_project(body: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.DEVELOPER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to create a project")
    pid = str(uuid.uuid4())
    p = Project(
        id=pid,
        name=body.name.strip(),
        description=(body.description or "").strip() or None,
        owner_user_id=user.id,
        cloned_from_project_id=None,
        archived_at=None,
    )
    db.add(p)
    db.add(ProjectMember(project_id=pid, user_id=user.id, access=ProjectMemberAccess.EDIT))
    db.commit()
    db.refresh(p)
    return _proj_to_response(p)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_project_view(db, user, project_id)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return _proj_to_response(p)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_project_edit(db, user, project_id)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if body.name is not None:
        p.name = body.name.strip()
    if body.description is not None:
        p.description = body.description.strip() or None
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _proj_to_response(p)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Soft-delete project (hidden from lists)."""
    assert_project_edit(db, user, project_id)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if p.archived_at is not None:
        return None
    p.archived_at = datetime.utcnow()
    db.commit()
    return None


@router.post("/{project_id}/clone", response_model=ProjectResponse)
def clone_project(
    project_id: str,
    body: ProjectCloneRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_project_edit(db, user, project_id)
    src = db.query(Project).filter(Project.id == project_id).first()
    if not src:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    new_id = str(uuid.uuid4())
    new_proj = Project(
        id=new_id,
        name=body.name.strip(),
        description=src.description,
        owner_user_id=user.id,
        cloned_from_project_id=src.id,
        archived_at=None,
    )
    db.add(new_proj)
    db.add(ProjectMember(project_id=new_id, user_id=user.id, access=ProjectMemberAccess.EDIT))

    prompt_map: dict[str, str] = {}
    for pt in db.query(PromptTemplate).filter(PromptTemplate.project_id == src.id).all():
        nid = str(uuid.uuid4())
        prompt_map[pt.id] = nid
        db.add(
            PromptTemplate(
                id=nid,
                project_id=new_id,
                name=pt.name,
                content=pt.content,
                version=pt.version,
            )
        )

    im_map: dict[str, str] = {}
    for im in db.query(IntentMapper).filter(IntentMapper.project_id == src.id).all():
        nid = str(uuid.uuid4())
        im_map[im.id] = nid
        db.add(
            IntentMapper(
                id=nid,
                project_id=new_id,
                name=im.name,
                routing_model_id=im.routing_model_id,
                knowledge_base_id=im.knowledge_base_id,
            )
        )
        for row in db.query(IntentMapperDocument).filter(IntentMapperDocument.intent_mapper_id == im.id).all():
            db.add(
                IntentMapperDocument(
                    intent_mapper_id=nid,
                    document_id=row.document_id,
                    intent_text=row.intent_text or "",
                )
            )

    for d in db.query(Deployment).filter(Deployment.project_id == src.id).all():
        new_prompt = prompt_map.get(d.prompt_template_id) if d.prompt_template_id else None
        new_im = im_map.get(d.intent_mapper_id) if d.intent_mapper_id else None
        db.add(
            Deployment(
                id=str(uuid.uuid4()),
                project_id=new_id,
                name=d.name,
                model_id=d.model_id,
                knowledge_base_id=d.knowledge_base_id,
                intent_mapper_id=new_im,
                prompt_template_id=new_prompt,
                is_hosted=False,
                live_version=None,
                canvas_state=d.canvas_state,
            )
        )

    for link in db.query(ProjectModelLink).filter(ProjectModelLink.project_id == src.id).all():
        db.add(ProjectModelLink(project_id=new_id, model_id=link.model_id))

    db.commit()
    db.refresh(new_proj)
    return _proj_to_response(new_proj)


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
def list_members(project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_project_view(db, user, project_id)
    rows = db.query(ProjectMember, User).join(User, User.id == ProjectMember.user_id).filter(ProjectMember.project_id == project_id).all()
    return [
        ProjectMemberResponse(user_id=u.id, email=u.email, access=m.access.value if hasattr(m.access, "value") else str(m.access))
        for m, u in rows
    ]


@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
def invite_member(
    project_id: str,
    body: ProjectMemberInvite,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_project_edit(db, user, project_id)
    if body.access not in ("view", "edit"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="access must be view or edit")
    target = db.query(User).filter(User.email == str(body.email).lower().strip()).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    access_enum = ProjectMemberAccess.EDIT if body.access == "edit" else ProjectMemberAccess.VIEW
    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == target.id)
        .first()
    )
    if existing:
        existing.access = access_enum
    else:
        db.add(ProjectMember(project_id=project_id, user_id=target.id, access=access_enum))
    db.commit()
    return ProjectMemberResponse(user_id=target.id, email=target.email, access=body.access)


@router.patch("/{project_id}/members/{member_user_id}", response_model=ProjectMemberResponse)
def update_member_access(
    project_id: str,
    member_user_id: str,
    body: ProjectMemberUpdateAccess,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_project_edit(db, user, project_id)
    if body.access not in ("view", "edit"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="access must be view or edit")
    m = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == member_user_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    m.access = ProjectMemberAccess.EDIT if body.access == "edit" else ProjectMemberAccess.VIEW
    db.commit()
    u = db.query(User).filter(User.id == member_user_id).first()
    return ProjectMemberResponse(user_id=member_user_id, email=u.email if u else "", access=body.access)


@router.delete("/{project_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    member_user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_project_edit(db, user, project_id)
    p = db.query(Project).filter(Project.id == project_id).first()
    if p and p.owner_user_id == member_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove project owner")
    db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == member_user_id).delete()
    db.commit()
    return None
