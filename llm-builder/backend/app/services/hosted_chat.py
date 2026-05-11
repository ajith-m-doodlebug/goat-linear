"""Run RAG + completion for a hosted deployment version (frozen config)."""
from concurrent.futures import ThreadPoolExecutor

from app.models.deployment_version import DeploymentVersion
from app.services.qdrant_client import get_qdrant
from app.services.llm_client import complete_from_frozen_config, complete_from_frozen_config_with_images
from app.services.rag import (
    DEFAULT_RAG_PROMPT,
    KEYWORD_TOP_K_MAX,
    _expand_context_with_same_file,
    _keyword_retrieval,
    _merge_and_take_top_k,
    _vector_retrieval,
)
from app.services.keywords import question_keywords


def run_hosted_rag(
    version: DeploymentVersion,
    question: str,
    chat_history: list[dict] | None = None,
    images: list[dict] | None = None,
) -> tuple[str, list[dict]]:
    """
    Run retrieval and LLM completion using the version's frozen config only.
    Uses frozen KB snapshot (hosted_<version_id>), frozen model, and frozen prompt.
    Same hybrid retrieval (keyword + vector, merge, re-rank) as the Chat page.
    chat_history: optional list of {"role": "user"|"assistant", "content": "..."} for memory.
    Returns (response_text, citations).
    """
    cfg = version.frozen_config or {}
    question = (question or "").strip()

    model_cfg = cfg.get("model") or {}
    retriever = cfg.get("retriever") or {}
    prompt_template = cfg.get("prompt") or DEFAULT_RAG_PROMPT
    top_k = min(int(retriever.get("top_k", 10)), 20)
    embedding_model = retriever.get("embedding_model") or "all-MiniLM-L6-v2"
    embedding_query_prefix = retriever.get("embedding_query_prefix") or ""
    if isinstance(embedding_query_prefix, str):
        embedding_query_prefix = embedding_query_prefix.strip() or None
    retriever_mode = retriever.get("mode") or "hybrid"
    has_kb = cfg.get("has_kb", False)
    collection_name = f"hosted_{version.id}"
    retrieval_mode = cfg.get("retrieval_mode") or "kb"

    context = "No relevant context found."
    citations: list[dict] = []

    if retrieval_mode == "intent":
        try:
            from app.services.intent_routing import build_intent_context_frozen

            context, citations = build_intent_context_frozen(cfg, question, collection_name)
        except Exception:
            context, citations = "No relevant context found.", []
    elif has_kb:
        try:
            client = get_qdrant()
            collections = client.get_collections().collections
            if not any(c.name == collection_name for c in collections):
                pass
            else:
                keywords = question_keywords(question) if retriever_mode == "hybrid" else set()
                keyword_top_k = min(KEYWORD_TOP_K_MAX, top_k * 2)
                fetch = min(top_k * 5, 150)
                keyword_scored = []
                vector_results = []
                if retriever_mode == "vector_only":
                    vector_results = _vector_retrieval(
                        client,
                        collection_name,
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
                            collection_name,
                            keywords,
                            keyword_top_k,
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
                        )
                        keyword_scored = fut_kw.result()
                        vector_results = fut_vec.result()
                if keyword_scored or vector_results:
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
                    context = "\n\n".join(context_parts)
        except Exception:
            pass

    memory_block = ""
    if chat_history:
        memory_block = "Previous conversation:\n" + "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')}" for m in chat_history[-20:]
        ) + "\n\n"

    if "{memory}" in prompt_template:
        prompt = (
            prompt_template.replace("{context}", context)
            .replace("{question}", question)
            .replace("{memory}", memory_block)
        )
    else:
        prompt = memory_block + prompt_template.replace("{context}", context).replace("{question}", question)

    try:
        extra = (cfg.get("model") or {}).get("extra") or {}
        if images:
            response_text = complete_from_frozen_config_with_images(model_cfg, prompt, images, **extra)
        else:
            response_text = complete_from_frozen_config(model_cfg, prompt, **extra)
    except Exception as e:
        response_text = "Error generating response: " + str(e)
    return response_text, citations
