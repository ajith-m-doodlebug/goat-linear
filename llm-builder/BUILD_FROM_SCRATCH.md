# Build From Scratch: LLM Builder (goat)

**Instruction for the AI:** When given this document, recreate the entire project from scratch. Create a directory (e.g. `llm-builder`) and all files as specified. Use the exact file paths relative to that directory. Implement any file not fully pasted below by following the described behavior and the directory structure. After creation, running `./setup.sh` then `./start.sh` from inside the project root should start the application: **App** http://localhost:3000, **API** http://localhost:8000, **Docs** http://localhost:8000/docs.

**How to use:** Create every file and folder listed in Section 2. Use the full file contents where provided (Sections 3–4). Where only a description is given (Sections 5–9), implement the behavior from the description or copy from the existing codebase if available.

---

## 1. Project overview

- **Name:** LLM Builder (Docker Compose project name: **goat**)
- **Purpose:** Self-hosted AI infrastructure: data ingestion, RAG, fine-tuning, model registry, deployments, and chat with roles and audit.
- **Stack:**
  - **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
  - **Backend:** FastAPI, SQLAlchemy 2, Alembic, Redis (RQ), PostgreSQL 16, Qdrant
  - **Deploy:** Docker Compose; optional GPU stack (Ollama, vLLM) via `docker-compose.gpu.yml`
- **Features:** Auth (JWT + API keys), Knowledge bases & document upload, RAG (chunk/embed/Qdrant, hybrid retrieval), Model registry (Ollama/vLLM/OpenAI/custom), Prompt templates, Deployments (model + KB + template), Chat (sessions/messages), Training (datasets/jobs stub), Audit logs, API keys, RAG config presets.
- **Roles:** User, Builder, Admin, Auditor, Super Admin. First registered user becomes Super Admin.

---

## 2. Directory structure

Create the following structure (paths relative to project root, e.g. `llm-builder/`):

```
.env.example
docker-compose.yml
docker-compose.dev.yml
docker-compose.gpu.yml
setup.sh
start.sh
stop.sh
dev.sh
backend/
  Dockerfile
  requirements.txt
  alembic.ini
  alembic/
    env.py
    script.py.mako
    versions/
      001_initial_users.py
      002_knowledge_bases_documents.py
      003_model_registry.py
      004_prompt_templates_deployments.py
      005_chat_sessions_messages.py
      006_training_datasets_jobs.py
      007_audit_apikeys.py
  app/
    __init__.py
    main.py
    core/
      __init__.py
      config.py
      security.py
      deps.py
      queue.py
      audit.py
      logging_config.py
      api_key_auth.py
    db/
      __init__.py
      base.py
    models/
      __init__.py
      user.py
      knowledge_base.py
      document.py
      model_registry.py
      prompt_template.py
      deployment.py
      chat.py
      training.py
      audit.py
      rag_config_preset.py
    schemas/
      __init__.py
      auth.py
      user.py
      knowledge_base.py
      document.py
      rag_config.py
      model_registry.py
      deployment.py
      prompt_template.py
    api/
      __init__.py
      v1/
        __init__.py
        auth.py
        users.py
        knowledge_bases.py
        models.py
        deployments.py
        chat.py
        training.py
        audit.py
        api_keys.py
        rag_configs.py
    services/
      __init__.py
      qdrant_client.py
      document_parser.py
      embedding_registry.py
      keywords.py
      rag.py
      llm_client.py
    workers/
      __init__.py
      runner.py
      ingest.py
      training.py
frontend/
  Dockerfile
  package.json
  package-lock.json (or generate with npm install)
  next.config.js
  tsconfig.json
  postcss.config.js
  tailwind.config.ts
  global.d.ts
  app/
    layout.tsx
    page.tsx
    globals.css
    login/
      page.tsx
    register/
      page.tsx
    dashboard/
      layout.tsx
      page.tsx
      TopBarContext.tsx
      SettingsMenu.tsx
      knowledge/
        page.tsx
      models/
        page.tsx
      deployments/
        page.tsx
      chat/
        page.tsx
      rag-configs/
        page.tsx
      training/
        page.tsx
      audit/
        page.tsx
      api-keys/
        page.tsx
  lib/
    api.ts
  components/
    ui/
      index.ts
      Button.tsx
      Badge.tsx
      Modal.tsx
      PageHeader.tsx
      EmptyState.tsx
      icons.tsx
    rag/
      RagConfigForm.tsx
  public/
    .gitkeep
```

