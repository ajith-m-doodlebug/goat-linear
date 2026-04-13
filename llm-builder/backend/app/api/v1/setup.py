import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User, Role
from app.models.system_settings import SystemSettings
from app.models.prompt_template import PromptTemplate
from app.core.security import get_password_hash
from app.constants.default_prompt import DEFAULT_DOCUMENTATION_PROMPT

router = APIRouter()


class SetupStatusResponse(BaseModel):
    setup_completed: bool


class SetupRequest(BaseModel):
    super_admin_email: EmailStr
    password: str
    setup_default_prompt: bool = False


def _get_system_settings(db: Session) -> SystemSettings | None:
    return db.query(SystemSettings).first()


def _is_setup_completed(db: Session) -> bool:
    settings = _get_system_settings(db)
    return settings is not None and settings.setup_completed_at is not None


@router.get("/status", response_model=SetupStatusResponse)
def get_setup_status(db: Session = Depends(get_db)):
    return SetupStatusResponse(setup_completed=_is_setup_completed(db))


@router.post("")
def run_setup(body: SetupRequest, db: Session = Depends(get_db)):
    if _is_setup_completed(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed",
        )
    email_norm = str(body.super_admin_email).lower().strip()
    if "@" not in email_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid super admin email",
        )
    domain = email_norm.split("@", 1)[1].lower()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid super admin email",
        )
    company_name = domain.split(".")[0].replace("-", " ").title() or "Organization"
    existing = db.query(User).filter(User.email == email_norm).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    settings_id = str(uuid.uuid4())
    super_admin_id = str(uuid.uuid4())
    settings = SystemSettings(
        id=settings_id,
        company_name=company_name,
        allowed_email_domain=domain,
        setup_completed_at=None,
    )
    db.add(settings)
    super_admin = User(
        id=super_admin_id,
        email=email_norm,
        hashed_password=get_password_hash(body.password),
        full_name=None,
        role=Role.SUPER_ADMIN,
        is_active=True,
    )
    db.add(super_admin)
    if body.setup_default_prompt:
        prompt_id = str(uuid.uuid4())
        db.add(
            PromptTemplate(
                id=prompt_id,
                name="Documentation",
                content=DEFAULT_DOCUMENTATION_PROMPT,
            )
        )
        settings.default_prompt_id = prompt_id
        super_admin.default_prompt_id = prompt_id
    from datetime import datetime
    settings.setup_completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Setup completed", "super_admin_email": email_norm}
