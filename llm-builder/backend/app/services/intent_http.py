"""Safe HTTP execution for API-type knowledge documents."""
from __future__ import annotations

import ipaddress
import json
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings


def _host_allowed(host: str) -> bool:
    raw = (get_settings().ragline_http_allow_hosts or "").strip()
    if raw:
        suffixes = [s.strip().lower() for s in raw.split(",") if s.strip()]
        h = host.lower().rstrip(".")
        return any(h == s or h.endswith("." + s) for s in suffixes)
    try:
        infos = urlparse(f"http://{host}" if "://" not in host else host)
        hostname = infos.hostname or host
        addr_infos = __import__("socket").getaddrinfo(hostname, None)
        for fam, _, _, _, sockaddr in addr_infos:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return True
    except Exception:
        return False


def merge_body_template(template: str | None, override: dict | None) -> str | bytes | None:
    if not template and not override:
        return None
    if not template:
        return json.dumps(override)
    t = template.strip()
    try:
        if t.startswith("{") or t.startswith("["):
            base = json.loads(t)
            if isinstance(base, dict) and isinstance(override, dict):
                merged = {**base, **override}
                return json.dumps(merged)
    except json.JSONDecodeError:
        pass
    return template


def execute_api_document(
    method: str,
    url: str,
    headers: dict | None,
    body: str | bytes | None,
    *,
    timeout_s: float | None = None,
    max_bytes: int | None = None,
) -> tuple[bool, str]:
    settings = get_settings()
    timeout_s = timeout_s if timeout_s is not None else settings.ragline_retrieval_http_timeout_seconds
    max_bytes = max_bytes if max_bytes is not None else settings.ragline_retrieval_http_max_bytes
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False, "Only http/https URLs are allowed"
    host = parsed.hostname or ""
    if not host or not _host_allowed(host):
        return False, "Host is not allowed for retrieval (private IP or blocked)"

    m = (method or "GET").upper()
    hdrs = dict(headers or {})
    content: str | bytes | None = None
    if body is not None and m not in ("GET", "HEAD"):
        if isinstance(body, str):
            content = body
            if not hdrs.get("Content-Type") and body.strip().startswith("{"):
                hdrs["Content-Type"] = "application/json"
        else:
            content = body

    try:
        with httpx.Client(follow_redirects=False) as client:
            r = client.request(m, url, headers=hdrs, content=content, timeout=timeout_s)
        text = r.text
        if len(text.encode()) > max_bytes:
            text = text[: max_bytes // 2] + "\n...[truncated]"
        out = f"HTTP {r.status_code}\n{text}"
        return True, out
    except Exception as e:
        return False, str(e)[:4000]
