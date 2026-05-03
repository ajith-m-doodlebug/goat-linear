"""Unified LLM client: Ollama, vLLM (OpenAI-compatible), OpenAI, custom REST."""
from concurrent.futures import ThreadPoolExecutor

import httpx
from app.core.config import get_settings
from app.models.model_registry import ModelRegistry
from app.services.vllm_hosting import vllm_endpoint_connect_base

# OpenAI-compatible HTTP; colocated Docker hairpin fix applies to self-hosted engines only.
_OPENAI_COMPAT_PROVIDERS = frozenset({"vllm", "ragline_self_hosted", "openai", "custom"})
_SELF_HOSTED_OPENAI_COMPAT = frozenset({"vllm", "ragline_self_hosted"})


def _openai_compat_server_base(model: ModelRegistry, endpoint_url: str | None) -> str | None:
    if model.provider in _SELF_HOSTED_OPENAI_COMPAT:
        return vllm_endpoint_connect_base(endpoint_url) or endpoint_url
    return endpoint_url


def _ragline_multiplex_connect_base(registry_endpoint_url: str | None) -> str:
    """Same HTTP base as the Models page test and curl: registered Endpoint URL → ingress /v1 multiplex."""
    raw = (registry_endpoint_url or "").strip().rstrip("/")
    if not raw:
        raise RuntimeError(
            "ragline_self_hosted requires Endpoint URL (e.g. http://YOUR_HOST:8005), matching the Models page."
        )
    return (vllm_endpoint_connect_base(raw) or raw).rstrip("/")


def _ragline_complete_via_registry_threaded(
    make_call,
    registry_endpoint_url: str | None,
    *,
    timeout_s: float = 600.0,
):
    """POST /v1/chat/completions on the multiplex URL from a worker thread (avoids single-worker deadlock)."""
    bu = _ragline_multiplex_connect_base(registry_endpoint_url)

    def run():
        return make_call(bu)

    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(run).result(timeout=timeout_s)


def _ollama_default_url() -> str:
    return get_settings().ollama_default_url


def _openai_compat_thinking_payload(kwargs: dict) -> dict:
    """Force disable thinking across OpenAI-compatible providers."""
    chat_template_kwargs = kwargs.get("chat_template_kwargs") or {}
    if not isinstance(chat_template_kwargs, dict):
        chat_template_kwargs = {}
    chat_template_kwargs = dict(chat_template_kwargs)
    chat_template_kwargs["enable_thinking"] = False
    return {
        "enable_thinking": False,
        "chat_template_kwargs": chat_template_kwargs,
    }


def _ollama_complete(model_id: str, prompt: str, base_url: str, **kwargs) -> str:
    url = (base_url or _ollama_default_url()).rstrip("/") + "/api/generate"
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            url,
            json={"model": model_id, "prompt": prompt, "stream": False},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("response", "")


def _openai_chat_url(base_url: str | None) -> str:
    base = (base_url or "https://api.openai.com").rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return base + "/chat/completions"
    return base + "/v1/chat/completions"


def _openai_complete(model_id: str, prompt: str, base_url: str, api_key: str | None, **kwargs) -> str:
    url = _openai_chat_url(base_url)
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            url,
            headers=headers,
            json={
                "model": model_id,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": kwargs.get("max_tokens", 1024),
                "temperature": kwargs.get("temperature", 0.7),
                **_openai_compat_thinking_payload(kwargs),
            },
        )
        r.raise_for_status()
        data = r.json()
        choice = data.get("choices", [{}])[0]
        return choice.get("message", {}).get("content", "")


def _openai_complete_with_images(
    model_id: str,
    prompt: str,
    base_url: str,
    api_key: str | None,
    images: list[dict],
    **kwargs,
) -> str:
    """images: [{media_type, data}] base64 without data URL prefix."""
    content: list[dict] = [{"type": "text", "text": prompt}]
    for im in images:
        mt = im.get("media_type") or "image/png"
        b64 = im.get("data") or ""
        content.append(
            {"type": "image_url", "image_url": {"url": f"data:{mt};base64,{b64}"}}
        )
    url = _openai_chat_url(base_url)
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    with httpx.Client(timeout=180.0) as client:
        r = client.post(
            url,
            headers=headers,
            json={
                "model": model_id,
                "messages": [{"role": "user", "content": content}],
                "max_tokens": kwargs.get("max_tokens", 1024),
                "temperature": kwargs.get("temperature", 0.7),
                **_openai_compat_thinking_payload(kwargs),
            },
        )
        r.raise_for_status()
        data = r.json()
        choice = data.get("choices", [{}])[0]
        return choice.get("message", {}).get("content", "") or ""


