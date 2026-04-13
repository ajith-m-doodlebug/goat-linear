"""Hosted deployment: create version (freeze snapshot), start/stop, and seed Qdrant for hosted API."""
import threading
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from qdrant_client.models import Distance, VectorParams, PointStruct

from app.models.deployment import Deployment
from app.models.deployment_version import DeploymentVersion
from app.models.knowledge_base import KnowledgeBase
from app.models.model_registry import ModelRegistry
from app.models.prompt_template import PromptTemplate
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.export_deployment import _get_points_from_collection
from app.services.qdrant_client import get_qdrant
from app.services.rag import DEFAULT_RAG_PROMPT


def _build_frozen_config(
    db: Session,
    deployment_id: str,
    memory_enabled: bool = False,
    memory_turns: int = 10,
) -> tuple[dict, list[dict]]:
    """
    Build frozen config and points_data for a deployment (same structure as export).
    Returns (frozen_config, points_data).
    """
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not dep:
        raise ValueError("Deployment not found")
    model = db.query(ModelRegistry).filter(ModelRegistry.id == dep.model_id).first()
    if not model:
        raise ValueError("Model not found")

    top_k = 10
    prompt_text = DEFAULT_RAG_PROMPT
    if dep.prompt_template_id:
        pt = db.query(PromptTemplate).filter(PromptTemplate.id == dep.prompt_template_id).first()
        if pt:
            prompt_text = pt.content

    model_config = {
        "provider": model.provider,
        "endpoint_url": model.endpoint_url or "",
        "model_id": model.model_id,
        "api_key_env": "API_KEY" if model.provider in ("openai", "custom") else "",
        "extra": model.config or {},
    }
    if model.api_key_encrypted:
        model_config["_api_key"] = model.api_key_encrypted

    embedding_model = "all-MiniLM-L6-v2"
    embedding_query_prefix = None
    retriever_mode = "hybrid"
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
            retriever_mode = (kb.config or {}).get("retriever_mode") or "hybrid"
            from app.services.embedding_registry import get_vector_size as _get_vs
            vector_size = _get_vs(embedding_model)
            points_data = _get_points_from_collection(kb.qdrant_collection_name)

    frozen_config = {
        "config_version": 1,
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "deployment_name": dep.name,
        "model": model_config,
        "prompt": prompt_text,
        "retriever": {
            "top_k": top_k,
            "embedding_model": embedding_model,
            "embedding_query_prefix": embedding_query_prefix or "",
            "mode": retriever_mode,
        },
        "has_kb": has_kb,
        "vector_size": vector_size,
        "memory_enabled": memory_enabled,
        "memory_turns": memory_turns,
    }
    return frozen_config, points_data


def _seed_hosted_collection(version_id: str, vector_size: int, points_data: list[dict]) -> None:
    """Create Qdrant collection hosted_<version_id>; upsert points when points_data is non-empty."""
    client = get_qdrant()
    collection_name = f"hosted_{version_id}"
    collections = client.get_collections().collections
    if not any(c.name == collection_name for c in collections):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
    if not points_data:
        return
    batch_size = 100
    for i in range(0, len(points_data), batch_size):
        batch = points_data[i : i + batch_size]
        points = [
            PointStruct(
                id=p["id"],
                vector=p["vector"],
                payload=p.get("payload", {}),
            )
            for p in batch
        ]
        client.upsert(collection_name=collection_name, points=points)


def create_hosted_version(
    db: Session,
    deployment_id: str,
    memory_enabled: bool = False,
    memory_turns: int = 10,
) -> DeploymentVersion:
    """
    First-time Deploy: create first version for this deployment.
    Raises ValueError if deployment not found or has no model.
    Raises ValueError if this deployment already has at least one version (use add_deployment_version instead).
    """
    existing = db.query(DeploymentVersion).filter(DeploymentVersion.deployment_id == deployment_id).first()
    if existing:
        raise ValueError("Deployment already has hosted versions; use 'New version' to add another")

    frozen_config, points_data = _build_frozen_config(db, deployment_id, memory_enabled, memory_turns)
    version_id = str(uuid.uuid4())
    version_label = "v1"
    host_config = {"memory_enabled": memory_enabled, "memory_turns": memory_turns}

    v = DeploymentVersion(
        id=version_id,
        deployment_id=deployment_id,
        version_label=version_label,
        frozen_config=frozen_config,
        host_config=host_config,
        status="stopped",
    )
    db.add(v)
    db.commit()
    db.refresh(v)

    if frozen_config.get("has_kb"):
        _seed_hosted_collection(version_id, frozen_config["vector_size"], points_data)

    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if dep:
        dep.is_hosted = True
        db.commit()

    return v


