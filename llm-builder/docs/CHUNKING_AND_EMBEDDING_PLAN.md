# Plan: Chunking and Vectorization Options for Users

This document defines the **chunking** and **vectorization (embedding)** options we will expose so users can choose how their documents are split and embedded.

---

## 1. Chunking options

| Option ID | Display name | Description | Parameters |
|-----------|--------------|-------------|------------|
| `fixed` | Fixed size (sentence-aware) | Current behavior: split by ~N characters, break at sentence/newline/space when possible. Good default. | `chunk_size`, `overlap` |
| `paragraph` | By paragraph | Split on double newline (`\n\n`) or single newline; merge short paragraphs up to max size. Keeps complete paragraphs together. | `chunk_size` (max), `overlap` |
| `sentence` | By sentence | Split into sentences, then group into chunks of ~N sentences. Best for Q&A over short, self-contained facts. | `chunk_size` (in sentences), `overlap` (sentences) |
| `recursive` | Recursive (section-aware) | Try splitting by `\n\n`, then `\n`, then `. `, then space, then character. LangChain-style; respects document structure. | `chunk_size`, `overlap`, separators list |

**Parameters to expose (per strategy):**

- **Chunk size** – Number (default 512 for character-based; 5–10 for sentence-based). Unit depends on strategy (chars vs sentences). UI: dropdown or number input with short hint.
- **Overlap** – Number (default 50 for character; 1 for sentence). Reduces fragmentation at boundaries.

**Stored:** At **Knowledge Base** level as default; at **Document** level to override (see §3).

---

## 2. Vectorization (embedding) options

| Option ID | Display name | Dimensions | Speed vs quality | Notes |
|-----------|--------------|------------|------------------|--------|
| `all-MiniLM-L6-v2` | MiniLM (fast) | 384 | Fast, good | Current default; CPU-friendly. |
| `all-mpnet-base-v2` | MPNet (balanced) | 768 | Medium, better | Better quality, slower and larger. |
| `BAAI/bge-small-en-v1.5` | BGE Small | 384 | Fast, good | Retrieval-focused; optional query prefix. |
| `BAAI/bge-base-en-v1.5` | BGE Base | 768 | Medium, better | Better retrieval quality. |
| `intfloat/e5-small-v2` | E5 Small | 384 | Fast, good | Add "query: " / "passage: " prefix. |
| `intfloat/e5-base-v2` | E5 Base | 768 | Medium, better | Same prefix requirement. |

**Parameters to expose:**

- **Embedding model** – Dropdown of the options above (ID = model name for sentence-transformers).
- **Query prefix** (optional) – For E5/BGE: e.g. `"query: "` for queries and `"passage: "` for documents. Stored in KB config; applied at index time (documents) and query time (RAG).

**Stored:** At **Knowledge Base** level as default; at **Document** level to override (see §3). Vector size is derived from the model (registry in backend).

**Important:** Changing the embedding model (at KB or document) implies re-embedding that document's vectors. UI should warn when embedding model changes and offer re-process. "Changing embedding model will require re-processing all documents in this knowledge base."

---

## 3. Config hierarchy: Knowledge Base default vs Document override

- **Knowledge Base config** = default for all documents in that KB. When **creating** a KB, the user can optionally set chunking + embedding. If set, that config applies to every document unless overridden. If they **do not** set it, the KB has no default; then the user **configures per document** (at upload or in document settings).
- **Document config** = override for that document only. Each document can have its own config (chunking + embedding). If present, it **overrides** the KB default. If a document has no config, ingest uses the KB's config; if the KB has no config, use app defaults.
- **Resolution:** `effective_config = document.config ?? knowledge_base.config ?? app_defaults` (per document at ingest / RAG).
---

## 4. Where options are shown

- **Create Knowledge Base** – Optional section "Default chunking & embedding". If set, that default applies to all documents (overridable per document later). If left empty, show hint: "You can set chunking and embedding per document when uploading or editing."
- **Edit Knowledge Base** – Same optional config; changing it affects new docs or docs without their own override; "Re-process all" can re-run ingest using current KB default for docs that have no override.
- **Upload document** – Option: "Use knowledge base default" (greyed out if KB has no config) or "Set for this document" (chunking + embedding form). If KB has no default, user sets config per document (or uses app defaults).
- **Document detail / Edit document** – Show effective config (from KB or document override); allow "Override: set chunking & embedding for this document" (same form as KB); option to "Revert to KB default" (clear document config).

