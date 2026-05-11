"""RAG: hybrid retrieval (semantic + keyword), then LLM. Best-practice pipeline."""
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from qdrant_client.models import Filter, FieldCondition, MatchValue, Range
from app.db.base import SessionLocal
from app.models.deployment import Deployment
from app.models.knowledge_base import KnowledgeBase
from app.models.model_registry import ModelRegistry
from app.models.prompt_template import PromptTemplate
from app.services.qdrant_client import get_qdrant
from app.services.embedding_registry import encode_query as encode_query_with_model
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.llm_client import complete, complete_with_images
from app.services.keywords import question_keywords, chunk_contains_any_keyword

# Cap for keyword-only path; prefer chunks that match more question keywords.
KEYWORD_TOP_K_MAX = 30
# Require at least this many question keywords in a chunk (1 = include all keyword matches; ranking still prefers more).
MIN_KEYWORDS_REQUIRED = 1

# Default prompt when no custom prompt template is set on the deployment. Uses {context} and {question}; memory is prepended.
DEFAULT_RAG_PROMPT = (
    "Answer the question using only the context below. "
    "Do not use external knowledge. Use information, numbers, and names exactly as they appear in the context. "
    "Do not invent or assume meanings for abbreviations or acronyms; use only what the context states. "
    "If the context contains a section that directly defines or lists what is asked, base your answer on that section. "
    "If the answer is not in the context, say so briefly.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}\n\n"
    "Answer:"
)


def _count_keyword_matches(text: str, keywords: set[str]) -> int:
    """Number of distinct question keywords that appear in the chunk."""
    if not text or not keywords:
        return 0
    return sum(1 for kw in keywords if chunk_contains_any_keyword(text, {kw}))


def _rerank_with_keyword_boost(candidates: list, question: str, top_k: int) -> list:
    """Re-rank by vector score + bonus for chunks containing question keywords."""
    keywords = question_keywords(question)
    if not keywords:
        return candidates[:top_k]
    scored = []
    for r in candidates:
        text = (r.payload or {}).get("text", "")
        boost = 0.4 * _count_keyword_matches(text, keywords)
        scored.append((r.score + boost, r))
    scored.sort(key=lambda x: -x[0])
    return [r for _, r in scored[:top_k]]


def _document_filter(document_id: str | None) -> Filter | None:
    if not document_id:
        return None
    return Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))])


def _scroll_all_keyword_matches(
    client,
    collection_name: str,
    keywords: set[str],
    seen_texts: set,
    min_keywords: int = 1,
    document_id: str | None = None,
) -> list:
    """Scroll collection; return points whose text contains at least min_keywords of the question keywords."""
    if not keywords:
        return []
    out = []
    offset = None
    scroll_limit = 100
    max_points = 2_000  # cap to avoid slow full scans; increase if KB is huge and you need more recall
    total = 0
    doc_f = _document_filter(document_id)
    while total < max_points:
        scroll_kw = dict(
            collection_name=collection_name,
            offset=offset,
            limit=scroll_limit,
            with_payload=True,
            with_vectors=False,
        )
        if doc_f is not None:
            scroll_kw["scroll_filter"] = doc_f
        points, next_offset = client.scroll(**scroll_kw)
        if not points:
            break
        for point in points:
            text = (point.payload or {}).get("text", "")
            if not text or text in seen_texts:
                continue
            n_matched = _count_keyword_matches(text, keywords)
            if n_matched >= min_keywords:
                out.append((n_matched, point))
                seen_texts.add(text)
        total += len(points)
        if next_offset is None:
            break
        offset = next_offset
    return out