---

## 3. Root-level files

### 3.1 `.env.example`

```env
# Backend
DATABASE_URL=postgresql://llmbuilder:llmbuilder@postgres:5432/llmbuilder
REDIS_URL=redis://redis:6379/0
SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Qdrant (Phase 2+)
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=

# Frontend (for server-side API base URL)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: external LLM (Phase 3+)
# OPENAI_API_KEY=
# OPENAI_BASE_URL=
```

### 3.2 `docker-compose.yml`

```yaml
name: goat

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: llmbuilder
      POSTGRES_PASSWORD: llmbuilder
      POSTGRES_DB: llmbuilder
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U llmbuilder -d llmbuilder"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:v1.7.4
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  adminer:
    image: adminer:latest
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      ADMINER_DEFAULT_SERVER: postgres

  app:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      DATABASE_URL: postgresql://llmbuilder:llmbuilder@postgres:5432/llmbuilder
      REDIS_URL: redis://redis:6379/0
      QDRANT_URL: http://qdrant:6333
      UPLOAD_DIR: /tmp/uploads
    volumes:
      - uploads_data:/tmp/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_started
    ports:
      - "8000:8000"
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    deploy:
      resources:
        limits: { cpus: "2", memory: "2G" }
        reservations: { cpus: "0.25", memory: "256M" }
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      DATABASE_URL: postgresql://llmbuilder:llmbuilder@postgres:5432/llmbuilder
      REDIS_URL: redis://redis:6379/0
      QDRANT_URL: http://qdrant:6333
      UPLOAD_DIR: /tmp/uploads
    volumes:
      - uploads_data:/tmp/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_started
    command: python -m app.workers.runner
    deploy:
      resources:
        limits: { cpus: "2", memory: "4G" }
    restart: unless-stopped

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - app
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  postgres_data:
  qdrant_data:
  uploads_data:
```

### 3.3 `docker-compose.dev.yml`

```yaml
# Dev override: mount source and enable reload. Use with:
#   docker compose -p goat -f docker-compose.yml -f docker-compose.dev.yml up -d
# Or: ./dev.sh

name: goat

services:
  app:
    volumes:
      - ./backend:/app
      - uploads_data:/tmp/uploads
    environment:
      UPLOAD_DIR: /tmp/uploads
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    restart: "no"

  worker:
    volumes:
      - ./backend:/app
      - uploads_data:/tmp/uploads
    environment:
      UPLOAD_DIR: /tmp/uploads
    restart: "no"

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: dev
    volumes:
      - ./frontend:/app
      - web_node_modules:/app/node_modules
    command: ["sh", "-c", "([ -f node_modules/.bin/next ]) || npm install; exec npm run dev"]
    restart: "no"
    environment:
      HOSTNAME: "0.0.0.0"
      NEXT_PUBLIC_API_URL: http://localhost:8000
      WATCHPACK_POLLING: "true"

volumes:
  web_node_modules:
  uploads_data:
```

### 3.4 `docker-compose.gpu.yml` (optional)

Create a file that extends the main compose with an Ollama service (image `ollama/ollama`, port 11434) and optionally vLLM, so that GPU inference can be run alongside the stack. For a minimal stub:

```yaml
# Optional GPU stack. Use: docker compose -p goat -f docker-compose.yml -f docker-compose.gpu.yml up -d
name: goat
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/usr/share/ollama/.ollama
volumes:
  ollama_data:
```

