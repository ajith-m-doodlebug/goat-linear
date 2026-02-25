from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.api.v1 import api_router
from app.db.base import engine, Base

settings = get_settings()
setup_logging(use_json=not settings.debug, level="DEBUG" if settings.debug else "INFO")


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


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
