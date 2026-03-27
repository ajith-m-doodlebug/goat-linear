# RAGLine / LLM Builder — Marketing feature brief

Use this document to brief another agent or designer building the marketing website. It reflects what the **llm-builder** codebase actually implements.

---

## Product identity

- **One-line pitch:** A plug-and-play on-prem RAG builder with self-deployment or export (0 dependencies) and version control.
- **Working name in UI:** **RAGLine** — landing tagline: *On-prem AI: documents, models, RAG, and chat in one place.*
- **Repo / positioning:** **LLM Builder On-Premise** — on-premises AI stack with data ingestion, RAG, model registry, deployments, and chat (`README.md`).

---

## Core user journey (four steps)

1. **Knowledge** — Upload documents → chunk & embed for RAG.
2. **Models** — Register inference endpoints (Ollama, vLLM, OpenAI-compatible, Anthropic, custom); test with a prompt.
3. **Deployments** — Combine **model + optional knowledge base + prompt** into a deployable target; manage **versions**, **hosted API**, **export**.
4. **Chat** — Pick a deployment; chat with **RAG** when a knowledge base is linked.

---

## Feature areas (summary table)

| Area | Accurate description |
|------|----------------------|
| **Knowledge bases** | Multiple KBs; **document upload**; **ingestion** with status; per-KB **RAG config** and **retriever mode** (hybrid vs vector-only); optional **preset** at create/edit time. |
| **RAG / chunking** | **Chunking & embedding** presets; multiple **chunk strategies**; **embedding model** presets; optional **query prefix** (E5/BGE-style). |
| **Models** | **Model registry**: add/edit/delete; several **providers**; **test prompt** to verify responses. |
| **Prompts** | **Prompt templates** with **`{context}`**, **`{question}`**, optional **`{memory}`**; optional version label. |
| **Deployments** | Link **model**, optional **KB**, optional **prompt** (or system default); **test question** in UI; **versions** with **start/stop**, **memory** settings, **export** zip; **hosted** OpenAI-style chat URL. |
| **Chat (in-app)** | **Sessions** per deployment; **citations** on assistant messages; rename/delete sessions; deep link `?session=`. |
| **Hosted public API** | **`/hosted/{id}/health`** and **`POST .../v1/chat/completions`**; optional **session id** / **`X-Session-Id`** when memory is enabled. |
| **Auth & onboarding** | **JWT** (access + refresh); **login**; **register with OTP** (domain-restricted); **first-time setup** wizard. |
| **Admin** | **Users** table: email, name, **role**, active/inactive; **super admin** can change **roles** (admin / developer / tester) for non–super-admin users. |
| **Dashboard home** | Counts, readiness hints, **live hosted** endpoints table, **recent chats** with links. |
| **Help** | In-app **Help & features** with numbered workflow and feature cards. |

---

## Export vs hosted deploy (how it works)

The product supports two ways to take a deployment from “configured in the builder” to “callable by applications”: **hosted deploy** (stay on the same RAGLine server) and **export** (download a portable bundle to run elsewhere). They solve different operational needs.

### Hosted deploy (“self-deploy” on your RAGLine instance)

**What it is:** You turn a deployment into one or more **frozen versions** that run **inside the same RAGLine deployment** (same API process, shared Postgres/Redis/Qdrant stack). The UI **Deploy (hosted API)** flow creates the **first** hosted version; you can add more versions later and **start** / **stop** them.

**What happens technically:**

- The platform **snapshots** the current deployment definition: linked **model** (with endpoint and, where stored, credentials for in-process calls), **prompt** text, **retriever** settings (embedding model, query prefix, hybrid vs vector-only when a KB exists), and whether **conversation memory** is enabled with **how many turns**.
- If a **knowledge base** is attached, vector data is copied into a dedicated Qdrant collection named `hosted_{version_id}` so the hosted API does not mutate the original KB collection.
- **One version per deployment can be “running”** at a time; starting a version stops any other running version for that deployment.

**What callers get:**

- Stable URLs on your **main API base URL** (same host as the builder), **no JWT** on these routes — intended as integration endpoints for apps that already sit in your trust boundary:
  - `GET /hosted/{deployment_id}/health` — liveness for the hosted stack.
  - `POST /hosted/{deployment_id}/v1/chat/completions` — **OpenAI-style** JSON body (`messages`, optional `session_id` / header `X-Session-Id` when memory is on).
- The in-app **Chat** and **Test** flows remain separate (authenticated) experiences; hosted routes are for **programmatic** use.

**Marketing angle:** *Ship an API from the same console you use to manage data and models — no second cluster until you need one.*

---

### Export (portable “run anywhere” bundle)

**What it is:** A **zip download** containing a **frozen configuration**, a **vector snapshot** (if the deployment had a KB), and a **minimal FastAPI service** plus **Docker** assets so you can run an OpenAI-compatible endpoint **outside** the main RAGLine app — e.g. another VPC, customer site, air-gapped node, or a second Docker host.

