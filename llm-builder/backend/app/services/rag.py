"""RAG: hybrid retrieval (semantic + keyword), then LLM. Best-practice pipeline."""
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.db.base import SessionLocal
from app.models.deployment import Deployment
from app.models.knowledge_base import KnowledgeBase
from app.models.model_registry import ModelRegistry
from app.models.prompt_template import PromptTemplate
from app.services.qdrant_client import get_qdrant
from app.services.embedding_registry import encode_query as encode_query_with_model
from app.schemas.rag_config import resolve_embedding_for_kb
from app.services.llm_client import complete
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


def _scroll_all_keyword_matches(
    client,
    collection_name: str,
    keywords: set[str],
    seen_texts: set,
    min_keywords: int = 1,
) -> list:
    """Scroll collection; return points whose text contains at least min_keywords of the question keywords."""
    if not keywords:
        return []
    out = []
    offset = None
    scroll_limit = 100
    max_points = 2_000  # cap to avoid slow full scans; increase if KB is huge and you need more recall
    total = 0
    while total < max_points:
        points, next_offset = client.scroll(
            collection_name=collection_name,
            offset=offset,
            limit=scroll_limit,
            with_payload=True,
            with_vectors=False,
        )
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


def _cap_and_rank_keyword_matches(keyword_scored: list, cap: int) -> list:
    """Sort by number of keyword matches (desc), return at most cap (n_matched, point) pairs."""
    if not keyword_scored:
        return []
    keyword_scored.sort(key=lambda x: -x[0])
    return keyword_scored[:cap]


def _keyword_retrieval(client, collection_name: str, keywords: set, keyword_top_k: int) -> list:
    """Run keyword scroll + cap/rank. Used in parallel with vector retrieval."""
    seen_texts = set()
    keyword_scored = _scroll_all_keyword_matches(
        client, collection_name, keywords, seen_texts, min_keywords=MIN_KEYWORDS_REQUIRED
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
) -> list:
    """Run embedding + vector search + keyword re-rank. Used in parallel with keyword retrieval."""
    vector = encode_query_with_model(question, model_id=embedding_model, query_prefix=embedding_query_prefix)
    raw = client.search(
        collection_name=collection_name,
        query_vector=vector,
        limit=fetch,
        with_payload=True,
    )
    return _rerank_with_keyword_boost(raw, question, top_k)


def _merge_and_take_top_k(
    keyword_scored: list,
    vector_results: list,
    keywords: set[str],
    top_k: int,
) -> tuple[list[str], list[dict]]:
    """
    Merge keyword and vector chunks; dedupe by text. Sort by (n_matched desc, score desc)
    so chunks that match more question keywords always rank higher (e.g. CCCS+instance+parameters
    beats generic "instance parameters"). Return top_k chunks.
    """
    # text -> (n_matched, score, source)
    best = {}
    for n_matched, point in keyword_scored:
        text = (point.payload or {}).get("text", "")
        source = (point.payload or {}).get("source", "")
        if not text:
            continue
        score = 0.5 + 0.2 * n_matched
        prev = best.get(text)
        if prev is None or (n_matched > prev[0]) or (n_matched == prev[0] and score > prev[1]):
            best[text] = (n_matched, score, source)
    for r in vector_results:
        text = (r.payload or {}).get("text", "")
        source = (r.payload or {}).get("source", "")
        if not text:
            continue
        n_matched = _count_keyword_matches(text, keywords) if keywords else 0
        score = r.score + 0.25 * n_matched
        prev = best.get(text)
        if prev is None or (n_matched > prev[0]) or (n_matched == prev[0] and score > prev[1]):
            best[text] = (n_matched, score, source)
    # Sort by more keyword matches first, then by score
    ordered = sorted(best.items(), key=lambda x: (-x[1][0], -x[1][1]))[:top_k]
    context_parts = [text for text, _ in ordered]
    citations = [
        {"text": text, "source": source, "score": score}
        for text, (_, score, source) in ordered
    ]
    return context_parts, citations


def run_rag(
    deployment_id: str,
    question: str,
    chat_history: list[dict] | None = None,
) -> tuple[str, list[dict]]:
    """
    Hybrid RAG: (1) Keyword-first pass over full KB so no fact is missed.
    (2) Vector search + keyword re-rank for relevance. (3) Merge, dedupe, prompt, generate.
    """
    db = SessionLocal()
    try:
        dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not dep:
            raise ValueError("Deployment not found")
        model = db.query(ModelRegistry).filter(ModelRegistry.id == dep.model_id).first()
        if not model:
            raise ValueError("Model not found")

        context_parts = []
        citations = []

        if dep.knowledge_base_id:
            kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == dep.knowledge_base_id).first()
            if kb:
                config = dep.config or {}
                top_k = min(int(config.get("top_k", 10)), 20)
                emb = resolve_embedding_for_kb(kb.config)
                embedding_model = emb.get("embedding_model")
                embedding_query_prefix = emb.get("embedding_query_prefix")
                client = get_qdrant()
                keywords = question_keywords(question)
                keyword_top_k = min(KEYWORD_TOP_K_MAX, top_k * 2)

                keyword_scored = []
                vector_results = []
                fetch = min(top_k * 5, 150)
                try:
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
                    pass  # Keep keyword_scored and vector_results (possibly partial) for merge

                # 3) Merge both streams: dedupe by text, score, take top_k total (works with partial results)
                if keyword_scored or vector_results:
                    context_parts, citations = _merge_and_take_top_k(
                        keyword_scored,
                        vector_results,
                        keywords,
                        top_k,
                    )

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
            # Custom prompt: use the deployment's prompt template
            prompt = prompt_template.content.replace("{context}", context).replace("{question}", question)
            if "{memory}" in prompt_template.content:
                prompt = prompt.replace("{memory}", memory_block)
            else:
                prompt = memory_block + prompt
        else:
            # Default prompt when no custom template is set
            prompt = memory_block + DEFAULT_RAG_PROMPT.format(context=context, question=question)

        try:
            response_text = complete(model, prompt, **(dep.config or {}))
        except Exception as e:
            response_text = "Error generating response: " + str(e)
            # Keep existing citations so the user can see what context was retrieved
        return response_text, citations
    finally:
        db.close()
