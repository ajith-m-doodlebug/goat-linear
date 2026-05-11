"""Intent mapper: route question to one document, then retrieve from file/API/database."""
from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any

from app.models.deployment import Deployment
from app.models.document import Document
from app.models.intent_mapper import IntentMapper, IntentMapperDocument
from app.models.knowledge_base import KnowledgeBase
from app.models.model_registry import ModelRegistry
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.intent_db import fetch_table_preview
from app.services.intent_http import execute_api_document, merge_body_template
from app.services.keywords import question_keywords
from app.services.llm_client import complete, complete_from_frozen_config
from app.services.qdrant_client import get_qdrant
from app.services.rag import hybrid_retrieval_for_document

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

ROUTING_PROMPT = """You route user questions to exactly one knowledge document. Respond with ONLY a JSON object (no markdown fences).

Required keys: "document_id" (uuid string), "reason" (short string).

Optional keys when needed:
- If the chosen document has source_type "api", you may add "request_body" as a JSON object for POST body overrides.
- If source_type is "database", add "table" (must be one of allowed_tables for that document) and optionally "limit" (integer, max 200).

Documents:
{catalog}

User question:
{question}
"""


def _parse_router_json(text: str) -> dict | None:
    if not text:
        return None
    t = text.strip()
    if t.startswith("{"):
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            pass
    m = re.search(r"\{[\s\S]*\}", t)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


def _fallback_document_id(question: str, rows: list[tuple[Document, str]]) -> str | None:
    qk = question_keywords(question)
    best_id = None
    best_score = -1
    for doc, intent_text in rows:
        it = (intent_text or "").lower()
        score = sum(1 for kw in qk if len(kw) > 1 and kw.lower() in it)
        if score > best_score:
            best_score = score
            best_id = doc.id
    if best_id:
        return best_id
    return rows[0][0].id if rows else None


def _dispatch_document(
    db: Session,
    kb: KnowledgeBase,
    doc: Document,
    question: str,
    decision: dict,
) -> tuple[str, list[dict]]:
    _ = db
    st = doc.source_type
    cfg = doc.config if isinstance(doc.config, dict) else {}

    if st in ("file", "url", "documentation_zip"):
        client = get_qdrant()
        top_k = 10
        emb = resolve_embedding_for_kb(kb.config)
        retriever_mode = (kb.config or {}).get("retriever_mode") or "hybrid"
        context_parts, citations = hybrid_retrieval_for_document(
            client,
            kb.qdrant_collection_name,
            question,
            doc.id,
            top_k,
            emb.get("embedding_model"),
            emb.get("embedding_query_prefix"),
            retriever_mode,
        )
        for c in citations:
            c["source_type"] = st
        ctx = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        return ctx, citations

    if st == "api":
        method = (cfg.get("method") or "GET").upper()
        url = cfg.get("url") or ""
        headers = cfg.get("headers") if isinstance(cfg.get("headers"), dict) else {}
        body_template = cfg.get("body")
        execute = bool(cfg.get("execute_at_runtime", True))
        override = decision.get("request_body") if isinstance(decision.get("request_body"), dict) else None
        bt = body_template
        if isinstance(bt, (dict, list)):
            bt = json.dumps(bt)
        merged = merge_body_template(bt if isinstance(bt, str) else None, override)
        cit = {
            "text": "",
            "source": doc.name,
            "score": 1.0,
            "document_id": doc.id,
            "source_type": "api",
        }
        if execute:
            ok, text = execute_api_document(method, url, headers, merged)
            cit["text"] = (text or "")[:4000]
            return (text if ok else f"API retrieval failed: {text}"), [cit]
        static = "\n".join(
            [
                f"Method: {method}",
                f"URL: {url}",
                f"Headers: {json.dumps(headers)}",
                f"Body template: {bt}",
                f"Example response:\n{cfg.get('example_response') or ''}",
            ]
        )
        cit["text"] = static[:4000]
        return static, [cit]

    if st == "database":
        eng = (cfg.get("engine") or "postgresql").lower()
        allowed = list(cfg.get("allowed_tables") or [])
        table = decision.get("table") or (allowed[0] if allowed else "")
        try:
            limit = int(decision.get("limit") or 50)
        except (TypeError, ValueError):
            limit = 50
        ok, text = fetch_table_preview(eng, cfg, str(table), limit=limit)
        cit = {
            "text": (text or "")[:4000],
            "source": doc.name,
            "score": 1.0,
            "document_id": doc.id,
            "source_type": "database",
            "table": table,
        }
        return (text if ok else f"Database retrieval failed: {text}"), [cit]

    return "No relevant context found.", []