def add_deployment_version(
    db: Session,
    deployment_id: str,
) -> DeploymentVersion:
    """
    Add a new version (freeze current deployment state). Uses same memory settings as latest version or defaults.
    """
    latest = (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.deployment_id == deployment_id)
        .order_by(DeploymentVersion.created_at.desc())
        .first()
    )
    memory_enabled = False
    memory_turns = 10
    if latest and latest.frozen_config:
        memory_enabled = latest.frozen_config.get("memory_enabled", False)
        memory_turns = int(latest.frozen_config.get("memory_turns", 10))

    frozen_config, points_data = _build_frozen_config(db, deployment_id, memory_enabled, memory_turns)
    version_id = str(uuid.uuid4())
    next_num = 1
    if latest:
        try:
            next_num = int(latest.version_label.lstrip("v")) + 1
        except (ValueError, TypeError):
            pass
    version_label = f"v{next_num}"
    host_config = {"memory_enabled": memory_enabled, "memory_turns": memory_turns}

    v = DeploymentVersion(
        id=version_id,
        deployment_id=deployment_id,
        version_label=version_label,
        frozen_config=frozen_config,
        host_config=host_config,
        status="stopped",
    )
    db.add(v)
    db.commit()
    db.refresh(v)

    if frozen_config.get("has_kb"):
        _seed_hosted_collection(version_id, frozen_config["vector_size"], points_data)

    return v


def _warm_version_embedding_model(version_id: str) -> None:
    """Load the embedding model for this version's frozen config (for hosted API first-request speed). Runs in background."""
    from app.db.base import SessionLocal
    from app.services.embedding_registry import warm_embedding_model
    db = SessionLocal()
    try:
        v = db.query(DeploymentVersion).filter(DeploymentVersion.id == version_id).first()
        if not v or not v.frozen_config:
            return
        retriever = (v.frozen_config or {}).get("retriever") or {}
        model_id = retriever.get("embedding_model")
        if model_id:
            warm_embedding_model(model_id)
    except Exception:
        pass
    finally:
        db.close()


def start_version(db: Session, version_id: str) -> DeploymentVersion:
    """Set this version to running (and deployment.live_version); stop any other running version."""
    v = db.query(DeploymentVersion).filter(DeploymentVersion.id == version_id).first()
    if not v:
        raise ValueError("Version not found")

    db.query(DeploymentVersion).filter(
        DeploymentVersion.deployment_id == v.deployment_id,
        DeploymentVersion.status == "running",
    ).update({"status": "stopped", "stopped_at": datetime.utcnow()})
    v.status = "running"
    v.started_at = datetime.utcnow()
    v.stopped_at = None

    dep = db.query(Deployment).filter(Deployment.id == v.deployment_id).first()
    if dep:
        dep.live_version = version_id
    db.commit()
    db.refresh(v)
    if v.frozen_config and (v.frozen_config.get("retriever") or {}).get("embedding_model"):
        t = threading.Thread(target=_warm_version_embedding_model, args=(version_id,), daemon=True)
        t.start()
    return v


def stop_version(db: Session, version_id: str) -> DeploymentVersion:
    v = db.query(DeploymentVersion).filter(DeploymentVersion.id == version_id).first()
    if not v:
        raise ValueError("Version not found")
    v.status = "stopped"
    v.stopped_at = datetime.utcnow()
    dep = db.query(Deployment).filter(Deployment.id == v.deployment_id).first()
    if dep and dep.live_version == version_id:
        dep.live_version = None
    db.commit()
    db.refresh(v)
    return v