### 3.5 `setup.sh`

```bash
#!/usr/bin/env bash
# Setup LLM Builder (goat): env, build, start infra, run migrations.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT="goat"

echo "[goat] Setting up..."
if [[ ! -f .env ]]; then
  echo "[goat] Creating .env from .env.example"
  cp .env.example .env
  echo "[goat] Please set SECRET_KEY in .env (e.g. openssl rand -hex 32)"
fi

echo "[goat] Building images..."
docker compose -p "$PROJECT" build

echo "[goat] Starting postgres, redis, qdrant..."
docker compose -p "$PROJECT" up -d postgres redis qdrant

echo "[goat] Waiting for postgres to be ready..."
until docker compose -p "$PROJECT" exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; do
  sleep 2
done

echo "[goat] Starting app once to run migrations..."
docker compose -p "$PROJECT" run --rm app alembic upgrade head

echo "[goat] Starting all services..."
docker compose -p "$PROJECT" up -d

echo "[goat] Setup done. App: http://localhost:3000  API: http://localhost:8000  Docs: http://localhost:8000/docs"
echo "[goat] Use ./start.sh to start, ./stop.sh to stop."
```

### 3.6 `start.sh`

```bash
#!/usr/bin/env bash
# Start goat (LLM Builder) with reload on save: backend (--reload), frontend (npm run dev).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
docker compose -p goat -f docker-compose.yml -f docker-compose.dev.yml up -d
echo "[goat] Backend (--reload) and frontend (npm run dev) will reload on save."
echo "[goat] App: http://localhost:3000  API: http://localhost:8000"
echo "[goat] Streaming logs (Ctrl+C to stop following; containers keep running)..."
docker compose -p goat -f docker-compose.yml -f docker-compose.dev.yml logs -f
```

### 3.7 `stop.sh`

```bash
#!/usr/bin/env bash
# Stop goat (LLM Builder) containers only. Volumes and data are preserved.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
docker compose -p goat down
echo "[goat] Stopped."
```

### 3.8 `dev.sh`

```bash
#!/usr/bin/env bash
# Alias for start.sh (reload on save).
exec "$(dirname "${BASH_SOURCE[0]}")/start.sh" "$@"
```

Make all shell scripts executable: `chmod +x setup.sh start.sh stop.sh dev.sh`

---

## 4. Backend

### 4.1 `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4.2 `backend/requirements.txt`

```
# Core
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
email-validator>=2.1.0

# Database
sqlalchemy>=2.0.25
alembic>=1.13.0
asyncpg>=0.29.0
psycopg2-binary>=2.9.9

# Auth & Security
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
bcrypt>=4.0.0,<5.0.0

# Redis
redis>=5.0.0
rq>=1.15.0

# HTTP
httpx>=0.26.0

# Utils
python-multipart>=0.0.6

# Qdrant
qdrant-client>=1.7.0

# Document parsing (worker)
pypdf>=4.0.0
python-docx>=1.1.0
beautifulsoup4>=4.12.0

# Embeddings (worker - optional, can use API)
sentence-transformers>=2.2.0
```

### 4.3 `backend/app/__init__.py`

Empty file or `# app package`.

### 4.4 `backend/app/main.py`

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.api.v1 import api_router
from app.db.base import engine, Base
from app.core.audit import audit_middleware

settings = get_settings()
setup_logging(use_json=not settings.debug, level="DEBUG" if settings.debug else "INFO")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    description="Self-hosted AI infrastructure: RAG, fine-tuning, deployments, chat.",
    version="0.1.0",
    lifespan=lifespan,
)

app.middleware("http")(audit_middleware)
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
```

---

## 5. Backend: core, db, models, schemas

Create these files under `backend/` with the following contents. For any file not shown in full, replicate from the existing codebase or implement as described.

### 5.1 Core

**`backend/app/core/__init__.py`** — empty or `# core`

