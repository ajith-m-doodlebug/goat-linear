from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.core.deps import get_current_user, require_auditor

router = APIRouter()


@router.get("/logs")
def list_audit_logs(
    user_id: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_auditor),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)
    logs = q.offset(offset).limit(limit).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "api_key_id": l.api_key_id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "request_id": l.request_id,
            "details": l.details,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else "",
        }
        for l in logs
    ]
