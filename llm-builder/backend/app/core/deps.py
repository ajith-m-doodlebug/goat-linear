from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User, Role
from app.core.security import decode_token
from app.core.api_key_auth import API_KEY_HEADER, get_user_from_api_key

security = HTTPBearer(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    api_key: Annotated[str | None, Depends(API_KEY_HEADER)],
) -> User:
    # 1) Try Bearer token
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id:
                user = get_user_by_id(db, user_id)
                if user and user.is_active:
                    return user
                if user and not user.is_active:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 2) Try API key (X-API-Key header)
    if api_key and api_key.strip():
        user = get_user_from_api_key(db, api_key.strip())
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unknown API key",
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_super_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != Role.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in (Role.SUPER_ADMIN, Role.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_builder(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.BUILDER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.BUILDER, Role.USER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


def require_auditor(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.AUDITOR):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user