def hybrid_retrieval_for_document(
    client,
    collection_name: str,
    question: str,
    document_id: str,
    top_k: int,
    embedding_model: str | None,
    embedding_query_prefix: str | None,
    retriever_mode: str,
) -> tuple[list[str], list[dict]]:
    """Hybrid (or vector-only) retrieval restricted to a single document_id."""
    keywords = question_keywords(question) if retriever_mode == "hybrid" else set()
    keyword_top_k = min(KEYWORD_TOP_K_MAX, top_k * 2)
    fetch = min(top_k * 5, 150)
    keyword_scored = []
    vector_results = []
    try:
        if retriever_mode == "vector_only":
            vector_results = _vector_retrieval(
                client,
                collection_name,
                question,
                top_k,
                fetch,
                embedding_model=embedding_model,
                embedding_query_prefix=embedding_query_prefix,
                document_id=document_id,
            )
        else:
            with ThreadPoolExecutor(max_workers=2) as executor:
                fut_kw = executor.submit(
                    _keyword_retrieval,
                    client,
                    collection_name,
                    keywords,
                    keyword_top_k,
                    document_id,
                )
                fut_vec = executor.submit(
                    _vector_retrieval,
                    client,
                    collection_name,
                    question,
                    top_k,
                    fetch,
                    embedding_model=embedding_model,
                    embedding_query_prefix=embedding_query_prefix,
                    document_id=document_id,
                )
                keyword_scored = fut_kw.result()
                vector_results = fut_vec.result()
    except Exception:
        pass

    if not keyword_scored and not vector_results:
        return [], []
    context_parts, citations, payloads = _merge_and_take_top_k(
        keyword_scored,
        vector_results,
        keywords,
        top_k,
    )
    context_parts = _expand_context_with_same_file(
        client,
        collection_name,
        context_parts,
        payloads,
    )
    return context_parts, citations


def _cap_and_rank_keyword_matches(keyword_scored: list, cap: int) -> list:
    """Sort by number of keyword matches (desc), return at most cap (n_matched, point) pairs."""
    if not keyword_scored:
        return []
    keyword_scored.sort(key=lambda x: -x[0])
    return keyword_scored[:cap]


def _keyword_retrieval(client, collection_name: str, keywords: set, keyword_top_k: int, document_id: str | None = None) -> list:
    """Run keyword scroll + cap/rank. Used in parallel with vector retrieval."""
    seen_texts = set()
    keyword_scored = _scroll_all_keyword_matches(
        client,
        collection_name,
        keywords,
        seen_texts,
        min_keywords=MIN_KEYWORDS_REQUIRED,
        document_id=document_id,
    )
    return _cap_and_rank_keyword_matches(keyword_scored, keyword_top_k)


def _vector_retrieval(
    client,
    collection_name: str,
    question: str,
    top_k: int,
    fetch: int,
    embedding_model: str | None = None,
    embedding_query_prefix: str | None = None,
    document_id: str | None = None,
) -> list:
    """Run embedding + vector search + keyword re-rank. Used in parallel with keyword retrieval."""
    vector = encode_query_with_model(question, model_id=embedding_model, query_prefix=embedding_query_prefix)
    q_kw: dict = dict(
        collection_name=collection_name,
        query=vector,
        limit=fetch,
        with_payload=True,
    )
    df = _document_filter(document_id)
    if df is not None:
        q_kw["query_filter"] = df
    resp = client.query_points(**q_kw)
    raw = getattr(resp, "points", None) or []
    return _rerank_with_keyword_boost(raw, question, top_k)