**`backend/app/core/config.py`** — Pydantic Settings: app_name, debug, database_url, redis_url, secret_key, algorithm, access_token_expire_minutes, refresh_token_expire_days, qdrant_url, qdrant_api_key, upload_dir; Config env_file=".env"; get_settings() cached.

**`backend/app/core/security.py`** — CryptContext bcrypt; verify_password, get_password_hash (truncate to 72 bytes for bcrypt); create_access_token, create_refresh_token, decode_token (jose JWT).

**`backend/app/core/deps.py`** — get_db; get_current_user (Bearer token or X-API-Key via get_user_from_api_key); require_super_admin, require_admin, require_builder, require_user, require_auditor (role checks).

**`backend/app/core/queue.py`** — get_redis(), get_queue() returning RQ Queue "default".

**`backend/app/core/audit.py`** — log_audit(user_id, api_key_id, action, resource_type, resource_id, request_id, details, ip_address) writes to AuditLog; audit_middleware sets request.state.request_id from X-Request-ID or uuid.

**`backend/app/core/logging_config.py`** — JSONFormatter; setup_logging(use_json, level).

**`backend/app/core/api_key_auth.py`** — API_KEY_HEADER = APIKeyHeader("X-API-Key"); hash_key, key_prefix, create_api_key_secret (llmb_ + token_urlsafe); get_user_from_api_key(db, raw_key) looks up ApiKey by key_hash, returns User if active.

### 5.2 DB

**`backend/app/db/__init__.py`** — empty  
**`backend/app/db/base.py`** — create_engine from settings.database_url (pool_pre_ping, pool_size 5, max_overflow 10); SessionLocal; Base = declarative_base(); get_db() generator.

### 5.3 Models (SQLAlchemy)

Create all model files so that: User (id, email, hashed_password, full_name, role Enum, is_active, created_at, updated_at); KnowledgeBase (id, name, description, qdrant_collection_name, config JSONB, created_at, updated_at); Document (id, knowledge_base_id FK, name, source_type, storage_path, status Enum, error_message, metadata_, config, created_at, updated_at); ModelRegistry (id, name, model_type, provider, endpoint_url, model_id, api_key_encrypted, config, version, base_model_id, training_metadata, created_at, updated_at); PromptTemplate (id, name, content, version, created_at, updated_at); Deployment (id, name, model_id FK, knowledge_base_id FK, prompt_template_id FK, memory_turns, config, version, created_at, updated_at); ChatSession (id, deployment_id FK, user_id FK, title, created_at, updated_at); ChatMessage (id, session_id FK, role, content, citations JSONB, created_at); TrainingDataset (id, name, storage_path, format, row_count, created_at); TrainingJob (id, dataset_id FK, base_model_id FK, status, config, error_message, result_model_id FK, metrics, created_at, updated_at); AuditLog (id, user_id, api_key_id, action, resource_type, resource_id, request_id, details, ip_address, created_at); ApiKey (id, user_id, name, key_hash, key_prefix, scopes, last_used_at, created_at); RagConfigPreset (id, user_id FK, name, description, config JSONB, created_at, updated_at). Models __init__.py imports and re-exports all.

### 5.4 Schemas (Pydantic)

Create schemas matching API: auth (LoginRequest, RefreshRequest, Token, TokenPayload); user (UserBase, UserCreate, UserUpdate, UserResponse); knowledge_base (KnowledgeBaseBase, Create, Update, Response); document (DocumentUpdate, DocumentResponse); rag_config (app_defaults, resolve_effective_config, resolve_embedding_for_kb, RagConfigSchema, RagConfigPresetCreate/Update/Response); model_registry (ModelRegistryBase, Create, Update, Response); deployment (DeploymentBase, Create, Update, Response); prompt_template (PromptTemplateBase, Create, Update, Response). Schemas __init__.py exports user and auth.

---

## 6. Backend: API v1 routers

**`backend/app/api/__init__.py`** — empty  
**`backend/app/api/v1/__init__.py`** — Contents:

