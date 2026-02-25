"""Authenticate request via API key (e.g. X-API-Key header)."""
from fastapi import HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
import hashlib
import secrets

from app.db.base import get_db
from app.models.user import User
from app.models.audit import ApiKey

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def key_prefix(key: str) -> str:
    return (key[:12] + "...") if len(key) > 12 else key


def create_api_key_secret() -> str:
    return "llmb_" + secrets.token_urlsafe(32)


def get_user_from_api_key(db: Session, raw_key: str) -> User | None:
    if not raw_key or not raw_key.startswith("llmb_"):
        return None
    key_hash = hash_key(raw_key)
    ak = db.query(ApiKey).filter(ApiKey.key_hash == key_hash).first()
    if not ak:
        return None
    user = db.query(User).filter(User.id == ak.user_id).first()
    if user and user.is_active:
        return user
    return None
