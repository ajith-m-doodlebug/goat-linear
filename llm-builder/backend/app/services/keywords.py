"""Keyword extraction for ingest (payload) and RAG (query). Uses standard stopwords only."""
import re
import unicodedata

# Standard English stopwords (NLTK-style). Used only for query keyword extraction.
# No domain-specific terms; works for any user data.
ENGLISH_STOPWORDS = frozenset({
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours",
    "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself",
    "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which",
    "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "would",
    "could", "should", "ought", "a", "an", "the", "and", "but", "or", "nor", "if", "then",
    "else", "when", "at", "by", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "to", "from", "up", "down",
    "in", "out", "on", "off", "over", "under", "again", "further", "once", "here", "there",
    "all", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just", "can", "will", "may",
    "must", "shall", "how", "why", "where", "any", "many", "much", "please", "tell", "say",
})


def normalize_for_match(text: str) -> str:
    """Normalize for keyword matching: lowercase, NFKC unicode, strip."""
    if not text:
        return ""
    return unicodedata.normalize("NFKC", text.strip().lower())


def extract_keywords_from_text(
    text: str,
    min_len: int = 2,
    stop: frozenset[str] | None = None,
) -> list[str]:
    """Extract alphanumeric tokens (for payload or query). No synonym expansion."""
    normalized = normalize_for_match(text)
    words = re.findall(r"[a-z0-9]+", normalized)
    if stop is not None:
        words = [w for w in words if len(w) >= min_len and w not in stop]
    else:
        words = [w for w in words if len(w) >= min_len]
    return list(dict.fromkeys(words))


def question_keywords(question: str) -> set[str]:
    """Content-bearing terms from the question for retrieval. Standard stopwords only."""
    return set(extract_keywords_from_text(question, min_len=2, stop=ENGLISH_STOPWORDS))


def chunk_contains_any_keyword(chunk_text: str, keywords: set[str]) -> bool:
    """True if normalized chunk text contains any of the keywords."""
    if not keywords:
        return False
    lower = normalize_for_match(chunk_text)
    return any(kw in lower for kw in keywords)
