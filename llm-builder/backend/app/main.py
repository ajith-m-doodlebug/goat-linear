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


def _is_setup_allowed_path(path: str, method: str) -> bool:
    """True if this path is allowed when setup is not completed."""
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
    Base.metadata.create_all(bind=engine)
    yield
    # shutdown if needed


app = FastAPI(
    title=settings.app_name,
    description="Self-hosted AI infrastructure: RAG, fine-tuning, deployments, chat.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(SetupRequiredMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
    """Kubernetes-style readiness: DB and Redis reachable."""
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
    return {"message": "LLM Builder API", "docs": "/docs"}