---

## 4a. RAG config presets (separate tab under More)

Users can create **named chunking + embedding configs** (presets) in a dedicated area and apply them in one click when creating a KB or configuring a document.

- **New tab under More:** e.g. **"Chunking & embedding"** or **"RAG configs"** – route `/dashboard/rag-configs` (or `/dashboard/chunking-embedding`).
- **Preset =** name + full config (chunk strategy, chunk_size, overlap, embedding_model, query_prefix). Same shape as KB/document config.
- **On the presets page:** List of saved configs; **Create** / **Edit** / **Delete**. Create/Edit form is the same chunking + embedding form (strategy, size, overlap, model, prefix). Optional short description per preset.
- **Apply easily:** When creating or editing a **Knowledge Base**, or when **setting config for a document** (upload or document edit), show a dropdown **"Use preset"** (optional). Selecting a preset fills the chunking and embedding fields from that preset; user can still tweak. If no preset is selected, user fills the form manually (or uses KB default for documents).
- **Scope:** Presets are global (per workspace/user) so they can be reused across any KB or document.

**Benefits:** Reuse "Small chunks + BGE" or "Paragraph chunks for manuals" without re-entering; share consistent settings across KBs; power users define once and apply everywhere.

---

## 5. Implementation plan

### Phase 1: Backend – schema and config

1. **Knowledge Base model**
   - Add a JSON column `config` (or columns `chunk_strategy`, `chunk_size`, `chunk_overlap`, `embedding_model`, `embedding_query_prefix`).
   - Defaults: `chunk_strategy: "fixed"`, `chunk_size: 512`, `chunk_overlap: 50`, `embedding_model: "all-MiniLM-L6-v2"`, `embedding_query_prefix: null`.

2. **Document model**
   - Add a JSON column `config` (same shape as KB config). If present, it overrides the KB config for that document at ingest.

3. **Alembic migration**
   - Add `config` (JSONB) to `knowledge_bases` with default `{}`.
   - Add `config` (JSONB) to `documents` with default `{}`.

4. **Schemas**
   - Extend `KnowledgeBaseCreate`, `KnowledgeBaseUpdate`, `KnowledgeBaseResponse` with optional `config`. Extend document create/update/response (or upload payload) with optional `config` for per-document override.

5. **API**
   - Create/update KB accepts and returns optional config. Upload document and update document accept optional `config`; document response includes it (and optionally effective config for display).

6. **RAG config presets (new)**
   - New model: e.g. `RagConfigPreset` or `ChunkEmbeddingPreset` – id, name, optional description, config (JSONB, same shape as KB config), user_id (or org-scoped), created_at. Table e.g. `rag_config_presets`.
   - New API: `GET /api/v1/rag-configs` (list), `POST /api/v1/rag-configs` (create), `PATCH /api/v1/rag-configs/:id`, `DELETE /api/v1/rag-configs/:id`. List returns presets for the current user so KB/document forms can show "Use preset" dropdown.
   - Migration: create `rag_config_presets` table.

### Phase 2: Backend – chunking

5. **Document parser**
   - Refactor `chunk_text(text, chunk_size, overlap)` to accept a **strategy** and params, e.g. `chunk_text(text, strategy="fixed", chunk_size=512, overlap=50)`.
   - Implement:
     - `fixed` – current logic (character-based, break at sentence/newline/space).
     - `paragraph` – split on `\n\n` (and optionally `\n`), merge until chunk_size.
     - `sentence` – simple sentence split (regex or nltk), group by N sentences with optional overlap.
     - `recursive` – ordered list of separators; split by first, then recurse on oversized segments.
   - Export a constant list of strategy IDs and default params for API/docs.

### Phase 3: Backend – embedding

6. **Embedding registry**
   - New module (e.g. `app/services/embedding_registry.py`): map model ID → vector size and optional query/passage prefixes.
   - `get_embedding_model(model_id: str)` – lazy-load the SentenceTransformer for that ID (cache per model_id).
   - `encode_query(query, model_id, query_prefix)` – encode with the right model and prefix.
   - `encode_documents(texts, model_id, passage_prefix)` – same for document chunks.