**Two export actions in the UI (and API):**

| Action | What it captures |
|--------|-------------------|
| **Export deployment** | Current live deployment definition from the builder: model metadata (see keys below), prompt, retriever, and — if a KB is linked — a full **scroll/export of the KB’s Qdrant collection** into `qdrant_storage/points.json`. |
| **Export version** | The **frozen snapshot** associated with a specific **hosted version** (same shape as export, but sourced from that version’s frozen config and, when applicable, its `hosted_{version_id}` vectors). Use this when you want the bundle to match **exactly** what was validated in a given version label. |

**What is inside the zip (conceptually):**

- **`config.json`** — Frozen model pointer (provider, endpoint URL, model id; **no raw API key**), prompt text, retriever (e.g. `top_k`, embedding model, query prefix), `has_kb`, vector dimensions, etc.
- **`qdrant_storage/points.json`** — Serialized vectors + payloads for seeding Qdrant (empty or omitted when there is no KB).
- **`server/`** — Small **FastAPI** app that loads config, seeds Qdrant from the snapshot at startup, exposes **`GET /health`** and **`POST /v1/chat/completions`** (same general contract as hosted).
- **`Dockerfile`**, **`docker-compose.yml`** — Compose file brings up **Qdrant** and the **API** container; README documents run instructions.
- **`README.md`** — Step-by-step: **Docker Compose (recommended)**, optional plain Docker, optional Python venv + `uvicorn`.

**Ports and isolation:**

- **API and Qdrant host ports** are chosen **deterministically from the deployment (or version) id** so multiple exported bundles can run on one machine **alongside** the main RAGLine stack without colliding (different port ranges than the primary app’s defaults).

**Secrets:**

- **API keys are never embedded** in the zip. For OpenAI/custom-style providers, operators set **`API_KEY`** (or the documented env) at runtime — README calls this out explicitly.

**Marketing angle:** *Freeze what you built, air-gap it, or hand off a single zip to ops — OpenAI-compatible surface, your infrastructure.*

---

### Quick comparison (for copy blocks)

| | **Hosted deploy** | **Export** |
|--|-------------------|------------|
| **Runs where** | Same RAGLine API / stack | Anywhere you run Docker (or Python + Qdrant) |
| **Auth** | Hosted routes are **unauthenticated** on the main server (treat as internal integration) | Your bundle; you control network and secrets |
| **Best for** | Fast integration, same org, same cluster | Offline, customer premises, multi-region, or strict network isolation |
| **Versioning** | Versions live in DB; start/stop | Re-download zip when you change configuration |

---

## Per-page / per-screen details

Use these sections to describe what each part of the product *does* in marketing copy or feature lists.

### Landing (`/`)

- Title **RAGLine** with short value line: on-prem AI for documents, models, RAG, and chat in one place.
- Primary actions: **Log in** and **Sign up**.

### Initial setup (`/setup`)

- Shown when the instance has not completed setup (before normal login/signup flow).
- Collects: **super admin email**, **password**, **company name**, **allowed email domain** (only addresses on that domain can register later).
- Optional: **seed default prompts and models** (checkbox).
- Explains that signup is restricted to the configured company domain.

### Log in (`/login`)

- Email + password; stores JWT pair and redirects to the dashboard.

### Sign up (`/register`)

- **Two steps:** (1) enter work email → **request OTP**; (2) enter **OTP**, **password**, optional **full name** → completes registration and logs in.
- Copy explains verification by code and **domain restriction** (must match setup).

### Dashboard — Home (`/dashboard`)

- **Overview** headline with counts: knowledge bases, models, deployments, chat sessions.
- **Status / readiness:** badges such as *Ready to chat*, *Add a deployment to start chatting*, or *Get started: add a model…*; badge for count of **live hosted** deployments.
- **Breakdown table:** each component type with count and **names** (or links to add the first KB/model/deployment).
- **Next steps** list when setup is incomplete (links to Models, Deployments, Chat as appropriate).
- **Live hosted deployments** (when any): table with deployment name, **version label**, full **endpoint URL** (`…/hosted/{id}/v1/chat/completions`), **running** status, **memory on/off**, **started** time.
- **Recent chat sessions** (up to 5): title + relative time; each row links to Chat with **`?session=`** query for deep link.
- **Quick link** tiles: Knowledge, Models, Deployments, Chat.

### Knowledge (`/dashboard/knowledge`)

- **Knowledge bases** as a selectable list; create **New knowledge base** with name, description, optional **RAG preset**, and full **chunking + embedding** form (or rely on preset).
- Per knowledge base: **retriever mode** — **hybrid** (vector + keyword-style behavior) vs **vector only**.
- **Upload modes:** (a) **Files** — `.txt`, `.pdf`, `.docx`, `.doc`, `.html`, `.htm`; (b) **Documentation** — **`.zip`** package for doc-site style ingestion.
- **Drag-and-drop** and file picker; multi-file upload for file mode.
- **Documents** list per KB with **status** (pending / processing / completed / failed); **auto-refresh** while any doc is pending or processing.
- Actions: **re-ingest** a document, **edit** document metadata/config, **delete** document; **edit** or **delete** the knowledge base itself.
- **Edit KB** supports updating name, description, **preset**, retriever mode, and inline RAG fields (chunk strategy, size, overlap, embedding model, query prefix).

