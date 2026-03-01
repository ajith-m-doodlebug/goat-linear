"""Parse documentation zips (e.g. Docusaurus-style markdown) into page-level chunks with hierarchy metadata."""
import json
import re
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

# Page-level chunking: one chunk per file so "Explain types of X" returns the full page.
# If a file exceeds this size, split at ## boundaries into consecutive parts (same source_path).
MAX_PAGE_CHARS = 8000

# Directories to skip when walking the zip
SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv"}


def _strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter (lines between --- at start)."""
    if not content.strip().startswith("---"):
        return content
    lines = content.split("\n")
    end = 0
    for i, line in enumerate(lines):
        if i > 0 and line.strip() == "---":
            end = i + 1
            break
    return "\n".join(lines[end:]).strip()


def _slug_to_label(slug: str) -> str:
    """Turn a path segment or filename into a readable label (e.g. add-circuit -> Add circuit)."""
    base = Path(slug).stem if "." in slug else slug
    return base.replace("-", " ").replace("_", " ").strip().title() or base


def _load_category_labels(root: Path, relative_path: str) -> dict[str, str]:
    """
    Load _category_.json from each parent directory of relative_path.
    Returns mapping from dir path (e.g. 'docs/Projects') to label (e.g. 'Projects').
    """
    labels = {}
    parts = Path(relative_path).parent.parts
    for i in range(len(parts) + 1):
        sub = Path(*parts[:i])
        if not sub.parts:
            continue
        cat_file = root / sub / "_category_.json"
        if cat_file.is_file():
            try:
                data = json.loads(cat_file.read_text(encoding="utf-8", errors="replace"))
                if isinstance(data, dict) and data.get("label"):
                    labels[str(sub)] = str(data["label"])
            except (json.JSONDecodeError, OSError):
                pass
    return labels


def _breadcrumb_for_path(root: Path, relative_path: str, category_labels: dict[str, str]) -> str:
    """Build human-readable breadcrumb from path and category labels."""
    path_obj = Path(relative_path)
    parts = path_obj.parent.parts
    labels = []
    for i in range(len(parts) + 1):
        sub = Path(*parts[:i]) if parts else Path(".")
        sub_str = str(sub) if sub.parts else ""
        if sub_str in category_labels:
            labels.append(category_labels[sub_str])
        elif sub.parts:
            labels.append(_slug_to_label(parts[i - 1]))
    file_label = _slug_to_label(path_obj.name)
    if file_label and (not labels or labels[-1] != file_label):
        labels.append(file_label)
    return " / ".join(labels) if labels else relative_path


def _first_heading(content: str) -> str | None:
    """Return the first markdown heading line text (e.g. 'Measurements') or None."""
    m = re.search(r"^#{1,6}\s+(.+)$", content.strip(), re.MULTILINE)
    return m.group(1).strip() if m else None


def _split_file_into_parts(content: str, max_chars: int) -> list[str]:
    """
    Split file content into one or more parts, each under max_chars.
    Splits at ## boundaries so parts are meaningful (e.g. intro+Transient, then AC, then DC).
    """
    content = content.strip()
    if not content:
        return []
    if len(content) <= max_chars:
        return [content]
    # Split by ## (second-level headings) so we keep "page" structure; capture heading line only
    parts = re.split(r"(\n##\s+[^\n]+)", content)
    # parts is [intro, "\n## Transient...", body1, "\n## AC...", body2, ...]; rejoin intro+delim+body for each section
    segments: list[str] = []
    current = ""
    i = 0
    while i < len(parts):
        seg = parts[i]
        if re.match(r"^\n##\s+", seg):
            if current.strip():
                segments.append(current.strip())
            current = seg
            i += 1
            if i < len(parts):
                current += parts[i]
                i += 1
        else:
            current += seg
            i += 1
    if current.strip():
        segments.append(current.strip())
    if not segments:
        return [content[:max_chars]] if content else []
    # Merge segments into chunks under max_chars
    out: list[str] = []
    acc = ""
    for s in segments:
        if len(acc) + len(s) + 2 <= max_chars:
            acc = f"{acc}\n\n{s}".strip() if acc else s
        else:
            if acc:
                out.append(acc)
            if len(s) <= max_chars:
                acc = s
            else:
                out.append(s[:max_chars])
                acc = ""
    if acc:
        out.append(acc)
    return out


def _chunk_documentation_file(
    content: str,
    relative_path: str,
    root: Path,
    category_labels: dict[str, str],
) -> list[tuple[str, dict]]:
    """
    One chunk per file (page-level) so retrieval returns the full page.
    If file exceeds MAX_PAGE_CHARS, split at ## into 2+ parts with same source_path.
    Metadata: source_path, breadcrumb, heading (first # title), section_index (0,1,2 for parts).
    """
    content = _strip_frontmatter(content)
    if not content.strip():
        return []
    breadcrumb = _breadcrumb_for_path(root, relative_path, category_labels)
    first_heading = _first_heading(content)
    parts = _split_file_into_parts(content, MAX_PAGE_CHARS)
    total = len(parts)
    out: list[tuple[str, dict]] = []
    for idx, part_text in enumerate(parts):
        if not part_text.strip():
            continue
        meta = {
            "source_path": relative_path,
            "breadcrumb": breadcrumb,
            "heading": first_heading or _slug_to_label(Path(relative_path).name),
            "section_index": idx,
            "total_sections_in_file": total,
        }
        out.append((part_text.strip(), meta))
    return out


def extract_documentation_from_zip(zip_path: str) -> list[tuple[str, dict]]:
    """
    Unzip and extract all .md (and .mdx) files into page-level chunks with metadata.
    One chunk per file (or 2+ if file exceeds MAX_PAGE_CHARS, split at ##).
    Returns list of (chunk_text, metadata) ordered by (relative_path, section_index).
    metadata: source_path, breadcrumb, heading, section_index, total_sections_in_file.
    """
    all_chunks: list[tuple[str, list[tuple[str, dict]]]] = []
    with TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        with zipfile.ZipFile(zip_path, "r") as zf:
            for name in zf.namelist():
                name_posix = Path(name).as_posix()
                if name_posix.endswith("/"):
                    continue
                path = Path(name_posix)
                if any(part in SKIP_DIRS for part in path.parts):
                    continue
                if path.suffix.lower() not in (".md", ".mdx"):
                    continue
                try:
                    zf.extract(name, tmpdir)
                except Exception:
                    continue
                full = root / name_posix
                if not full.is_file():
                    continue
                try:
                    content = full.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue
                rel = name_posix
                category_labels = _load_category_labels(root, rel)
                file_chunks = _chunk_documentation_file(content, rel, root, category_labels)
                if file_chunks:
                    all_chunks.append((rel, file_chunks))
        # Sort by path then section order (already in order per file)
        all_chunks.sort(key=lambda x: x[0])
    result: list[tuple[str, dict]] = []
    for _, chunks in all_chunks:
        result.extend(chunks)
    return result
