"""Admin-only connection tests for knowledge documents (retrieval, HTTP API, database)."""
from __future__ import annotations

import json
from typing import Any

from app.models.document import Document, DocumentStatus
from app.models.knowledge_base import KnowledgeBase
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.intent_db import fetch_table_preview
from app.services.intent_http import execute_api_document, merge_body_template
from app.services.qdrant_client import get_qdrant
from app.services.rag import hybrid_retrieval_for_document

from sqlalchemy.orm import Session

_SNIPPET_LEN = 600
_MAX_SNIPPETS = 6
_API_PREVIEW = 16_000


def run_document_connection_test(
    db: Session,
    kb: KnowledgeBase,
    doc: Document,
    *,
    question: str | None,
    request_body: dict | None,
    table: str | None,
    limit: int | None,
    top_k: int | None,
) -> dict[str, Any]:
    """Return a dict matching DocumentTestResponse fields."""
    _ = db
    st = doc.source_type
    cfg = doc.config if isinstance(doc.config, dict) else {}

    if st in ("file", "url", "documentation_zip"):
        q = (question or "").strip()
        if not q:
            return {
                "ok": False,
                "mode": "retrieval",
                "message": "Enter test text (a question or phrase) to run retrieval against this document.",
                "snippets": None,
                "citations": None,
                "api_ok": None,
                "api_response": None,
                "database_preview": None,
            }
        if doc.status != DocumentStatus.COMPLETED:
            return {
                "ok": False,
                "mode": "retrieval",
                "message": f"Document must be indexed (status: completed). Current status: {getattr(doc.status, 'value', doc.status)}.",
                "snippets": None,
                "citations": None,
                "api_ok": None,
                "api_response": None,
                "database_preview": None,
            }

        tk = min(int(top_k or 8), 20)
        emb = resolve_embedding_for_kb(kb.config)
        retriever_mode = (kb.config or {}).get("retriever_mode") or "hybrid"
        client = get_qdrant()
        try:
            parts, citations = hybrid_retrieval_for_document(
                client,
                kb.qdrant_collection_name,
                q,
                doc.id,
                tk,
                emb.get("embedding_model"),
                emb.get("embedding_query_prefix"),
                retriever_mode,
            )
        except Exception as exc:
            return {
                "ok": False,
                "mode": "retrieval",
                "message": str(exc),
                "snippets": None,
                "citations": None,
                "api_ok": None,
                "api_response": None,
                "database_preview": None,
            }

        snippets = []
        for p in parts[:_MAX_SNIPPETS]:
            s = (p or "").strip()
            if len(s) > _SNIPPET_LEN:
                s = s[:_SNIPPET_LEN] + "…"
            if s:
                snippets.append(s)
        msg = (
            f"Retrieved {len(parts)} chunk(s); showing up to {len(snippets)} snippet(s)."
            if parts
            else "No chunks matched this query (try different wording)."
        )
        return {
            "ok": True,
            "mode": "retrieval",
            "message": msg,
            "snippets": snippets or None,
            "citations": citations[:15] if citations else None,
            "api_ok": None,
            "api_response": None,
            "database_preview": None,
        }

    if st == "api":
        method = (cfg.get("method") or "GET").upper()
        url = cfg.get("url") or ""
        headers = cfg.get("headers") if isinstance(cfg.get("headers"), dict) else {}
        body_template = cfg.get("body")
        execute = bool(cfg.get("execute_at_runtime", True))
        bt = body_template
        if isinstance(bt, (dict, list)):
            bt = json.dumps(bt)
        merged = merge_body_template(bt if isinstance(bt, str) else None, request_body)
        if not execute:
            static = "\n".join(
                [
                    f"Method: {method}",
                    f"URL: {url}",
                    f"execute_at_runtime is false — no HTTP request was sent.",
                    f"Body template: {bt}",
                    f"Merged body (preview): {merged}",
                ]
            )
            return {
                "ok": True,
                "mode": "api",
                "message": "Runtime execution is disabled for this document; showing configuration only.",
                "snippets": None,
                "citations": None,
                "api_ok": True,
                "api_response": static[:_API_PREVIEW],
                "database_preview": None,
            }
        ok, text = execute_api_document(method, url, headers, merged)
        preview = (text or "")[:_API_PREVIEW]
        return {
            "ok": ok,
            "mode": "api",
            "message": "HTTP request finished." if ok else "HTTP request failed or returned an error body.",
            "snippets": None,
            "citations": None,
            "api_ok": ok,
            "api_response": preview,
            "database_preview": None,
        }

    if st == "database":
        eng = (cfg.get("engine") or "postgresql").lower()
        allowed = list(cfg.get("allowed_tables") or [])
        tbl = (table or "").strip() or (allowed[0] if allowed else "")
        if not tbl:
            return {
                "ok": False,
                "mode": "database",
                "message": "No table specified and none listed in allowed_tables.",
                "snippets": None,
                "citations": None,
                "api_ok": None,
                "api_response": None,
                "database_preview": None,
            }
        lim = int(limit or 20)
        ok, text = fetch_table_preview(eng, cfg, tbl, limit=lim)
        return {
            "ok": ok,
            "mode": "database",
            "message": "Query executed." if ok else "Query failed.",
            "snippets": None,
            "citations": None,
            "api_ok": None,
            "api_response": None,
            "database_preview": (text or "")[:_API_PREVIEW],
        }

    return {
        "ok": False,
        "mode": "error",
        "message": f"Unsupported source_type: {st}",
        "snippets": None,
        "citations": None,
        "api_ok": None,
        "api_response": None,
        "database_preview": None,
    }
