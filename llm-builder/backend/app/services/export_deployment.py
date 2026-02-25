"""Export a deployment as a ready-to-run API server bundle (config, vector snapshot, server code)."""
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session


def _export_ports(deployment_id: str) -> tuple[int, int]:
    """Return (api_port, qdrant_port) derived from deployment_id so each export gets unique ports."""
    h = int(hashlib.md5(deployment_id.encode()).hexdigest()[:6], 16)
    api_port = 8001 + (h % 999)      # 8001–8999 (avoids 8000 used by main app)
    qdrant_port = 6334 + (h % 100)  # 6334–6433 (avoids 6333 used by main Qdrant)
    return api_port, qdrant_port

from app.models.deployment import Deployment
from app.models.knowledge_base import KnowledgeBase
from app.models.model_registry import ModelRegistry
from app.models.prompt_template import PromptTemplate
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.qdrant_client import get_qdrant
from app.services.rag import DEFAULT_RAG_PROMPT


def _get_points_from_collection(collection_name: str) -> list[dict]:
    """Scroll entire collection and return list of {id, vector, payload} for export."""
    client = get_qdrant()
    points_out = []
    offset = None
    limit = 100
    while True:
        points, next_offset = client.scroll(
            collection_name=collection_name,
            offset=offset,
            limit=limit,
            with_payload=True,
            with_vectors=True,
        )
        for p in points:
            vec = p.vector
            if isinstance(vec, dict):
                vec = vec.get("") or list(vec.values())[0] if vec else []
            points_out.append({
                "id": str(p.id) if hasattr(p.id, "__str__") else p.id,
                "vector": vec,
                "payload": p.payload or {},
            })
        if next_offset is None:
            break
        offset = next_offset
    return points_out


def build_export_bundle(db: Session, deployment_id: str) -> bytes:
    """
    Build a zip bundle containing config, vector snapshot (if KB), and a runnable server.
    Returns zip file as bytes.
    """
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not dep:
        raise ValueError("Deployment not found")
    model = db.query(ModelRegistry).filter(ModelRegistry.id == dep.model_id).first()
    if not model:
        raise ValueError("Model not found")

    config = dep.config or {}
    top_k = min(int(config.get("top_k", 10)), 20)
    prompt_text = DEFAULT_RAG_PROMPT
    if dep.prompt_template_id:
        pt = db.query(PromptTemplate).filter(PromptTemplate.id == dep.prompt_template_id).first()
        if pt:
            prompt_text = pt.content

    # Model config (do not export raw API key; user sets env in README)
    model_config = {
        "provider": model.provider,
        "endpoint_url": model.endpoint_url or "",
        "model_id": model.model_id,
        "api_key_env": "API_KEY" if model.provider in ("openai", "custom") else "",
        "extra": model.config or {},
    }

    # Retriever config
    embedding_model = "all-MiniLM-L6-v2"
    embedding_query_prefix = None
    vector_size = 384
    points_data: list[dict] = []
    has_kb = False
    if dep.knowledge_base_id:
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == dep.knowledge_base_id).first()
        if kb and kb.qdrant_collection_name:
            has_kb = True
            emb = resolve_embedding_for_kb(kb.config)
            embedding_model = emb.get("embedding_model") or embedding_model
            embedding_query_prefix = emb.get("embedding_query_prefix")
            from app.services.embedding_registry import get_vector_size
            vector_size = get_vector_size(embedding_model)
            points_data = _get_points_from_collection(kb.qdrant_collection_name)

    export_config = {
        "config_version": 1,
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "deployment_name": dep.name,
        "model": model_config,
        "prompt": prompt_text,
        "retriever": {
            "top_k": top_k,
            "embedding_model": embedding_model,
            "embedding_query_prefix": embedding_query_prefix or "",
        },
        "has_kb": has_kb,
        "vector_size": vector_size,
    }

    api_port, qdrant_port = _export_ports(deployment_id)
    server_main_py = _SERVER_MAIN_PY
    server_requirements = _SERVER_REQUIREMENTS
    docker_compose = _DOCKER_COMPOSE.format(api_port=api_port, qdrant_port=qdrant_port)
    root_readme = _ROOT_README.format(api_port=api_port, qdrant_port=qdrant_port)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("config.json", json.dumps(export_config, indent=2))
        zf.writestr("qdrant_storage/points.json", json.dumps(points_data))
        zf.writestr("server/main.py", server_main_py)
        zf.writestr("server/requirements.txt", server_requirements)
        zf.writestr("Dockerfile", _DOCKERFILE)
        zf.writestr("docker-compose.yml", docker_compose)
        zf.writestr("README.md", root_readme)
    buf.seek(0)
    return buf.getvalue()


