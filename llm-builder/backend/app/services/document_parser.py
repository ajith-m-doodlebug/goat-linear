"""Parse documents and chunk text. Used by ingest worker."""
import re
from pathlib import Path

# Strategy IDs and default params for API/docs
CHUNK_STRATEGIES = ["fixed", "paragraph", "sentence", "recursive"]
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 50
DEFAULT_STRATEGY = "fixed"


def _chunk_fixed(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by character (approx tokens), break at sentence/newline/space."""
    if not text or not text.strip():
        return []
    text = text.strip()
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if end < len(text):
            last_period = chunk.rfind(". ")
            last_newline = chunk.rfind("\n")
            last_space = chunk.rfind(" ")
            break_at = max(last_period, last_newline, last_space)
            if break_at > chunk_size // 2:
                chunk = chunk[: break_at + 1]
                end = start + break_at + 1
        chunks.append(chunk.strip())
        start = end - overlap if overlap < chunk_size else end
    return [c for c in chunks if c]


def _chunk_paragraph(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split on double newline, merge paragraphs up to chunk_size with overlap."""
    if not text or not text.strip():
        return []
    text = text.strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return _chunk_fixed(text, chunk_size, overlap)
    chunks = []
    current = []
    current_len = 0
    for i, p in enumerate(paragraphs):
        add_len = len(p) + 2
        if current_len + add_len > chunk_size and current:
            chunks.append("\n\n".join(current))
            if overlap > 0 and current:
                # keep last paragraph(s) for overlap
                overlap_len = 0
                keep = []
                for j in range(len(current) - 1, -1, -1):
                    overlap_len += len(current[j]) + 2
                    keep.insert(0, current[j])
                    if overlap_len >= overlap:
                        break
                current = keep
                current_len = sum(len(x) for x in current) + 2 * (len(current) - 1)
            else:
                current = []
                current_len = 0
        current.append(p)
        current_len += add_len if current_len else len(p)
    if current:
        chunks.append("\n\n".join(current))
    return [c for c in chunks if c]


def _chunk_sentence(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split into sentences, then group sentences into chunks of ~chunk_size chars with overlap."""
    if not text or not text.strip():
        return []
    text = text.strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return _chunk_fixed(text, chunk_size, overlap)
    chunks = []
    current = []
    current_len = 0
    for i, s in enumerate(sentences):
        add_len = len(s) + 1
        if current_len + add_len > chunk_size and current:
            chunk = " ".join(current)
            chunks.append(chunk)
            if overlap > 0 and current:
                overlap_len = 0
                keep = []
                for j in range(len(current) - 1, -1, -1):
                    overlap_len += len(current[j]) + 1
                    keep.insert(0, current[j])
                    if overlap_len >= overlap:
                        break
                current = keep
                current_len = sum(len(x) for x in current) + (len(current) - 1)
            else:
                current = []
                current_len = 0
        current.append(s)
        current_len += add_len if current_len else len(s)
    if current:
        chunks.append(" ".join(current))
    return [c for c in chunks if c]


def _chunk_recursive(text: str, chunk_size: int = 512, overlap: int = 50, separators: list[str] | None = None) -> list[str]:
    """Recursive split: try separators in order, then recurse on oversized segments."""
    if not text or not text.strip():
        return []
    text = text.strip()
    if separators is None:
        separators = ["\n\n", "\n", ". ", " "]
    if chunk_size <= 0:
        chunk_size = DEFAULT_CHUNK_SIZE

    def _split(s: str, sep_list: list[str]) -> list[str]:
        if len(s) <= chunk_size:
            return [s] if s.strip() else []
        if not sep_list:
            return [s[i : i + chunk_size] for i in range(0, len(s), chunk_size - overlap)]
        sep = sep_list[0]
        parts = s.split(sep)
        if len(parts) == 1:
            return _split(s, sep_list[1:])
        out = []
        current = ""
        for i, p in enumerate(parts):
            add = p + (sep if i < len(parts) - 1 else "")
            if len(current) + len(add) <= chunk_size:
                current += add
            else:
                if current.strip():
                    out.append(current.strip())
                if len(add) > chunk_size:
                    out.extend(_split(add, sep_list[1:]))
                    current = ""
                else:
                    current = add
        if current.strip():
            out.append(current.strip())
        return out

    return [c for c in _split(text, separators) if c]


def chunk_text(
    text: str,
    strategy: str = "fixed",
    chunk_size: int | None = None,
    overlap: int | None = None,
    **kwargs,
) -> list[str]:
    """
    Split text into chunks. strategy: fixed, paragraph, sentence, recursive.
    chunk_size/overlap: for fixed/paragraph/recursive in characters; for sentence, chunk_size = number of sentences.
    """
    if not text or not text.strip():
        return []
    strategy = (strategy or DEFAULT_STRATEGY).lower()
    if strategy not in CHUNK_STRATEGIES:
        strategy = DEFAULT_STRATEGY
    size = chunk_size if chunk_size is not None else DEFAULT_CHUNK_SIZE
    ov = overlap if overlap is not None else DEFAULT_CHUNK_OVERLAP

    if strategy == "fixed":
        return _chunk_fixed(text, size, ov)
    if strategy == "paragraph":
        return _chunk_paragraph(text, size, ov)
    if strategy == "sentence":
        return _chunk_sentence(text, size, ov)
    if strategy == "recursive":
        return _chunk_recursive(text, size, ov, kwargs.get("separators"))
    return _chunk_fixed(text, size, ov)


def extract_text_from_file(file_path: str) -> str:
    """Extract raw text from file based on extension."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="replace")
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception:
            return ""
    if suffix in (".docx", ".doc"):
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            return ""
    if suffix in (".html", ".htm"):
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "html.parser")
            return soup.get_text(separator="\n", strip=True)
        except Exception:
            return path.read_text(encoding="utf-8", errors="replace")
    return path.read_text(encoding="utf-8", errors="replace")
