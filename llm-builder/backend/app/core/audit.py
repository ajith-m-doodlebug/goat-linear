import uuid
from fastapi import Request
from app.db.base import SessionLocal
from app.models.audit import AuditLog


def log_audit(
    user_id: str | None = None,
    api_key_id: str | None = None,
    action: str = "",
    resource_type: str | None = None,
    resource_id: str | None = None,
    request_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        log = AuditLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            api_key_id=api_key_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            request_id=request_id,
            details=details,
            ip_address=ip_address,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


async def audit_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    return response