def delete_version(db: Session, deployment_id: str, version_id: str) -> None:
    """Delete a version: stop if running, remove session messages, drop Qdrant collection, delete row. Clear deployment.is_hosted/live_version if last version."""
    v = db.query(DeploymentVersion).filter(
        DeploymentVersion.id == version_id,
        DeploymentVersion.deployment_id == deployment_id,
    ).first()
    if not v:
        raise ValueError("Version not found")
    if v.status == "running":
        stop_version(db, version_id)
    from app.models.hosted_session_message import HostedSessionMessage
    db.query(HostedSessionMessage).filter(
        HostedSessionMessage.deployment_id == deployment_id,
        HostedSessionMessage.version_id == version_id,
    ).delete(synchronize_session=False)
    db.commit()
    collection_name = f"hosted_{version_id}"
    try:
        client = get_qdrant()
        if any(c.name == collection_name for c in client.get_collections().collections):
            client.delete_collection(collection_name=collection_name)
    except Exception:
        pass
    db.query(DeploymentVersion).filter(
        DeploymentVersion.id == version_id,
        DeploymentVersion.deployment_id == deployment_id,
    ).delete(synchronize_session=False)
    remaining = (
        db.query(DeploymentVersion)
        .filter(DeploymentVersion.deployment_id == deployment_id)
        .count()
    )
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if dep and remaining == 0:
        dep.is_hosted = False
        dep.live_version = None
    db.commit()


def get_running_version_for_deployment(db: Session, deployment_id: str) -> DeploymentVersion | None:
    """Return the live version for this deployment (deployment.live_version), or None."""
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not dep or not dep.live_version:
        return None
    return (
        db.query(DeploymentVersion)
        .filter(
            DeploymentVersion.id == dep.live_version,
            DeploymentVersion.deployment_id == deployment_id,
        )
        .first()
    )


def get_hosted_session_messages(
    db: Session,
    deployment_id: str,
    version_id: str,
    session_id: str,
    limit: int = 20,
) -> list[dict]:
    from app.models.hosted_session_message import HostedSessionMessage
    rows = (
        db.query(HostedSessionMessage)
        .filter(
            HostedSessionMessage.deployment_id == deployment_id,
            HostedSessionMessage.version_id == version_id,
            HostedSessionMessage.session_id == session_id,
        )
        .order_by(HostedSessionMessage.created_at.asc())
        .all()
    )
    out = []
    for r in rows[-(limit * 2) :]:
        out.append({"role": r.role, "content": r.content or ""})
    return out[-limit * 2 :]


def add_hosted_session_messages(
    db: Session,
    deployment_id: str,
    version_id: str,
    session_id: str,
    messages: list[tuple[str, str, list | None]],
    max_messages: int = 100,
) -> None:
    """Append (role, content, attachments?) messages; trim oldest if over max_messages."""
    from app.models.hosted_session_message import HostedSessionMessage
    for row in messages:
        if len(row) == 2:
            role, content = row[0], row[1]
            attachments = None
        else:
            role, content, attachments = row[0], row[1], row[2]
        m = HostedSessionMessage(
            id=str(uuid.uuid4()),
            deployment_id=deployment_id,
            version_id=version_id,
            session_id=session_id,
            role=role,
            content=content or "",
            attachments=attachments,
        )
        db.add(m)
    db.commit()
    rows = (
        db.query(HostedSessionMessage.id)
        .filter(
            HostedSessionMessage.deployment_id == deployment_id,
            HostedSessionMessage.version_id == version_id,
            HostedSessionMessage.session_id == session_id,
        )
        .order_by(HostedSessionMessage.created_at.asc())
        .all()
    )
    if len(rows) > max_messages:
        to_delete = [r.id for r in rows[: len(rows) - max_messages]]
        db.query(HostedSessionMessage).filter(HostedSessionMessage.id.in_(to_delete)).delete(
            synchronize_session=False
        )
        db.commit()