def build_intent_context_live(db: Session, dep: Deployment, question: str) -> tuple[str, list[dict]]:
    if not dep.intent_mapper_id:
        return "No relevant context found.", []
    im = db.query(IntentMapper).filter(IntentMapper.id == dep.intent_mapper_id).first()
    if not im:
        return "No relevant context found.", []
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == im.knowledge_base_id).first()
    routing_model = db.query(ModelRegistry).filter(ModelRegistry.id == im.routing_model_id).first()
    if not kb or not routing_model:
        return "No relevant context found.", []

    rows = (
        db.query(Document, IntentMapperDocument.intent_text)
        .join(IntentMapperDocument, IntentMapperDocument.document_id == Document.id)
        .filter(IntentMapperDocument.intent_mapper_id == im.id)
        .all()
    )
    if not rows:
        return "No relevant context found.", []

    catalog_lines = []
    doc_by_id: dict[str, Document] = {}
    for doc, intent_text in rows:
        doc_by_id[doc.id] = doc
        dcfg = doc.config if isinstance(doc.config, dict) else {}
        block = (
            f"- document_id={doc.id} source_type={doc.source_type} name={doc.name!r} "
            f"intent={intent_text!r}"
        )
        if doc.source_type == "database" and dcfg.get("allowed_tables"):
            block += f" allowed_tables={dcfg.get('allowed_tables')!r}"
        catalog_lines.append(block)

    catalog = "\n".join(catalog_lines)
    prompt = ROUTING_PROMPT.format(catalog=catalog, question=question)
    decision: dict | None = None
    try:
        raw = complete(routing_model, prompt)
        decision = _parse_router_json(raw)
    except Exception:
        decision = None

    doc_id = (decision or {}).get("document_id")
    if isinstance(doc_id, str):
        doc_id = doc_id.strip()
    else:
        doc_id = None

    if not doc_id or doc_id not in doc_by_id:
        doc_id = _fallback_document_id(question, rows)

    doc = doc_by_id.get(doc_id or "")
    if not doc:
        return "No relevant context found.", []

    return _dispatch_document(db, kb, doc, question, decision or {})


def _parse_merged_body_display(merged: str | bytes | None) -> Any:
    if merged is None:
        return None
    if isinstance(merged, bytes):
        merged = merged.decode()
    s = (merged or "").strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return merged


def _guide_for_document(
    doc: Document,
    intent_text: str,
    *,
    selected: bool,
    decision: dict | None,
) -> dict:
    """Structured hints for the intent-mapper test UI: what the deployment would call per source type."""
    cfg = doc.config if isinstance(doc.config, dict) else {}
    st = doc.source_type
    base: dict[str, Any] = {
        "document_id": doc.id,
        "name": doc.name,
        "source_type": st,
        "intent_text": intent_text or "",
        "selected": selected,
        "search_query": None,
        "api_method": None,
        "api_url": None,
        "api_body_template": None,
        "api_body_effective": None,
        "database_allowed_tables": [],
        "database_table_effective": None,
        "database_limit_effective": None,
    }
    if st in ("file", "url", "documentation_zip"):
        base["search_query"] = (
            "Use the user question as the retrieval query (hybrid vector + keyword search over this document's chunks)."
        )
        return base
    if st == "api":
        method = (cfg.get("method") or "GET").upper()
        url = cfg.get("url") or ""
        base["api_method"] = method
        base["api_url"] = url
        bt = cfg.get("body")
        if isinstance(bt, (dict, list)):
            bt = json.dumps(bt)
        tmpl = bt if isinstance(bt, str) else None
        base["api_body_template"] = tmpl
        if selected:
            override = (
                (decision or {}).get("request_body") if isinstance((decision or {}).get("request_body"), dict) else None
            )
            merged = merge_body_template(tmpl, override)
            base["api_body_effective"] = _parse_merged_body_display(merged)
        return base
    if st == "database":
        allowed = [str(x) for x in (cfg.get("allowed_tables") or [])]
        base["database_allowed_tables"] = allowed
        if selected:
            table = (decision or {}).get("table") or (allowed[0] if allowed else "")
            try:
                lim = int((decision or {}).get("limit") or 50)
            except (TypeError, ValueError):
                lim = 50
            base["database_table_effective"] = str(table) if table else None
            base["database_limit_effective"] = lim
        return base
    base["search_query"] = "Check document configuration for this source type."
    return base