```python
from fastapi import APIRouter
from app.api.v1 import auth, users, knowledge_bases, models, deployments, chat, training, audit, api_keys, rag_configs

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(knowledge_bases.router, prefix="/knowledge-bases", tags=["knowledge-bases"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(deployments.router, prefix="/deployments", tags=["deployments"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["api-keys"])
api_router.include_router(rag_configs.router, prefix="/rag-configs", tags=["rag-configs"])
```

Implement each router as follows (or copy from the existing codebase):

- **auth.py**: POST /register (UserCreate → first user Super Admin), POST /login (LoginRequest → Token, log_audit), POST /refresh (RefreshRequest → Token), GET /me (UserResponse).
- **users.py**: GET "", GET /me, GET /{user_id}, PATCH /{user_id} (require_admin; UserUpdate).
- **knowledge_bases.py**: GET/POST "" (list/create KB), GET/PATCH/DELETE /{kb_id}; GET /{kb_id}/documents; POST /{kb_id}/upload (file + optional config/preset_id, enqueue run_ingest); POST /{kb_id}/search (body query, top_k); PATCH/DELETE /{kb_id}/documents/{document_id}; POST /{kb_id}/documents/{document_id}/ingest (re-queue ingest). Use require_builder for mutations; resolve config from preset when preset_id given.
- **models.py**: GET/POST "" (list/create ModelRegistry), GET/PATCH/DELETE /{model_id}, POST /{model_id}/test (body prompt), GET /{model_id}/health (llm_client.health_check). require_builder.
- **deployments.py**: GET/POST /prompt-templates, PATCH /prompt-templates/{id}; GET/POST "" (deployments), GET/PATCH/DELETE /{deployment_id}; POST /{deployment_id}/run (body question → run_rag, log_audit). require_builder for CRUD; get_current_user for run.
- **chat.py**: POST /sessions (body deployment_id, title), GET /sessions (?deployment_id), PATCH/DELETE /sessions/{session_id}; GET /sessions/{session_id}/messages, POST /sessions/{session_id}/messages (body content → run_rag, save user+assistant messages, return response+citations); GET /sessions/{session_id}/messages/stream → 501 placeholder.
- **training.py**: GET/POST /datasets (upload file, store under upload_dir/training_datasets), GET /jobs, POST /jobs (body dataset_id, base_model_id, config → enqueue run_training), GET /jobs/{job_id}. require_builder.
- **audit.py**: GET /logs (?user_id, action, limit, offset). require_auditor.
- **api_keys.py**: GET "", POST "" (body name → return key once), DELETE /{key_id}. get_current_user, scope to user's keys.
- **rag_configs.py**: GET/POST "", GET/PATCH/DELETE /{preset_id}. get_current_user; presets scoped by user_id.

---

## 7. Backend: services and workers

**Services:**  
- **qdrant_client.py**: get_qdrant(), ensure_collection(name, vector_size), upsert_points(), delete_points_by_document(collection, document_id). Use qdrant_client QdrantClient, VectorParams COSINE.  
- **document_parser.py**: CHUNK_STRATEGIES, DEFAULT_*; chunk_text(strategy, chunk_size, overlap); extract_text_from_file(path) for .txt, .pdf (pypdf), .docx (python-docx), .html (BeautifulSoup).  
- **embedding_registry.py**: EMBEDDING_MODELS dict (model_id → (vector_size, query_prefix, passage_prefix)); get_vector_size, get_query_prefix, get_passage_prefix; get_embedding_model (SentenceTransformer cache); encode_query(text, model_id, query_prefix); encode_passages(texts, model_id, passage_prefix).  
- **keywords.py**: ENGLISH_STOPWORDS; normalize_for_match; extract_keywords_from_text(text, min_len, stop); question_keywords(question); chunk_contains_any_keyword(chunk_text, keywords).  
- **rag.py**: run_rag(deployment_id, question, chat_history) — load deployment/KB/model/template; hybrid retrieval (keyword scroll + vector search, merge/dedupe); build context and prompt (with {context}, {question}, optional {memory}); complete() via llm_client; return (response_text, citations).  
- **llm_client.py**: complete(model: ModelRegistry, prompt, **config) — dispatch by model.provider: ollama (POST /api/generate), openai/vllm/custom (POST /v1/chat/completions); health_check(model).