### Models (`/dashboard/models`)

- **Page description:** register LLM endpoints for **Ollama, vLLM, OpenAI, Anthropic (Claude), or Custom REST** for use in deployments and chat.
- **Add model** form: **provider** dropdown (Ollama, vLLM, OpenAI, Anthropic, Custom); optional **display name**; **endpoint URL** (optional for Ollama; examples for Docker/vLLM/cloud APIs); **model ID** (provider-specific placeholders); **API key** (password field) for OpenAI, Anthropic, or optional for Custom.
- **Registered models** list: name, provider, model id, endpoint snippet; actions **Test**, **Edit**, **Delete** (delete warns deployments may break).
- **Test** panel: textarea **prompt** + **Run** → shows model **response** or error text.

### Deployments (`/dashboard/deployments`)

- **Page description:** pair a model with an optional knowledge base; **deploy** for a stable API URL on this RAGLine instance or **export** a portable zip; select a deployment to inspect **versions**. See **[Export vs hosted deploy](#export-vs-hosted-deploy-how-it-works)** for how those differ end-to-end.
- **New deployment:** name; **model** (required); **knowledge base** (optional); **prompt template** (optional, or “Default”).
- **Per deployment:** **Test** with a **question** — returns **answer text** and **citations** (chunk text, source, score) when RAG applies; **Edit** (same fields as create); **Delete**; **Export** whole deployment as **zip**; **Deploy (hosted API)** opens modal.
- **Hosted deploy modal:** optional **conversation memory** (checkbox) with **last N turns** (1–50); explains using **`{memory}`** in prompts or automatic prepending; on success shows **chat completions endpoint**, **health URL**, and how to pass **`session_id`** / **`X-Session-Id`** for memory.
- **Versions** for selected deployment: list of **version labels**, **status** (e.g. running/stopped), **memory enabled**, timestamps; actions **Export version** (zip), **Start**, **Stop**, **Delete**; flow to **create new version** (optionally make live).
- Duplicate **endpoint** pattern: `{API_BASE}/hosted/{deployment_id}/v1/chat/completions` and `/hosted/{deployment_id}/health`.

### Chat (`/dashboard/chat`)

- **Page description:** pick a deployment; answers are **grounded in documents** when a KB is linked to that deployment.
- **Start New Chat** → modal: choose **deployment** → creates a **session**.
- Left sidebar: **Recent** sessions (up to 5) with select; **⋯ menu** per session: **Rename**, **Delete** (with confirmation).
- Main area: shows **deployment name** for current session; **message thread** (user vs assistant styling).
- Assistant messages: expandable **citations** — source name, chunk text, relevance; special copy when the model errored but context was still retrieved.
- Composer: **textarea**; **Send** button; **Enter** sends, **Shift+Enter** newline; **Thinking…** state while waiting.
- Supports opening a session via **`/dashboard/chat?session={id}`** (e.g. from Home).

### Prompts (`/dashboard/prompts`)

- **Page description:** templates use **`{context}`**, **`{question}`**, optionally **`{memory}`**; assign templates to deployments.
- **New / Edit template:** **name**; **content** (large textarea, monospace) with inline help and example; optional **version** string (e.g. `1.0`).
- **Table** of templates: name, content preview (truncated), version; edit/delete (delete warns deployments may lose template).

### Chunking & embedding (`/dashboard/rag-configs`)

- **Page description:** reusable **presets** for chunking + embedding; apply when creating a KB or configuring documents.
- **Preset** fields: **name**, optional **description**; **chunk strategy** — *Fixed size (sentence-aware)*, *By paragraph*, *By sentence*, *Recursive (section-aware)*; **chunk size** (64–2048), **overlap** (0 up to chunk size); **embedding model** — MiniLM, MPNet, BGE Small/Base, E5 Small/Base (labeled for speed/quality); optional **query prefix** for E5/BGE-style models.
- Presets listed in a table with summary (strategy + model); create, edit, delete.

### Help (`/dashboard/help`)

- **Get started** grid: four numbered cards (Knowledge → Models → Deployments → Chat) with one-line descriptions and links.
- **Features** grid: cards for Knowledge, Models, Deployments, Chat, Prompts, Chunking & embedding — each with short line and link.

### Users — Admin (`/dashboard/users`)

- **Table:** email, full name, **role**, **Active/Inactive** status.
- **Super admin** sees an extra column to **change role** via dropdown: **Admin**, **Developer**, **Tester** (the **super admin** row cannot be reassigned from this UI).
- Roles and status are suitable for enterprise/governance messaging (who can do what — align with your policy; the UI exposes role names above).

---
