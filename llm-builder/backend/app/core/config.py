from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "RAGLine"
    debug: bool = False

    # Database
    database_url: str = "postgresql://llmbuilder:llmbuilder@localhost:5432/llmbuilder"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None

    # Uploads: app and worker must share this path (e.g. same Docker volume). Set UPLOAD_DIR in env.
    upload_dir: str = "/tmp/uploads"

    # When a model has no endpoint_url (e.g. Ollama), use this. In Docker with Ollama on host, set to
    # http://host.docker.internal:11434 (Mac/Windows) or http://ollama:11434 if Ollama is in the same compose.
    ollama_default_url: str = "http://localhost:11434"

    # Email (OTP, etc.) — SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@localhost"
    smtp_use_tls: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