**Workers:**  
- **runner.py**: RQ Worker(["default"], connection=Redis.from_url(settings.redis_url)); worker.work().  
- **ingest.py**: run_ingest(document_id) — load doc and KB; read file from upload_dir; extract_text, chunk_text (effective config doc+kb); encode_passages; ensure_collection; delete_points_by_document; upsert points (payload: document_id, chunk_index, text, source, keywords); set doc.status COMPLETED/FAILED.  
- **training.py**: run_training(job_id) — set RUNNING; load base model and dataset; stub: create new ModelRegistry fine_tuned linked to base, set job COMPLETED and result_model_id, metrics; on error set FAILED and error_message.

---

## 8. Alembic migrations

**`backend/alembic.ini`**: script_location = alembic, sqlalchemy.url = postgresql://llmbuilder:llmbuilder@localhost:5432/llmbuilder (overridden by env.py from settings).

**`backend/alembic/env.py`**: Load config; set sqlalchemy.url from get_settings().database_url; target_metadata = Base.metadata; import all models (User, KnowledgeBase, Document, ModelRegistry, PromptTemplate, Deployment, ChatSession, ChatMessage, TrainingDataset, TrainingJob, AuditLog, ApiKey); run_migrations_offline/online.

**`backend/alembic/script.py.mako`**: Standard Alembic mako (revision, down_revision, upgrade/downgrade).

**Migrations (create in order; revision chain 001→002→…→007):**

- **001_initial_users.py**: revision "001", down_revision None. Create ENUM role (super_admin, admin, builder, user, auditor); create table users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at); ix_users_email unique.
- **002_knowledge_bases_documents.py**: revision "002", down "001". Create knowledge_bases (id, name, description, qdrant_collection_name, config JSONB, created_at, updated_at), ix unique on qdrant_collection_name; create documentstatus enum (pending, processing, completed, failed); create documents (id, knowledge_base_id FK CASCADE, name, source_type, storage_path, status, error_message, metadata, config, created_at, updated_at), ix on knowledge_base_id; create rag_config_presets (id, user_id FK CASCADE, name, description, config JSONB, created_at, updated_at).
- **003_model_registry.py**: revision "003", down "002". create model_registry (id, name, model_type, provider, endpoint_url, model_id, api_key_encrypted, config, version, base_model_id, training_metadata, created_at, updated_at).
- **004_prompt_templates_deployments.py**: revision "004", down "003". create prompt_templates; create deployments (model_id FK RESTRICT, knowledge_base_id FK SET NULL, prompt_template_id FK SET NULL, memory_turns, config, version, ...); indexes on model_id, knowledge_base_id.
- **005_chat_sessions_messages.py**: revision "005", down "004". create chat_sessions (deployment_id FK CASCADE, user_id FK CASCADE, title, ...); create chat_messages (session_id FK CASCADE, role, content, citations JSONB, created_at); indexes.
- **006_training_datasets_jobs.py**: revision "006", down "005". create training_datasets; create training_jobs (dataset_id FK CASCADE, base_model_id FK RESTRICT, status, config, error_message, result_model_id FK SET NULL, metrics, ...); indexes.
- **007_audit_apikeys.py**: revision "007", down "006". create audit_logs (user_id, api_key_id, action, resource_type, resource_id, request_id, details, ip_address, created_at); create api_keys (user_id, name, key_hash, key_prefix, scopes, last_used_at, created_at); indexes.

Implement downgrade() for each migration (drop tables/indexes in reverse order; drop enums where created).

---

## 9. Frontend