_SERVER_REQUIREMENTS = """fastapi>=0.104.0
uvicorn[standard]>=0.24.0
openai>=1.0.0
sentence-transformers>=2.2.0
qdrant-client>=1.7.0
"""

_DOCKERFILE = """# Exported RAG API — minimal inference server
FROM python:3.11-slim

WORKDIR /app
COPY config.json ./
COPY qdrant_storage/ ./qdrant_storage/
COPY server/ ./server/

RUN pip install --no-cache-dir -r server/requirements.txt

WORKDIR /app/server
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

_DOCKER_COMPOSE = """# Run the exported RAG API (build from this directory)
# Set API_KEY in .env or: API_KEY=your_key docker-compose up -d
# Ports are unique per deployment so multiple exports can run alongside the main app.
services:
  qdrant:
    image: qdrant/qdrant:v1.7.4
    ports:
      - "{qdrant_port}:6333"
    volumes:
      - qdrant_storage:/qdrant/storage

  api:
    build: .
    ports:
      - "{api_port}:8000"
    environment:
      - API_KEY=${{API_KEY:-}}
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - qdrant

volumes:
  qdrant_storage:
"""

_ROOT_README = """# Exported RAG API — Ready-to-Run Bundle

This bundle contains a **frozen configuration**, **vector store snapshot**, and a **minimal inference server** that exposes a compatible chat completions endpoint (`/v1/chat/completions`). Runtime behavior matches the builder at export time.

## Contents

