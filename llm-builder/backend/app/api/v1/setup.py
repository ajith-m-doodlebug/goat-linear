import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User, Role
from app.models.system_settings import SystemSettings
from app.models.model_registry import ModelRegistry, ModelProvider, ModelType
from app.models.prompt_template import PromptTemplate
from app.core.security import get_password_hash
from app.constants.default_prompt import DEFAULT_DOCUMENTATION_PROMPT

router = APIRouter()


class SetupStatusResponse(BaseModel):
    setup_completed: bool


class SetupRequest(BaseModel):
    super_admin_email: EmailStr
    password: str
    company_name: str
    allowed_email_domain: str
    setup_default_prompts_and_models: bool = False


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
    # Validate domain: no @, basic string
    domain = (body.allowed_email_domain or "").strip().lower()
    if not domain or "@" in domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="allowed_email_domain must be a domain without @ (e.g. company.com)",
        )
    # Check super admin email not already taken
    existing = db.query(User).filter(User.email == body.super_admin_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    settings_id = str(uuid.uuid4())
    super_admin_id = str(uuid.uuid4())
    now = None  # set setup_completed_at after user and optional defaults
    settings = SystemSettings(
        id=settings_id,
        company_name=body.company_name,
        allowed_email_domain=domain,
        setup_completed_at=None,
    )
    db.add(settings)
    super_admin = User(
        id=super_admin_id,
        email=body.super_admin_email,
        hashed_password=get_password_hash(body.password),
        full_name=None,
        role=Role.SUPER_ADMIN,
        is_active=True,
    )
    db.add(super_admin)
    if body.setup_default_prompts_and_models:
        model_id = str(uuid.uuid4())
        prompt_id = str(uuid.uuid4())
        db.add(
            ModelRegistry(
                id=model_id,
                name="Server-Ollama",
                provider=ModelProvider.OLLAMA.value,
                model_id="llama3",
                endpoint_url="http://host.docker.internal:11434",
                model_type=ModelType.BASE.value,
            )
        )
        db.add(
            PromptTemplate(
                id=prompt_id,
                name="Documentation",
                content=DEFAULT_DOCUMENTATION_PROMPT,
            )
        )
        settings.default_model_id = model_id
        settings.default_prompt_id = prompt_id
        super_admin.default_model_id = model_id
        super_admin.default_prompt_id = prompt_id
    from datetime import datetime
    settings.setup_completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Setup completed", "super_admin_email": body.super_admin_email}
