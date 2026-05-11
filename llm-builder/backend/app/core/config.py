from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "RAGLine"
    debug: bool = False
    auto_create_tables: bool = False

    database_url: str = "postgresql://llmbuilder:llmbuilder@localhost:5432/llmbuilder"

    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None

    upload_dir: str = "/tmp/uploads"

    ollama_default_url: str = "http://localhost:11434"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@localhost"
    smtp_use_tls: bool = True

    host_models_public_base_url: str = "http://localhost"
    # If set, Host Models `base_url` / Register uses this host port (e.g. ingress 8005) while Docker still publishes `instance.port`.
    host_models_register_http_port: int | None = None
    host_models_vllm_image: str = "vllm/vllm-openai:latest"
    host_models_llamacpp_image: str = "ghcr.io/ggml-org/llama.cpp:server-cuda"
    # Tiny image used to list host model dirs when the API runs in Docker (same absolute paths as vLLM mounts).
    host_models_docker_ls_image: str = "busybox:latest"
    host_models_hf_cache_dir: str = "/tmp/hf-cache"
    host_models_docker_cmd: str = "docker"
    host_models_require_docker_socket: bool = True
    host_models_local_path_prefix: str | None = None
    host_models_health_timeout_seconds: int = 900
    # If set (e.g. http://172.17.0.1), only health probes use this base + instance.port (not public base_url).
    host_models_health_probe_base_url: str | None = None
    # Auto-assigned Docker publish ports for inference containers start here (Host Models UI no longer picks ports).
    host_models_inference_publish_port_floor: int = 28010

    ragline_ui_port: int = 3000
    ragline_api_port: int = 8005
    cors_allow_origins: str = ""

    # Intent routing / external retrieval safety
    ragline_retrieval_http_timeout_seconds: float = 30.0
    ragline_retrieval_http_max_bytes: int = 2_000_000
    ragline_http_allow_hosts: str = ""  # comma-separated host suffixes; empty uses SSRF blocklist only

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