def _merge_and_take_top_k(
    keyword_scored: list,
    vector_results: list,
    keywords: set[str],
    top_k: int,
) -> tuple[list[str], list[dict], list[dict]]:
    """
    Merge keyword and vector chunks; dedupe by text. Sort by (n_matched desc, score desc)
    so chunks that match more question keywords always rank higher. Return top_k chunks.
    Also returns list of payloads (one per chunk) for optional adjacent-context expansion.
    """
    best = {}
    for n_matched, point in keyword_scored:
        payload = point.payload or {}
        text = payload.get("text", "")
        source = payload.get("source", "")
        if not text:
            continue
        score = 0.5 + 0.2 * n_matched
        prev = best.get(text)
        if prev is None or (n_matched > prev[0]) or (n_matched == prev[0] and score > prev[1]):
            best[text] = (n_matched, score, source, payload)
    for r in vector_results:
        payload = r.payload or {}
        text = payload.get("text", "")
        source = payload.get("source", "")
        if not text:
            continue
        n_matched = _count_keyword_matches(text, keywords) if keywords else 0
        score = r.score + 0.25 * n_matched
        prev = best.get(text)
        if prev is None or (n_matched > prev[0]) or (n_matched == prev[0] and score > prev[1]):
            best[text] = (n_matched, score, source, payload)
    ordered = sorted(best.items(), key=lambda x: (-x[1][0], -x[1][1]))[:top_k]
    context_parts = [text for text, _ in ordered]
    payloads = [payload for _, (_, _, _, payload) in ordered]
    citations = []
    for text, (_, score, source, payload) in ordered:
        c = {"text": text, "source": source, "score": score}
        if payload.get("document_id") is not None:
            c["document_id"] = payload["document_id"]
        if payload.get("source_path") is not None:
            c["source_path"] = payload["source_path"]
        if payload.get("breadcrumb") is not None:
            c["breadcrumb"] = payload["breadcrumb"]
        if payload.get("heading") is not None:
            c["heading"] = payload["heading"]
        if payload.get("section_index") is not None:
            c["section_index"] = payload["section_index"]
        citations.append(c)
    return context_parts, citations, payloads


def _fetch_all_chunks_for_file(
    client,
    collection_name: str,
    document_id: str,
    source_path: str,
) -> list[tuple[int, str]]:
    """
    Fetch all chunks for a documentation file, ordered by section_index.
    Returns list of (section_index, text).
    """
    try:
        points, _ = client.scroll(
            collection_name=collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                    FieldCondition(key="source_path", match=MatchValue(value=source_path)),
                ]
            ),
            limit=200,
            with_payload=True,
            with_vectors=False,
        )
    except Exception:
        return []
    out = []
    for pt in points:
        payload = pt.payload or {}
        idx = payload.get("section_index", 0)
        text = (payload.get("text") or "").strip()
        if text:
            out.append((idx, text))
    out.sort(key=lambda x: x[0])
    return out


def _expand_context_with_same_file(
    client,
    collection_name: str,
    context_parts: list[str],
    payloads: list[dict],
) -> list[str]:
    """
    For documentation chunks: when a result comes from a doc file (source_path, section_index),
    include the ENTIRE file (all sections) so answers like "Explain different types of X"
    get the full page (e.g. Measurements intro + Transient + AC + DC). Each file is added
    at most once, at the position of its first appearance in the result list.
    """
    expanded = []
    seen_file: set[tuple[str, str]] = set()
    for part, payload in zip(context_parts, payloads):
        doc_id = payload.get("document_id")
        source_path = payload.get("source_path")
        if doc_id is None or source_path is None or payload.get("section_index") is None:
            expanded.append(part)
            continue
        key = (doc_id, source_path)
        if key in seen_file:
            continue
        seen_file.add(key)
        chunks = _fetch_all_chunks_for_file(client, collection_name, doc_id, source_path)
        if chunks:
            full_text = "\n\n".join(text for _, text in chunks)
            expanded.append(full_text)
        else:
            expanded.append(part)
    return expanded