**Config and entry:**  
- **package.json**: name "llm-builder-frontend", next 14.2.0, react ^18.2.0, TypeScript, tailwindcss, postcss, autoprefixer, eslint, eslint-config-next. Scripts: dev, build, start, lint.  
- **Dockerfile**: multi-stage: base (node:20-alpine, npm install, npm run build); dev (deps only, CMD npm install && npm run dev); runner (standalone output).  
- **next.config.js**: output: 'standalone', reactStrictMode: true.  
- **tsconfig.json**: paths "@/*": ["./*"], strict, jsx preserve, next plugin.  
- **tailwind.config.ts**: darkMode "class", content pages/components/app, theme extend colors.brand (50–700 from CSS vars).  
- **postcss.config.js**: tailwindcss, autoprefixer.  
- **global.d.ts**: reference types react, react-dom.

**App shell:**  
- **app/layout.tsx**: Metadata title "LLM Builder"; html+body; inline script to set document.documentElement.classList.add("dark") if localStorage "app-theme" === "dark".  
- **app/page.tsx**: Landing with "LLM Builder", links to /login and /register.  
- **app/globals.css**: :root CSS vars (foreground, background, card, border, muted, brand-50–700, success, warning, error, radius, shadow); .dark overrides; .input, .label, .btn, .btn-primary, .btn-secondary, .btn-ghost, .card.

**API client:**  
- **lib/api.ts**: API_BASE from NEXT_PUBLIC_API_URL; setTokens, loadTokensFromStorage, clearTokens; apiRequest<T>(path, options) with Bearer token and refresh on 401; authApi (login, register, refresh, me). Types TokenResponse, UserResponse.

**Dashboard:**  
- **app/dashboard/layout.tsx**: "use client"; useEffect authApi.me else redirect /login; sidebar with nav (Home, Knowledge, Models, Deployments, Chat; Chunking & Embedding, Training, Audit, API Keys); TopBarProvider; header with title from TopBarContext and SettingsMenu; render children.  
- **TopBarContext.tsx**: React context for title and action slot; getTitleFromPathname(pathname) map path to label.  
- **SettingsMenu.tsx**: Dropdown for theme toggle and logout (clearTokens, push /).  
- **Dashboard pages**: Each of dashboard/page.tsx (home), knowledge/page.tsx, models/page.tsx, deployments/page.tsx, chat/page.tsx, rag-configs/page.tsx, training/page.tsx, audit/page.tsx, api-keys/page.tsx — use apiRequest to fetch and display list/detail forms; use shared UI components (Button, Badge, Modal, PageHeader, EmptyState, RagConfigForm where applicable).  
- **app/login/page.tsx** and **app/register/page.tsx**: Form (email, password; register + full_name); on success setTokens and redirect to /dashboard.

**UI components:** Implement Button, Badge, Modal, PageHeader, EmptyState, icons (e.g. Lucide-style placeholders), and RagConfigForm (chunk_strategy, chunk_size, chunk_overlap, embedding_model, embedding_query_prefix) so they match the design (Tailwind + CSS vars). **components/ui/index.ts** re-exports.

**public/.gitkeep**: empty file so public is tracked.

---

## 10. Verification

After creating all files:

1. From the project root (e.g. `llm-builder/`): `chmod +x setup.sh start.sh stop.sh dev.sh`
2. Run `./setup.sh` (creates .env from .env.example, builds images, starts postgres/redis/qdrant, runs `alembic upgrade head`, starts all services).
3. Optionally for dev with hot reload: `./start.sh` (uses docker-compose.dev.yml; backend --reload, frontend npm run dev).
4. Open http://localhost:3000 — register first user (becomes Super Admin), then use Knowledge, Models, Deployments, Chat, Training, Audit, API Keys, Chunking & Embedding.
5. API docs at http://localhost:8000/docs.

**If you have the existing codebase:** You may copy any file not fully written above from the existing project into the new one so that paths and behavior match this spec. The directory structure and this document are the single source of truth for “building from scratch.”