def _anthropic_complete(model_id: str, prompt: str, base_url: str, api_key: str | None, **kwargs) -> str:
    """Anthropic Messages API: POST /v1/messages. Requires api_key."""
    if not api_key:
        raise ValueError("Anthropic provider requires an API key")
    url = (base_url or "https://api.anthropic.com").rstrip("/") + "/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            url,
            headers=headers,
            json={
                "model": model_id,
                "max_tokens": kwargs.get("max_tokens", 1024),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": kwargs.get("temperature", 0.7),
            },
        )
        r.raise_for_status()
        data = r.json()
        content = data.get("content", [])
        text_parts = [b.get("text", "") for b in content if b.get("type") == "text"]
        return "".join(text_parts)


def _anthropic_complete_with_images(
    model_id: str,
    prompt: str,
    base_url: str,
    api_key: str | None,
    images: list[dict],
    **kwargs,
) -> str:
    if not api_key:
        raise ValueError("Anthropic provider requires an API key")
    blocks: list[dict] = []
    for im in images:
        mt = im.get("media_type") or "image/png"
        b64 = im.get("data") or ""
        blocks.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": mt, "data": b64},
            }
        )
    blocks.append({"type": "text", "text": prompt})
    url = (base_url or "https://api.anthropic.com").rstrip("/") + "/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    with httpx.Client(timeout=180.0) as client:
        r = client.post(
            url,
            headers=headers,
            json={
                "model": model_id,
                "max_tokens": kwargs.get("max_tokens", 1024),
                "messages": [{"role": "user", "content": blocks}],
                "temperature": kwargs.get("temperature", 0.7),
            },
        )
        r.raise_for_status()
        data = r.json()
        content = data.get("content", [])
        text_parts = [b.get("text", "") for b in content if b.get("type") == "text"]
        return "".join(text_parts)


def _ollama_chat_with_images(
    model_id: str,
    prompt: str,
    images_b64: list[str],
    base_url: str,
    **kwargs,
) -> str:
    url = (base_url or _ollama_default_url()).rstrip("/") + "/api/chat"
    with httpx.Client(timeout=180.0) as client:
        r = client.post(
            url,
            json={
                "model": model_id,
                "messages": [{"role": "user", "content": prompt, "images": images_b64}],
                "stream": False,
            },
        )
        r.raise_for_status()
        data = r.json()
        msg = data.get("message") or {}
        return msg.get("content", "") or ""


def complete(model: ModelRegistry, prompt: str, **extra_config) -> str:
    base_url = model.endpoint_url or None
    api_key = model.api_key_encrypted
    model_id = model.model_id
    config = model.config or {}
    config.update(extra_config)

    if model.provider == "ollama":
        return _ollama_complete(model_id, prompt, base_url or _ollama_default_url(), **config)
    if model.provider == "anthropic":
        return _anthropic_complete(model_id, prompt, base_url or "https://api.anthropic.com", api_key, **config)
    if model.provider in _OPENAI_COMPAT_PROVIDERS:
        if model.provider == "ragline_self_hosted":

            def _call(bu: str):
                return _openai_complete(model_id, prompt, bu, api_key, **config)

            return _ragline_complete_via_registry_threaded(_call, base_url)
        bu = (
            _openai_compat_server_base(model, base_url)
            if model.provider in _SELF_HOSTED_OPENAI_COMPAT
            else base_url
        )
        return _openai_complete(model_id, prompt, bu, api_key, **config)
    raise ValueError(f"Unsupported provider: {model.provider}")


def complete_with_images(model: ModelRegistry, prompt: str, images: list[dict], **extra_config) -> str:
    if not images:
        return complete(model, prompt, **extra_config)
    base_url = model.endpoint_url or None
    api_key = model.api_key_encrypted
    model_id = model.model_id
    config = model.config or {}
    config.update(extra_config)
    imgs_b64 = [im.get("data", "") for im in images]

    if model.provider == "ollama":
        return _ollama_chat_with_images(
            model_id, prompt, imgs_b64, base_url or _ollama_default_url(), **config
        )
    if model.provider == "anthropic":
        return _anthropic_complete_with_images(
            model_id, prompt, base_url or "https://api.anthropic.com", api_key, images, **config
        )
    if model.provider in _OPENAI_COMPAT_PROVIDERS:
        if model.provider == "ragline_self_hosted":

            def _call(bu: str):
                return _openai_complete_with_images(model_id, prompt, bu, api_key, images, **config)

            return _ragline_complete_via_registry_threaded(_call, base_url)
        bu = (
            _openai_compat_server_base(model, base_url)
            if model.provider in _SELF_HOSTED_OPENAI_COMPAT
            else base_url
        )
        return _openai_complete_with_images(model_id, prompt, bu, api_key, images, **config)
    raise ValueError(f"Unsupported provider: {model.provider}")