7. **Ingest worker**
   - Resolve effective config per document: effective = document.config if document.config else knowledge_base.config else app_defaults.
   - Use effective config for chunk_strategy, chunk_size, chunk_overlap, embedding_model, embedding_query_prefix. Call chunk_text(...) and embed with effective model; ensure Qdrant collection vector size matches that model.

8. **RAG**
   - Load the linked KB embedding_model and query_prefix for the query. Use the same model as at index time (per KB).

### Phase 4: Frontend

9. **New page under More: "Chunking & embedding" (or "RAG configs")**
   - Route: `/dashboard/rag-configs`. Add to sidebar under **More**.
   - Page: List of saved presets (name, optional description, summary of config). Buttons: **New preset**, and per row: Edit, Delete.
   - Create/Edit preset modal: same form as chunking + embedding (strategy, chunk size, overlap, embedding model, query prefix); plus **Name** (required) and **Description** (optional). Save as preset via API.

10. **Knowledge Base create modal**
   - Optional **"Use preset"** dropdown at top of chunking/embedding section: list from `GET /api/v1/rag-configs`. On select, fill strategy, size, overlap, model, prefix from preset; user can still edit. Option "None" or "Set manually".
   - Add section "Chunking" (strategy, chunk size, overlap) and "Embedding" (model, query prefix). Send final config in create payload.

11. **Knowledge Base edit**
    - Same fields as create, pre-filled from KB config.
    - If user changes **embedding model**, show warning and optional "Re-process all documents" (re-run ingest for docs that use KB default; docs with their own override keep their config unless user clears it).

12. **Upload document**
    - If KB has default config: show "Use knowledge base default" (pre-selected) or "Set for this document" (expand chunking + embedding form).
    - If KB has no default: show "Set chunking & embedding for this document" (required or optional with app defaults) or a short hint.
    - On "Set for this document", same form as KB (strategy, chunk size, overlap, embedding model, query prefix). Stored in document config.

   - Optional "Use preset" dropdown when "Set for this document" is chosen; same as KB create.
13. **Document detail / Edit document**
    - Display effective config (from KB or document override). Allow "Override: set chunking & embedding for this document" (same form); option "Revert to KB default" (clear document config). Changing embedding model or chunking for a doc requires re-ingest for that document.

   - Optional "Use preset" when overriding; same dropdown as KB.
14. **Docs / in-app help**
    - Short descriptions for each chunking strategy and each embedding model (speed vs quality, when to use).

### Phase 5: Re-indexing and validation

15. **Re-ingest**
    - When KB embedding (or chunking) config changes, existing vectors may be wrong. Options:
      - (A) Allow edit; show warning; user manually re-uploads or we add "Re-process all" that re-runs ingest for every document in the KB.
      - (B) On embedding model change, backend could auto-enqueue re-ingest for all documents (optional, can be Phase 2).

16. **Validation**
    - Chunk size / overlap in sensible ranges (e.g. chunk_size 128–2048, overlap 0–chunk_size/2).
    - Embedding model must be one of the registered IDs.

---

## 6. Summary of options to expose

**Chunking (per KB or per document):**

- Strategy: **Fixed size** | **By paragraph** | **By sentence** | **Recursive**
- Chunk size: number (default 512 for fixed/recursive; 5 for sentence)
- Overlap: number (default 50 for fixed/recursive; 1 for sentence)

**Vectorization (per KB or per document):**

- Embedding model: **MiniLM (fast)** | **MPNet (balanced)** | **BGE Small** | **BGE Base** | **E5 Small** | **E5 Base**
- Query prefix: optional text (for E5/BGE; default "query: " for queries, "passage: " for docs)

**Presets (More → Chunking & embedding):**

- Saved named configs (chunking + embedding) that can be applied in one click when creating a KB or setting document config. Create/edit/delete presets on the dedicated page; "Use preset" dropdown in KB create, KB edit, document upload, and document override flows.

**Data flow:**

- Create KB (optional config or preset) = default for all documents. Upload/edit document (optional config or preset) = override for that document. Ingest: effective config = document.config ?? KB.config ?? app_defaults; chunk and embed; store in Qdrant. RAG uses KB embedding model for the query. If KB has no config, user sets config per document when uploading or editing.

This plan keeps implementation incremental (schema then chunking then embedding then frontend then re-ingest) and gives users KB-level default with per-document override for both chunking and vectorization.