- **config.json** — Frozen deployment config (model, retriever, prompt).
- **qdrant_storage/points.json** — Vector store snapshot (if a knowledge base was attached). The server seeds Qdrant (run via Docker Compose) from this file at startup.
- **server/** — Minimal server (FastAPI): loads config, seeds Qdrant from `qdrant_storage/`, exposes `POST /v1/chat/completions`.
- **Dockerfile** / **docker-compose.yml** — Run with Docker (includes Qdrant).
- **server/requirements.txt** — Python dependencies.

---

## How to Run

### Option A: Docker Compose (recommended)

From the **bundle root** (directory containing this README):

```bash
# Optional: create .env with API_KEY=your_key
docker-compose up -d
```

If you replaced the bundle (e.g. re-exported), rebuild the image so the new server code is used:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

API will be at `http://localhost:{api_port}`. Qdrant is exposed on host port **{qdrant_port}** (container stays on 6333). Ports are unique per deployment so you can run multiple exports and the main app at once.

### Option B: Docker only

```bash
docker build -t rag-api .
docker run -p {api_port}:8000 -e API_KEY=your_key rag-api
```

### Option C: Python (venv)

From the **bundle root**:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r server/requirements.txt
# If the deployment has a knowledge base, run Qdrant (e.g. docker run -p {qdrant_port}:6333 qdrant/qdrant:v1.7.4) and set:
# export QDRANT_URL=http://localhost:{qdrant_port}
cd server && uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## API Keys (if required)

If the exported model uses a provider that requires an API key:

- **Docker / docker-compose:** set the `API_KEY` environment variable (e.g. in `.env` or `-e API_KEY=...`).
- **Local run:** `export API_KEY=your_key` before starting the server.

Keys are **not** included in the bundle; you must provide them at runtime.

---

## Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. |
| POST | `/v1/chat/completions` | Chat completion (RAG + LLM). |

**Request body:** `{{"model": "optional", "messages": [{{"role": "user", "content": "Your question"}}]}}`.  
The last `user` message is used as the question; RAG retrieval (if a knowledge base was exported) runs first, then the configured LLM is called.

---

## Example curl

```bash
curl -X POST http://localhost:{api_port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{{"messages": [{{"role": "user", "content": "What is the main topic?"}}]}}'
```
"""

_SERVER_MAIN_PY = '''"""
RAG server compatible with /v1/chat/completions. Loads config, seeds Qdrant from qdrant_storage, queries Qdrant at runtime.
"""
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

# Load config from parent directory (export bundle root)
BUNDLE_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = BUNDLE_ROOT / "config.json"
POINTS_PATH = BUNDLE_ROOT / "qdrant_storage" / "points.json"
COLLECTION_NAME = "rag"

with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

MODEL_CFG = CONFIG["model"]
RETRIEVER = CONFIG["retriever"]
PROMPT_TEMPLATE = CONFIG["prompt"]
TOP_K = RETRIEVER.get("top_k", 10)
EMBEDDING_MODEL = RETRIEVER.get("embedding_model", "all-MiniLM-L6-v2")
QUERY_PREFIX = (RETRIEVER.get("embedding_query_prefix") or "").strip()
VECTOR_SIZE = CONFIG.get("vector_size", 384)
HAS_KB = CONFIG.get("has_kb", False)

# Qdrant client (set at startup after seeding)
_qdrant: QdrantClient | None = None

# Embedding model (lazy load)
_encoder = None

def get_encoder():
    global _encoder
    if _encoder is None:
        _encoder = SentenceTransformer(EMBEDDING_MODEL)
    return _encoder

def embed_query(query: str) -> list[float]:
    enc = get_encoder()
    text = (QUERY_PREFIX + " " + query).strip() if QUERY_PREFIX else query
    return enc.encode(text).tolist()

def get_qdrant() -> QdrantClient:
    global _qdrant
    if _qdrant is None:
        url = os.environ.get("QDRANT_URL", "http://qdrant:6333")
        _qdrant = QdrantClient(url=url)
    return _qdrant

def search(query: str) -> tuple[str, list[dict]]:
    if not HAS_KB or _qdrant is None:
        return "No relevant context found.", []
    try:
        qv = embed_query(query)
        hits = get_qdrant().search(
            collection_name=COLLECTION_NAME,
            query_vector=qv,
            limit=TOP_K,
            with_payload=True,
        )
    except Exception:
        return "No relevant context found.", []
    context_parts = []
    citations = []
    for h in hits:
        payload = h.payload or {}
        text = payload.get("text", "")
        if text:
            context_parts.append(text)
            citations.append({"text": text, "source": payload.get("source", ""), "score": float(h.score)})
    context = "\\n\\n".join(context_parts) if context_parts else "No relevant context found."
    return context, citations

def build_prompt(question: str, context: str) -> str:
    return (
        PROMPT_TEMPLATE.replace("{context}", context)
        .replace("{question}", question)
        .replace("{memory}", "")
    )

def seed_qdrant():
    """Connect to Qdrant, create collection if needed, upsert points from qdrant_storage/points.json."""
    global _qdrant
    if not HAS_KB or not POINTS_PATH.exists():
        return
    url = os.environ.get("QDRANT_URL", "http://qdrant:6333")
    for attempt in range(10):
        try:
            _qdrant = QdrantClient(url=url)
            collections = _qdrant.get_collections().collections
            if not any(c.name == COLLECTION_NAME for c in collections):
                _qdrant.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                )
            with open(POINTS_PATH) as f:
                points_data = json.load(f)
            if not points_data:
                return
            batch_size = 100
            for i in range(0, len(points_data), batch_size):
                batch = points_data[i : i + batch_size]
                points = [
                    PointStruct(id=p["id"], vector=p["vector"], payload=p.get("payload", {}))
                    for p in batch
                ]
                _qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
            return
        except Exception:
            if attempt < 9:
                time.sleep(2)
            else:
                raise

app = FastAPI(title="Exported RAG API", version="1.0.0")

@app.on_event("startup")
def startup():
    seed_qdrant()

@app.get("/health")
def health():
    return {"status": "ok"}

class ChatMessage(BaseModel):
    role: str
    content: str | None = None

class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    stream: bool = False

@app.post("/v1/chat/completions")
def chat_completions(body: ChatCompletionRequest):
    if body.stream:
        raise HTTPException(status_code=400, detail="Streaming not supported")
    # Last user message as the question
    question = ""
    for m in reversed(body.messages or []):
        if m.role == "user" and m.content:
            question = m.content.strip()
            break
    if not question:
        raise HTTPException(status_code=400, detail="No user message found")
    context, _citations = search(question)
    prompt = build_prompt(question, context)
    provider = MODEL_CFG.get("provider", "")
    api_key_env = MODEL_CFG.get("api_key_env") or ""
    if provider == "ollama":
        base_url = (MODEL_CFG.get("endpoint_url") or "").strip().rstrip("/") or "http://localhost:11434"
        api_key = "ollama"
    else:
        api_key = os.environ.get(api_key_env or "API_KEY")
        base_url = (MODEL_CFG.get("endpoint_url") or "").strip().rstrip("/")
    if base_url and not base_url.endswith("/v1"):
        base_url = base_url + "/v1"
    if not base_url and provider == "ollama":
        base_url = "http://localhost:11434/v1"
    client = OpenAI(api_key=api_key or "not-needed", base_url=base_url or None)
    model_id = MODEL_CFG.get("model_id", "gpt-3.5-turbo")
    try:
        resp = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
        )
        choice = resp.choices[0] if resp.choices else None
        content = choice.message.content if choice and choice.message else ""
        return JSONResponse(content={
            "id": resp.id or "export-1",
            "object": "chat.completion",
            "model": model_id,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": getattr(choice, "finish_reason", "stop"),
            }],
            "usage": getattr(resp, "usage", None) or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        })
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
'''