def preview_intent_mapper(db: Session, mapper_id: str, question: str) -> dict:
    """Route only; return per-document deployment guidance for the admin test UI (no live retrieval)."""
    question = (question or "").strip()
    if not question:
        raise ValueError("question is required")

    im = db.query(IntentMapper).filter(IntentMapper.id == mapper_id).first()
    if not im:
        raise ValueError("Intent mapper not found")

    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == im.knowledge_base_id).first()
    routing_model = db.query(ModelRegistry).filter(ModelRegistry.id == im.routing_model_id).first()
    if not kb or not routing_model:
        raise ValueError("Knowledge base or routing model missing")

    rows = (
        db.query(Document, IntentMapperDocument.intent_text)
        .join(IntentMapperDocument, IntentMapperDocument.document_id == Document.id)
        .filter(IntentMapperDocument.intent_mapper_id == im.id)
        .all()
    )
    if not rows:
        raise ValueError("No documents mapped for this intent mapper")

    catalog_lines = []
    doc_by_id: dict[str, Document] = {}
    for doc, intent_text in rows:
        doc_by_id[doc.id] = doc
        dcfg = doc.config if isinstance(doc.config, dict) else {}
        block = (
            f"- document_id={doc.id} source_type={doc.source_type} name={doc.name!r} "
            f"intent={intent_text!r}"
        )
        if doc.source_type == "database" and dcfg.get("allowed_tables"):
            block += f" allowed_tables={dcfg.get('allowed_tables')!r}"
        catalog_lines.append(block)

    catalog = "\n".join(catalog_lines)
    prompt = ROUTING_PROMPT.format(catalog=catalog, question=question)

    decision: dict | None = None
    router_error: str | None = None
    try:
        raw = complete(routing_model, prompt)
        decision = _parse_router_json(raw)
    except Exception as exc:
        router_error = str(exc)

    router_reason = None
    if decision and isinstance(decision.get("reason"), str):
        rr = decision["reason"].strip()
        router_reason = rr or None

    requested_id = None
    if decision and isinstance(decision.get("document_id"), str):
        rid = decision["document_id"].strip()
        requested_id = rid or None

    fallback_used = not (requested_id and requested_id in doc_by_id)
    doc_id = requested_id if (requested_id and requested_id in doc_by_id) else _fallback_document_id(question, rows)
    doc = doc_by_id.get(doc_id or "")

    guides = [
        _guide_for_document(
            d,
            it,
            selected=(doc is not None and d.id == doc.id),
            decision=decision if doc and d.id == doc.id else None,
        )
        for d, it in rows
    ]

    if not doc:
        return {
            "question": question,
            "router_error": router_error,
            "requested_document_id": requested_id,
            "router_reason": router_reason,
            "fallback_used": True,
            "error": "Could not resolve a document",
            "selected_document_id": None,
            "documents": guides,
        }

    return {
        "question": question,
        "router_error": router_error,
        "requested_document_id": requested_id,
        "router_reason": router_reason,
        "fallback_used": fallback_used,
        "error": None,
        "selected_document_id": doc.id,
        "documents": guides,
    }


def _fallback_doc_id_from_catalog(question: str, catalog_rows: list[dict]) -> str | None:
    pairs: list[tuple[str, str]] = []
    for e in catalog_rows:
        did = e.get("document_id")
        if did:
            pairs.append((str(did), e.get("intent_text") or ""))
    return _fallback_document_id(
        question,
        [(type("D", (), {"id": a})(), b) for a, b in pairs],
    )