def run_rag(
    deployment_id: str,
    question: str,
    chat_history: list[dict] | None = None,
    images: list[dict] | None = None,
) -> tuple[str, list[dict]]:
    """
    Hybrid RAG: (1) Keyword-first pass over full KB so no fact is missed.
    (2) Vector search + keyword re-rank for relevance. (3) Merge, dedupe, prompt, generate.
    images: optional list of {media_type, data} for vision models (validated upstream).
    """
    db = SessionLocal()
    try:
        dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not dep:
            raise ValueError("Deployment not found")
        model = db.query(ModelRegistry).filter(ModelRegistry.id == dep.model_id).first()
        if not model:
            raise ValueError("Model not found")

        question = (question or "").strip()

        context_parts = []
        citations = []
        context = "No relevant context found."

        if dep.intent_mapper_id:
            from app.services.intent_routing import build_intent_context_live

            context, citations = build_intent_context_live(db, dep, question)

        elif dep.knowledge_base_id:
            kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == dep.knowledge_base_id).first()
            if kb:
                top_k = 10
                emb = resolve_embedding_for_kb(kb.config)
                embedding_model = emb.get("embedding_model")
                embedding_query_prefix = emb.get("embedding_query_prefix")
                retriever_mode = (kb.config or {}).get("retriever_mode") or "hybrid"
                client = get_qdrant()
                keywords = question_keywords(question) if retriever_mode == "hybrid" else set()
                keyword_top_k = min(KEYWORD_TOP_K_MAX, top_k * 2)

                keyword_scored = []
                vector_results = []
                fetch = min(top_k * 5, 150)
                try:
                    if retriever_mode == "vector_only":
                        vector_results = _vector_retrieval(
                            client,
                            kb.qdrant_collection_name,
                            question,
                            top_k,
                            fetch,
                            embedding_model=embedding_model,
                            embedding_query_prefix=embedding_query_prefix,
                        )
                    else:
                        with ThreadPoolExecutor(max_workers=2) as executor:
                            fut_kw = executor.submit(
                                _keyword_retrieval,
                                client,
                                kb.qdrant_collection_name,
                                keywords,
                                keyword_top_k,
                            )
                            fut_vec = executor.submit(
                                _vector_retrieval,
                                client,
                                kb.qdrant_collection_name,
                                question,
                                top_k,
                                fetch,
                                embedding_model=embedding_model,
                                embedding_query_prefix=embedding_query_prefix,
                            )
                            keyword_scored = fut_kw.result()
                            vector_results = fut_vec.result()
                except Exception:
                    pass

                if keyword_scored or vector_results:
                    context_parts, citations, payloads = _merge_and_take_top_k(
                        keyword_scored,
                        vector_results,
                        keywords,
                        top_k,
                    )
                    context_parts = _expand_context_with_same_file(
                        client,
                        kb.qdrant_collection_name,
                        context_parts,
                        payloads,
                    )
                else:
                    citations = []

            context = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        prompt_template = None
        if dep.prompt_template_id:
            prompt_template = db.query(PromptTemplate).filter(PromptTemplate.id == dep.prompt_template_id).first()
        memory_block = ""
        if chat_history:
            memory_block = "Previous conversation:\n" + "\n".join(
                f"{m.get('role', 'user')}: {m.get('content', '')}" for m in chat_history[-20:]
            ) + "\n\n"

        if prompt_template:
            prompt = prompt_template.content.replace("{context}", context).replace("{question}", question)
            if "{memory}" in prompt_template.content:
                prompt = prompt.replace("{memory}", memory_block)
            else:
                prompt = memory_block + prompt
        else:
            prompt = memory_block + DEFAULT_RAG_PROMPT.format(context=context, question=question)

        try:
            if images:
                response_text = complete_with_images(model, prompt, images)
            else:
                response_text = complete(model, prompt)
        except Exception as e:
            err_msg = str(e)
            response_text = "Error generating response: " + err_msg
            if "101" in err_msg or "unreachable" in err_msg.lower() or "refused" in err_msg.lower() or "Connection" in err_msg:
                response_text += " If the API runs in Docker and the model (e.g. Ollama) is on your host, set the model's Endpoint URL to http://host.docker.internal:11434 (Mac/Windows) or add OLLAMA_DEFAULT_URL=http://host.docker.internal:11434 to the app environment."
            if "429" in err_msg or "Too Many Requests" in err_msg:
                response_text += " Rate limit exceeded; wait a moment or reduce request frequency. Retrieved context is still shown below."
        return response_text, citations
    finally:
        db.close()
