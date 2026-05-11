import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session


def _export_ports(deployment_id: str) -> tuple[int, int]:
    h = int(hashlib.md5(deployment_id.encode()).hexdigest()[:6], 16)
    api_port = 8001 + (h % 999)
    qdrant_port = 6334 + (h % 100)
    return api_port, qdrant_port

from app.models.deployment import Deployment
from app.models.deployment_version import DeploymentVersion
from app.models.knowledge_base import KnowledgeBase
from app.models.model_registry import ModelRegistry
from app.models.prompt_template import PromptTemplate
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.hosted_deployment import _build_frozen_config
from app.services.document_crypto import decrypt_secret
from app.services.qdrant_client import get_qdrant
from app.services.rag import DEFAULT_RAG_PROMPT


def _prepare_export_intent_snapshot(export_config: dict) -> None:
    """Decrypted DB passwords for export bundle only (zip); not used in hosted frozen JSON in DB."""
    snap = export_config.get("intent_snapshot")
    if not snap:
        return
    new_docs = []
    for d in snap.get("documents") or []:
        d2 = dict(d)
        cfg = dict(d2.get("config") or {})
        if d2.get("source_type") == "database" and cfg.get("password_encrypted"):
            cfg["password_plain_export"] = decrypt_secret(cfg["password_encrypted"])
        d2["config"] = cfg
        new_docs.append(d2)
    snap2 = dict(snap)
    snap2["documents"] = new_docs
    export_config["intent_snapshot"] = snap2


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
    frozen_cfg, points_data = _build_frozen_config(db, deployment_id, False, 10)
    export_config = {k: v for k, v in frozen_cfg.items() if k not in ("memory_enabled", "memory_turns")}
    if export_config.get("model") and isinstance(export_config["model"], dict):
        export_config["model"] = {k: v for k, v in export_config["model"].items() if k != "_api_key"}
    snap = export_config.get("intent_snapshot")
    if snap and isinstance(snap.get("routing_model"), dict):
        rm = {k: v for k, v in snap["routing_model"].items() if k != "_api_key"}
        snap = dict(snap)
        snap["routing_model"] = rm
        export_config["intent_snapshot"] = snap
    _prepare_export_intent_snapshot(export_config)

    api_port, qdrant_port = _export_ports(deployment_id)
    server_main_py = _SERVER_MAIN_PY
    server_requirements = _SERVER_REQUIREMENTS
    if export_config.get("retrieval_mode") == "intent":
        server_requirements = _SERVER_REQUIREMENTS + "\nhttpx>=0.26.0\npsycopg2-binary>=2.9.9\npymysql>=1.1.0\n"
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


def build_export_bundle_from_version(db: Session, deployment_id: str, version_id: str) -> bytes:
    """
    Build a zip bundle from a specific hosted version (frozen config + its Qdrant snapshot).
    Returns zip file as bytes.
    """
    v = (
        db.query(DeploymentVersion)
        .filter(
            DeploymentVersion.id == version_id,
            DeploymentVersion.deployment_id == deployment_id,
        )
        .first()
    )
    if not v or not v.frozen_config:
        raise ValueError("Version not found")
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    export_config = {k: v.frozen_config[k] for k in v.frozen_config if k not in ("memory_enabled", "memory_turns")}
    if "model" in export_config and isinstance(export_config["model"], dict):
        export_config["model"] = {k: export_config["model"][k] for k in export_config["model"] if k != "_api_key"}
    points_data: list[dict] = []
    if export_config.get("has_kb"):
        collection_name = f"hosted_{version_id}"
        try:
            points_data = _get_points_from_collection(collection_name)
        except Exception:
            points_data = []
    snap = export_config.get("intent_snapshot")
    if snap and isinstance(snap.get("routing_model"), dict):
        rm = {k: v for k, v in snap["routing_model"].items() if k != "_api_key"}
        snap = dict(snap)
        snap["routing_model"] = rm
        export_config["intent_snapshot"] = snap
    _prepare_export_intent_snapshot(export_config)

    api_port, qdrant_port = _export_ports(version_id)
    server_main_py = _SERVER_MAIN_PY
    server_requirements = _SERVER_REQUIREMENTS
    if export_config.get("retrieval_mode") == "intent":
        server_requirements = _SERVER_REQUIREMENTS + "\nhttpx>=0.26.0\npsycopg2-binary>=2.9.9\npymysql>=1.1.0\n"
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
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
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
RETRIEVAL_MODE = CONFIG.get("retrieval_mode") or "kb"

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

