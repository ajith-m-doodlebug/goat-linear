import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.audit import ApiKey
from app.core.deps import get_current_user
from app.core.api_key_auth import hash_key, key_prefix, create_api_key_secret

router = APIRouter()


@router.get("")
def list_api_keys(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).all()
    return [
        {"id": k.id, "name": k.name, "key_prefix": k.key_prefix, "scopes": k.scopes, "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None, "created_at": k.created_at.isoformat() if k.created_at else ""}
        for k in keys
    ]


@router.post("")
def create_api_key(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name required")
    secret = create_api_key_secret()
    ak = ApiKey(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=name,
        key_hash=hash_key(secret),
        key_prefix=key_prefix(secret),
        scopes=body.get("scopes"),
    )
    db.add(ak)
    db.commit()
    return {"id": ak.id, "name": ak.name, "key": secret, "key_prefix": ak.key_prefix, "warning": "Save the key now; it will not be shown again."}


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ak = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not ak:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    db.delete(ak)
    db.commit()
    return None