def build_intent_context_frozen(frozen_config: dict, question: str, collection_name: str) -> tuple[str, list[dict]]:
    """Hosted / export: use frozen intent snapshot + Qdrant collection name (hosted_<version>)."""
    if frozen_config.get("retrieval_mode") != "intent":
        return "No relevant context found.", []
    snap = frozen_config.get("intent_snapshot") or {}
    catalog_rows = snap.get("documents") or []
    if not catalog_rows:
        return "No relevant context found.", []

    routing_cfg = snap.get("routing_model") or {}

    catalog_lines = []
    doc_by_id = {}
    for entry in catalog_rows:
        did = entry.get("document_id")
        if not did:
            continue
        doc_by_id[did] = entry
        block = (
            f"- document_id={did} source_type={entry.get('source_type')} "
            f"name={entry.get('name')!r} intent={entry.get('intent_text')!r}"
        )
        if entry.get("source_type") == "database" and entry.get("allowed_tables"):
            block += f" allowed_tables={entry.get('allowed_tables')!r}"
        catalog_lines.append(block)

    catalog = "\n".join(catalog_lines)
    prompt = ROUTING_PROMPT.format(catalog=catalog, question=question)
    try:
        raw = complete_from_frozen_config(routing_cfg, prompt)
        decision = _parse_router_json(raw)
    except Exception:
        decision = None

    doc_id = (decision or {}).get("document_id")
    if isinstance(doc_id, str):
        doc_id = doc_id.strip()
    else:
        doc_id = None

    if not doc_id or doc_id not in doc_by_id:
        doc_id = _fallback_doc_id_from_catalog(question, catalog_rows)

    entry = doc_by_id.get(doc_id or "")
    if not entry:
        return "No relevant context found.", []

    st = entry.get("source_type")
    cfg = entry.get("config") if isinstance(entry.get("config"), dict) else {}
    kb_cfg = frozen_config.get("retriever") or {}

    if st in ("file", "url", "documentation_zip"):
        client = get_qdrant()
        top_k = min(int(kb_cfg.get("top_k", 10)), 20)
        emb_model = kb_cfg.get("embedding_model")
        emb_prefix = kb_cfg.get("embedding_query_prefix") or ""
        mode = kb_cfg.get("mode") or "hybrid"
        context_parts, citations = hybrid_retrieval_for_document(
            client,
            collection_name,
            question,
            entry["document_id"],
            top_k,
            emb_model,
            emb_prefix.strip() or None,
            mode,
        )
        for c in citations:
            c["source_type"] = st
        ctx = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        return ctx, citations

    if st == "api":
        method = (cfg.get("method") or "GET").upper()
        url = cfg.get("url") or ""
        headers = cfg.get("headers") if isinstance(cfg.get("headers"), dict) else {}
        body_template = cfg.get("body")
        execute = bool(cfg.get("execute_at_runtime", True))
        override = decision.get("request_body") if isinstance((decision or {}).get("request_body"), dict) else None
        bt = body_template
        if isinstance(bt, (dict, list)):
            bt = json.dumps(bt)
        merged = merge_body_template(bt if isinstance(bt, str) else None, override)
        cit = {
            "text": "",
            "source": entry.get("name") or "",
            "score": 1.0,
            "document_id": entry["document_id"],
            "source_type": "api",
        }
        if execute:
            ok, text = execute_api_document(method, url, headers, merged)
            cit["text"] = (text or "")[:4000]
            return (text if ok else f"API retrieval failed: {text}"), [cit]
        static = "\n".join(
            [
                f"Method: {method}",
                f"URL: {url}",
                f"Body template: {bt}",
                f"Example response:\n{cfg.get('example_response') or ''}",
            ]
        )
        cit["text"] = static[:4000]
        return static, [cit]

    if st == "database":
        eng = (cfg.get("engine") or "postgresql").lower()
        allowed = list(cfg.get("allowed_tables") or [])
        table = (decision or {}).get("table") or (allowed[0] if allowed else "")
        try:
            limit = int((decision or {}).get("limit") or 50)
        except (TypeError, ValueError):
            limit = 50
        ok, text = fetch_table_preview(eng, cfg, str(table), limit=limit)
        cit = {
            "text": (text or "")[:4000],
            "source": entry.get("name") or "",
            "score": 1.0,
            "document_id": entry["document_id"],
            "source_type": "database",
            "table": table,
        }
        return (text if ok else f"Database retrieval failed: {text}"), [cit]

    return "No relevant context found.", []