def _parse_router_json(text: str):
    if not text:
        return None
    t = text.strip()
    if "```" in t:
        parts = t.split("```")
        if len(parts) >= 2:
            t = parts[1].strip()
            if t.lower().startswith("json"):
                t = t[4:].strip()
    if t.startswith("{"):
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            return None
    return None


def _intent_export_search(question: str) -> tuple[str, list[dict]]:
    import httpx
    import sqlite3

    snap = CONFIG.get("intent_snapshot") or {}
    docs = snap.get("documents") or []
    rout = snap.get("routing_model") or {}
    if not docs:
        return "No relevant context found.", []
    lines = []
    by_id = {}
    for e in docs:
        did = e.get("document_id")
        if not did:
            continue
        by_id[did] = e
        ln = "- document_id=%s source_type=%s name=%r intent=%r" % (
            did,
            e.get("source_type"),
            e.get("name"),
            e.get("intent_text"),
        )
        if e.get("source_type") == "database" and e.get("allowed_tables"):
            ln += " allowed_tables=%r" % (e.get("allowed_tables"),)
        lines.append(ln)
    catalog = "\\n".join(lines)
    rp = (
        "You route user questions to exactly one knowledge document. Respond with ONLY a JSON object.\\n"
        'Required keys: "document_id" (uuid string), "reason" (short string).\\n'
        'Optional: for api add "request_body"; for database add "table" and "limit".\\n\\n'
        "Documents:\\n%s\\n\\nUser question:\\n%s"
    ) % (catalog, question)
    raw = ""
    try:
        prov = (rout.get("provider") or "").lower()
        api_key = os.environ.get(rout.get("api_key_env") or "API_KEY")
        base_url = (rout.get("endpoint_url") or "").strip().rstrip("/")
        if base_url and not base_url.endswith("/v1"):
            base_url = base_url + "/v1"
        rid = rout.get("model_id") or "gpt-3.5-turbo"
        rc = OpenAI(api_key=api_key or "not-needed", base_url=base_url or None)
        rr = rc.chat.completions.create(
            model=rid,
            messages=[{"role": "user", "content": rp}],
            extra_body={"enable_thinking": False, "chat_template_kwargs": {"enable_thinking": False}},
        )
        raw = (rr.choices[0].message.content or "") if rr.choices else ""
    except Exception:
        raw = ""
    dec = _parse_router_json(raw) or {}
    doc_id = dec.get("document_id")
    if isinstance(doc_id, str):
        doc_id = doc_id.strip()
    if not doc_id or doc_id not in by_id:
        doc_id = docs[0].get("document_id")
    entry = by_id.get(doc_id) if doc_id else None
    if not entry:
        return "No relevant context found.", []

    st = entry.get("source_type")
    cfg = entry.get("config") if isinstance(entry.get("config"), dict) else {}

    if st in ("file", "url", "documentation_zip"):
        if not HAS_KB or _qdrant is None:
            return "No relevant context found.", []
        try:
            qv = embed_query(question)
            flt = Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=doc_id))])
            resp = get_qdrant().query_points(
                collection_name=COLLECTION_NAME,
                query=qv,
                query_filter=flt,
                limit=TOP_K,
                with_payload=True,
            )
            hits = getattr(resp, "points", None) or []
        except Exception:
            return "No relevant context found.", []
        parts = []
        cites = []
        for h in hits:
            payload = h.payload or {}
            text = payload.get("text", "")
            if text:
                parts.append(text)
                cites.append(
                    {
                        "text": text,
                        "source": payload.get("source", ""),
                        "score": float(h.score),
                        "document_id": doc_id,
                        "source_type": st,
                    }
                )
        ctx = "\\n\\n".join(parts) if parts else "No relevant context found."
        return ctx, cites

    if st == "api":
        method = (cfg.get("method") or "GET").upper()
        url = cfg.get("url") or ""
        headers = cfg.get("headers") if isinstance(cfg.get("headers"), dict) else {}
        execute = bool(cfg.get("execute_at_runtime", True))
        cit = {"text": "", "source": entry.get("name") or "", "score": 1.0, "document_id": doc_id, "source_type": "api"}
        if execute:
            try:
                body = dec.get("request_body")
                bd = cfg.get("body")
                if isinstance(bd, dict) and isinstance(body, dict):
                    merged = json.dumps({**bd, **body})
                elif isinstance(bd, str):
                    merged = bd
                else:
                    merged = json.dumps(bd) if bd else None
                with httpx.Client(timeout=30.0, follow_redirects=False) as cli:
                    r = cli.request(method, url, headers=headers, content=merged if merged and method not in ("GET", "HEAD") else None)
                txt = r.text[:400000]
                cit["text"] = txt[:4000]
                return ("HTTP %s\\n%s" % (r.status_code, txt)), [cit]
            except Exception as ex:
                return "API retrieval failed: %s" % ex, [cit]
        static = "Method: %s\\nURL: %s\\nExample:\\n%s" % (method, url, cfg.get("example_response") or "")
        cit["text"] = static[:4000]
        return static, [cit]

    if st == "database":
        eng = (cfg.get("engine") or "postgresql").lower()
        allowed = list(cfg.get("allowed_tables") or [])
        table = dec.get("table") or (allowed[0] if allowed else "")
        if table not in allowed:
            return "Invalid or disallowed table for this document.", []
        lim = min(int(dec.get("limit") or 50), 200)
        pwd = cfg.get("password_plain_export") or ""
        try:
            if eng == "postgresql":
                import psycopg2
                conn = psycopg2.connect(
                    host=cfg.get("host") or "localhost",
                    port=int(cfg.get("port") or 5432),
                    dbname=cfg.get("database") or "",
                    user=cfg.get("user") or "",
                    password=pwd,
                    connect_timeout=10,
                )
                conn.set_session(readonly=True, autocommit=True)
                cur = conn.cursor()
                cur.execute('SELECT * FROM "' + table.replace('"', "") + '" LIMIT %s', (lim,))
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
                cur.close()
                conn.close()
                out = ", ".join(str(c) for c in cols) + "\\n" + "\\n".join(str(x) for x in rows[:lim])
            elif eng == "mysql":
                import pymysql
                conn = pymysql.connect(
                    host=cfg.get("host") or "localhost",
                    port=int(cfg.get("port") or 3306),
                    database=cfg.get("database") or "",
                    user=cfg.get("user") or "",
                    password=pwd,
                    connect_timeout=10,
                    read_timeout=60,
                )
                cur = conn.cursor()
                cur.execute("SELECT * FROM `" + table.replace("`", "") + "` LIMIT %s", (lim,))
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
                cur.close()
                conn.close()
                out = ", ".join(str(c) for c in cols) + "\\n" + "\\n".join(str(x) for x in rows[:lim])
            else:
                conn = sqlite3.connect(cfg.get("sqlite_path") or "", timeout=10)
                cur = conn.execute("SELECT * FROM \"%s\" LIMIT %d" % (table.replace('"', ""), lim))
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
                conn.close()
                out = ", ".join(str(c) for c in cols) + "\\n" + "\\n".join(str(x) for x in rows[:lim])
            cit = {
                "text": out[:4000],
                "source": entry.get("name") or "",
                "score": 1.0,
                "document_id": doc_id,
                "source_type": "database",
            }
            return out, [cit]
        except Exception as ex:
            return "Database retrieval failed: %s" % ex, []

    return "No relevant context found.", []


def search(query: str) -> tuple[str, list[dict]]:
    if RETRIEVAL_MODE == "intent":
        return _intent_export_search(query)
    if not HAS_KB or _qdrant is None:
        return "No relevant context found.", []
    try:
        qv = embed_query(query)
        resp = get_qdrant().query_points(
            collection_name=COLLECTION_NAME,
            query=qv,
            limit=TOP_K,
            with_payload=True,
        )
        hits = getattr(resp, "points", None) or []
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
            extra_body={
                "enable_thinking": False,
                "chat_template_kwargs": {"enable_thinking": False},
            },
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
