import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User, Role
from app.models.system_settings import SystemSettings
from app.schemas.user import UserCreateBySuperAdmin, UserResponse, UserUpdate
from app.core.deps import get_current_user, require_admin, require_super_admin
from app.core.security import get_password_hash

router = APIRouter()

ALLOWED_ROLES_FOR_ASSIGNMENT = (Role.ADMIN, Role.DEVELOPER, Role.TESTER)


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
        default_model_id=user.default_model_id,
        default_prompt_id=user.default_prompt_id,
    )


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    users = db.query(User).all()
    return [_user_to_response(u) for u in users]


@router.post("", response_model=UserResponse)
def create_user(
    body: UserCreateBySuperAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    if body.role not in ALLOWED_ROLES_FOR_ASSIGNMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be admin, developer, or tester",
        )
    email = str(body.email).lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    settings = db.query(SystemSettings).first()
    default_model_id = settings.default_model_id if settings else None
    default_prompt_id = settings.default_prompt_id if settings else None
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=get_password_hash(body.password),
        full_name=None,
        role=body.role,
        is_active=True,
        default_model_id=default_model_id,
        default_prompt_id=default_prompt_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_to_response(user)


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return _user_to_response(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_to_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.default_model_id is not None:
        user.default_model_id = body.default_model_id if body.default_model_id else None
    if body.default_prompt_id is not None:
        user.default_prompt_id = body.default_prompt_id if body.default_prompt_id else None
    if body.password is not None:
        user.hashed_password = get_password_hash(body.password)
    if body.role is not None:
        if current.role != Role.SUPER_ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admin can change roles")
        if body.role not in ALLOWED_ROLES_FOR_ASSIGNMENT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be admin, developer, or tester",
            )
        if user.role == Role.SUPER_ADMIN and body.role != Role.SUPER_ADMIN:
            super_admin_count = db.query(User).filter(User.role == Role.SUPER_ADMIN).count()
            if super_admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot demote the last super admin",
                )
        user.role = body.role
    db.commit()
    db.refresh(user)
    return _user_to_response(user)
