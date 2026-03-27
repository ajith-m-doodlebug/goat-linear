"""Unified LLM client: Ollama, vLLM (OpenAI-compatible), OpenAI, custom REST."""
import httpx
from app.core.config import get_settings
from app.models.model_registry import ModelRegistry


def _ollama_default_url() -> str:
    return get_settings().ollama_default_url


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
    return (base_url or "https://api.openai.com").rstrip("/") + "/v1/chat/completions"


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
    """Run completion for the given registered model. Returns generated text."""
    base_url = model.endpoint_url or None
    api_key = model.api_key_encrypted  # stored in plain for now; can encrypt later
    model_id = model.model_id
    config = model.config or {}
    config.update(extra_config)

    if model.provider == "ollama":
        return _ollama_complete(model_id, prompt, base_url or _ollama_default_url(), **config)
    if model.provider == "anthropic":
        return _anthropic_complete(model_id, prompt, base_url or "https://api.anthropic.com", api_key, **config)
    if model.provider in ("vllm", "openai", "custom"):
        return _openai_complete(model_id, prompt, base_url, api_key, **config)
    raise ValueError(f"Unsupported provider: {model.provider}")


def complete_with_images(model: ModelRegistry, prompt: str, images: list[dict], **extra_config) -> str:
    """Multimodal completion. images: [{media_type, data}] from chat_attachments validation."""
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
    if model.provider in ("vllm", "openai", "custom"):
        return _openai_complete_with_images(model_id, prompt, base_url, api_key, images, **config)
    raise ValueError(f"Unsupported provider: {model.provider}")


def complete_from_frozen_config(model_config: dict, prompt: str, **extra_config) -> str:
    """
    Run completion using a frozen model config (e.g. from hosted deployment).
    model_config must have: provider, endpoint_url, model_id; optional: _api_key or api_key_env for OpenAI-style.
    """
    import os
    provider = (model_config.get("provider") or "").lower()
    base_url = (model_config.get("endpoint_url") or "").strip().rstrip("/") or None
    model_id = model_config.get("model_id") or "gpt-3.5-turbo"
    api_key = model_config.get("_api_key")  # in-process: we store it in frozen config
    if api_key is None and provider in ("openai", "custom"):
        api_key_env = model_config.get("api_key_env") or "API_KEY"
        api_key = os.environ.get(api_key_env)
    extra = model_config.get("extra") or {}
    extra.update(extra_config)

    if provider == "ollama":
        return _ollama_complete(model_id, prompt, base_url or _ollama_default_url(), **extra)
    if provider == "anthropic":
        api_key = api_key or os.environ.get(model_config.get("api_key_env") or "ANTHROPIC_API_KEY")
        return _anthropic_complete(model_id, prompt, base_url or "https://api.anthropic.com", api_key, **extra)
    if provider in ("vllm", "openai", "custom"):
        if base_url and not base_url.endswith("/v1"):
            base_url = base_url + "/v1"
        if not base_url and provider == "ollama":
            base_url = "http://localhost:11434/v1"
        return _openai_complete(model_id, prompt, base_url, api_key, **extra)
    raise ValueError(f"Unsupported provider: {provider}")


def complete_from_frozen_config_with_images(
    model_config: dict, prompt: str, images: list[dict], **extra_config
) -> str:
    """Frozen config multimodal path for hosted RAG."""
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
    extra = model_config.get("extra") or {}
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
    if provider in ("vllm", "openai", "custom"):
        bu = base_url
        if bu and not bu.endswith("/v1"):
            bu = bu + "/v1"
        if not bu and provider == "ollama":
            bu = "http://localhost:11434/v1"
        return _openai_complete_with_images(model_id, prompt, bu, api_key, images, **extra)
    raise ValueError(f"Unsupported provider: {provider}")


def health_check(model: ModelRegistry) -> bool:
    """Check if the model endpoint is reachable."""
    if model.provider == "ollama":
        url = (model.endpoint_url or _ollama_default_url()).rstrip("/") + "/api/tags"
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.get(url)
                return r.status_code == 200
        except Exception:
            return False
    if model.provider == "anthropic":
        # No public health endpoint; consider reachable if endpoint and key are set
        return bool((model.endpoint_url or "https://api.anthropic.com").strip() and model.api_key_encrypted)
    if model.provider in ("vllm", "openai", "custom") and model.endpoint_url:
        try:
            base = model.endpoint_url.rstrip("/")
            with httpx.Client(timeout=5.0) as client:
                r = client.get(base + "/health" if "vllm" in base or "localhost" in base else base)
                return r.status_code in (200, 404, 405)
        except Exception:
            return False
    return True
