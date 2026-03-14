"""Check if system setup has been completed (for middleware gate)."""

from app.db.base import SessionLocal
from app.models.system_settings import SystemSettings


def is_setup_completed() -> bool:
    """Return True if system_settings exists and setup_completed_at is set."""
    try:
        db = SessionLocal()
        try:
            row = db.query(SystemSettings).first()
            return row is not None and row.setup_completed_at is not None
        finally:
            db.close()
    except Exception:
        return False
