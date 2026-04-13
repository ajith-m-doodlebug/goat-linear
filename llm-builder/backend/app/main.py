import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.core.setup_guard import is_setup_completed
from app.api.v1 import api_router
from app.api.hosted import router as hosted_router
from app.db.base import engine, Base

settings = get_settings()
setup_logging(use_json=not settings.debug, level="DEBUG" if settings.debug else "INFO")


def _cors_allow_origins() -> list[str]:
    s = get_settings()
    p = s.ragline_ui_port
    base = [
        f"http://localhost:{p}",
        f"http://127.0.0.1:{p}",
    ]
    if p == 80:
        base.extend(["http://localhost", "http://127.0.0.1"])
    if p == 443:
        base.extend(["https://localhost", "https://127.0.0.1"])
    extra = (s.cors_allow_origins or "").strip()
    if not extra:
        return base
    out = list(base)
    for item in extra.split(","):
        item = item.strip()
        if item and item not in out:
            out.append(item)
    return out


def _cors_allow_origin_regex() -> str | None:
    """Any host on RAGLINE_UI_PORT (non-default ports only — avoids matching every :80 site)."""
    p = get_settings().ragline_ui_port
    if p in (80, 443):
        return None
    return rf"^https?://[\w\.\-]+:{p}$"


def _is_setup_allowed_path(path: str, method: str) -> bool:
    if path == "/api/v1/setup/status" and method == "GET":
        return True
    if path == "/api/v1/setup" and method == "POST":
        return True
    if path in ("/health", "/ready", "/", "/docs", "/redoc", "/openapi.json"):
        return True
    if path.startswith("/openapi.") or path.startswith("/docs") or path.startswith("/redoc"):
        return True
    return False


class SetupRequiredMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip("/") or "/"
        method = request.method
        if _is_setup_allowed_path(path, method):
            return await call_next(request)
        if path.startswith("/api/v1/") or path.startswith("/hosted/"):
            if not is_setup_completed():
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Setup required. Complete setup first."},
                )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
    try:
        from app.services.embedding_registry import warm_embedding_model
        await asyncio.to_thread(warm_embedding_model)
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    description="On-prem AI infrastructure: RAG, fine-tuning, deployments, chat.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(SetupRequiredMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_origin_regex=_cors_allow_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(hosted_router, prefix="/hosted", tags=["hosted"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "llm-builder-api"}


@app.get("/ready")
def ready():
    from fastapi.responses import JSONResponse
    try:
        from app.db.base import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception:
        return JSONResponse(content={"status": "not_ready", "reason": "database"}, status_code=503)
    try:
        from app.core.queue import get_redis
        get_redis().ping()
    except Exception:
        return JSONResponse(content={"status": "not_ready", "reason": "redis"}, status_code=503)
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "RAGLine API", "docs": "/docs"}