def complete_from_frozen_config(model_config: dict, prompt: str, **extra_config) -> str:
    import os
    provider = (model_config.get("provider") or "").lower()
    base_url = (model_config.get("endpoint_url") or "").strip().rstrip("/") or None
    model_id = model_config.get("model_id") or "gpt-3.5-turbo"
    api_key = model_config.get("_api_key")
    if api_key is None and provider in ("openai", "custom"):
        api_key_env = model_config.get("api_key_env") or "API_KEY"
        api_key = os.environ.get(api_key_env)
    raw_ex = model_config.get("extra") or {}
    extra = dict(raw_ex) if isinstance(raw_ex, dict) else {}
    extra.update(extra_config)

    if provider == "ollama":
        return _ollama_complete(model_id, prompt, base_url or _ollama_default_url(), **extra)
    if provider == "anthropic":
        api_key = api_key or os.environ.get(model_config.get("api_key_env") or "ANTHROPIC_API_KEY")
        return _anthropic_complete(model_id, prompt, base_url or "https://api.anthropic.com", api_key, **extra)
    if provider in _OPENAI_COMPAT_PROVIDERS:
        if provider == "ragline_self_hosted":

            def _call(bu: str):
                return _openai_complete(model_id, prompt, bu, api_key, **extra)

            return _ragline_complete_via_registry_threaded(_call, base_url)
        bu = (
            vllm_endpoint_connect_base(base_url) or base_url
            if provider in _SELF_HOSTED_OPENAI_COMPAT
            else base_url
        )
        return _openai_complete(model_id, prompt, bu, api_key, **extra)
    raise ValueError(f"Unsupported provider: {provider}")


def complete_from_frozen_config_with_images(
    model_config: dict, prompt: str, images: list[dict], **extra_config
) -> str:
    import os

    if not images:
        return complete_from_frozen_config(model_config, prompt, **extra_config)
    provider = (model_config.get("provider") or "").lower()
    base_url = (model_config.get("endpoint_url") or "").strip().rstrip("/") or None
    model_id = model_config.get("model_id") or "gpt-3.5-turbo"
    api_key = model_config.get("_api_key")
    if api_key is None and provider in ("openai", "custom"):
        api_key_env = model_config.get("api_key_env") or "API_KEY"
        api_key = os.environ.get(api_key_env)
    raw_ex = model_config.get("extra") or {}
    extra = dict(raw_ex) if isinstance(raw_ex, dict) else {}
    extra.update(extra_config)
    imgs_b64 = [im.get("data", "") for im in images]

    if provider == "ollama":
        return _ollama_chat_with_images(
            model_id, prompt, imgs_b64, base_url or _ollama_default_url(), **extra
        )
    if provider == "anthropic":
        api_key = api_key or os.environ.get(model_config.get("api_key_env") or "ANTHROPIC_API_KEY")
        return _anthropic_complete_with_images(
            model_id, prompt, base_url or "https://api.anthropic.com", api_key, images, **extra
        )
    if provider in _OPENAI_COMPAT_PROVIDERS:
        if provider == "ragline_self_hosted":

            def _call(bu: str):
                return _openai_complete_with_images(model_id, prompt, bu, api_key, images, **extra)

            return _ragline_complete_via_registry_threaded(_call, base_url)
        bu = (
            vllm_endpoint_connect_base(base_url) or base_url
            if provider in _SELF_HOSTED_OPENAI_COMPAT
            else base_url
        )
        return _openai_complete_with_images(model_id, prompt, bu, api_key, images, **extra)
    raise ValueError(f"Unsupported provider: {provider}")


def health_check(model: ModelRegistry) -> bool:
    if model.provider == "ollama":
        url = (model.endpoint_url or _ollama_default_url()).rstrip("/") + "/api/tags"
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.get(url)
                return r.status_code == 200
        except Exception:
            return False
    if model.provider == "anthropic":
        return bool((model.endpoint_url or "https://api.anthropic.com").strip() and model.api_key_encrypted)
    if model.provider in _OPENAI_COMPAT_PROVIDERS and model.endpoint_url:
        try:
            raw = model.endpoint_url.rstrip("/")
            if model.provider in _SELF_HOSTED_OPENAI_COMPAT:
                base = (_openai_compat_server_base(model, model.endpoint_url) or raw).rstrip("/")
            else:
                base = raw
            # /health on the public port may be RAGLine (ingress); vLLM always exposes GET /v1/models.
            probe = f"{base}/v1/models" if model.provider in _SELF_HOSTED_OPENAI_COMPAT else base
            with httpx.Client(timeout=5.0) as client:
                r = client.get(probe)
                return r.status_code in (200, 404, 405)
        except Exception:
            return False
    return True
