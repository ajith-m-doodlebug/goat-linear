"""Validate and normalize chat image attachments (dashboard + hosted API)."""
import base64
import re

MAX_CHAT_IMAGES = 4
MAX_IMAGE_BYTES = 6 * 1024 * 1024
ALLOWED_MEDIA_TYPES = frozenset(
    {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}
)


def _normalize_media_type(mt: str) -> str:
    s = (mt or "").strip().lower()
    if s == "image/jpg":
        return "image/jpeg"
    return s


def validate_images_from_body(images: list | None) -> list[dict]:
    """
    Body shape: [{ "media_type": "image/png", "data": "<base64>" }].
    Returns normalized list [{ "type": "image", "media_type", "data" }].
    Raises ValueError with message suitable for HTTP 400.
    """
    if not images:
        return []
    if not isinstance(images, list):
        raise ValueError("images must be a list")
    if len(images) > MAX_CHAT_IMAGES:
        raise ValueError(f"At most {MAX_CHAT_IMAGES} images allowed")
    out: list[dict] = []
    for i, item in enumerate(images):
        if not isinstance(item, dict):
            raise ValueError(f"images[{i}] must be an object")
        mt = _normalize_media_type(str(item.get("media_type") or ""))
        if mt not in ALLOWED_MEDIA_TYPES:
            raise ValueError(f"Unsupported media_type for images[{i}]: {item.get('media_type')!r}")
        raw = item.get("data")
        if raw is None or not isinstance(raw, str) or not raw.strip():
            raise ValueError(f"images[{i}].data must be a non-empty base64 string")
        b64 = raw.strip()
        if b64.startswith("data:"):
            m = re.match(r"data:([^;]+);base64,(.+)", b64, re.DOTALL)
            if not m:
                raise ValueError(f"images[{i}]: invalid data URL")
            mt = _normalize_media_type(m.group(1))
            if mt not in ALLOWED_MEDIA_TYPES:
                raise ValueError(f"Unsupported image type in data URL: {m.group(1)!r}")
            b64 = m.group(2).strip()
        try:
            decoded = base64.b64decode(b64, validate=True)
        except Exception:
            raise ValueError(f"images[{i}]: invalid base64")
        if len(decoded) > MAX_IMAGE_BYTES:
            raise ValueError(f"images[{i}]: image exceeds {MAX_IMAGE_BYTES // (1024 * 1024)} MiB")
        out.append({"type": "image", "media_type": mt, "data": b64})
    return out


def extract_question_and_images_from_openai_content(
    content: str | list | None,
) -> tuple[str, list[dict]]:
    """
    Parse OpenAI-style message content (string or multimodal parts).
    Returns (joined text, normalized images [{type, media_type, data}]).
    """
    if content is None:
        return "", []
    if isinstance(content, str):
        return content.strip(), []
    if not isinstance(content, list):
        return "", []
    image_part_count = sum(
        1
        for p in content
        if isinstance(p, dict) and (p.get("type") or "").lower() == "image_url"
    )
    if image_part_count > MAX_CHAT_IMAGES:
        raise ValueError(f"At most {MAX_CHAT_IMAGES} images allowed")
    text_parts: list[str] = []
    images: list[dict] = []
    for part in content:
        if not isinstance(part, dict):
            continue
        ptype = (part.get("type") or "").lower()
        if ptype == "text":
            t = part.get("text")
            if isinstance(t, str) and t.strip():
                text_parts.append(t.strip())
        elif ptype == "image_url":
            iu = part.get("image_url")
            url = ""
            if isinstance(iu, dict):
                url = str(iu.get("url") or "")
            elif isinstance(iu, str):
                url = iu
            parsed = parse_data_url(url)
            if parsed and len(images) < MAX_CHAT_IMAGES:
                mt, b64 = parsed
                images.append({"type": "image", "media_type": mt, "data": b64})
    return (" ".join(text_parts).strip(), images)


def parse_data_url(url: str) -> tuple[str, str] | None:
    """Return (media_type, base64_data) for data:image/...;base64,... or None."""
    if not url or not isinstance(url, str):
        return None
    m = re.match(r"^data:([^;]+);base64,(.+)$", url.strip(), re.DOTALL)
    if not m:
        return None
    mt = _normalize_media_type(m.group(1))
    if mt not in ALLOWED_MEDIA_TYPES:
        return None
    b64 = m.group(2).strip()
    try:
        decoded = base64.b64decode(b64, validate=True)
    except Exception:
        return None
    if len(decoded) > MAX_IMAGE_BYTES:
        return None
    return mt, b64
