"""Unified LLM client: Ollama, vLLM (OpenAI-compatible), OpenAI, custom REST."""
import httpx
from app.models.model_registry import ModelRegistry

OLLAMA_DEFAULT_URL = "http://localhost:11434"


def _ollama_complete(model_id: str, prompt: str, base_url: str, **kwargs) -> str:
    url = (base_url or OLLAMA_DEFAULT_URL).rstrip("/") + "/api/generate"
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            url,
            json={"model": model_id, "prompt": prompt, "stream": False},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("response", "")


def _openai_complete(model_id: str, prompt: str, base_url: str, api_key: str | None, **kwargs) -> str:
    url = (base_url or "https://api.openai.com").rstrip("/") + "/v1/chat/completions"
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


def complete(model: ModelRegistry, prompt: str, **extra_config) -> str:
    """Run completion for the given registered model. Returns generated text."""
    base_url = model.endpoint_url or None
    api_key = model.api_key_encrypted  # stored in plain for now; can encrypt later
    model_id = model.model_id
    config = model.config or {}
    config.update(extra_config)

    if model.provider == "ollama":
        return _ollama_complete(model_id, prompt, base_url or OLLAMA_DEFAULT_URL, **config)
    if model.provider in ("vllm", "openai", "custom"):
        return _openai_complete(model_id, prompt, base_url, api_key, **config)
    raise ValueError(f"Unsupported provider: {model.provider}")


def health_check(model: ModelRegistry) -> bool:
    """Check if the model endpoint is reachable."""
    if model.provider == "ollama":
        url = (model.endpoint_url or OLLAMA_DEFAULT_URL).rstrip("/") + "/api/tags"
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.get(url)
                return r.status_code == 200
        except Exception:
            return False
    if model.provider in ("vllm", "openai", "custom") and model.endpoint_url:
        try:
            base = model.endpoint_url.rstrip("/")
            with httpx.Client(timeout=5.0) as client:
                r = client.get(base + "/health" if "vllm" in base or "localhost" in base else base)
                return r.status_code in (200, 404, 405)
        except Exception:
            return False
    return True
