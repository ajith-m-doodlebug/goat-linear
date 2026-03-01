# LLM Builder – Feature Overview

LLM Builder is a fully self-hosted AI infrastructure platform that lets you ingest data, configure retrieval, register models, build prompt-driven deployments, and chat – all running on your own infrastructure.

## Core capabilities

- **Self-hosted, on‑premise stack**  
  - FastAPI backend, Next.js frontend, PostgreSQL, Redis, Qdrant, and background workers (RQ).  
  - Runs locally via Docker Compose with an optional GPU stack (Ollama / vLLM).

- **Web UI and REST API**  
  - Modern dashboard for non-technical users (Knowledge, Models, Deployments, Chat, RAG configs).  
  - Versioned REST API (`/api/v1`) for automation and integration.

- **Single-role admin model**  
  - First registered user becomes admin; all users are admins (single role).  
  - JWT-based authentication with access and refresh tokens.

## Knowledge bases & document ingestion

- **Knowledge bases**  
  - Create and manage multiple knowledge bases, each with its own configuration.  
  - Each knowledge base maps to a dedicated Qdrant collection.

- **Document upload & management**  
  - Upload documents into a selected knowledge base from the UI.  
  - Supported formats: `.txt`, `.pdf`, `.docx`, `.doc`, `.html`, `.htm`.  
  - File safety: filename sanitization and a 50 MB per‑file limit.

- **Background ingest pipeline**  
  - Upload triggers an asynchronous ingest job (via Redis/RQ worker).  
  - Steps: file retrieval → text extraction → chunking → embedding → upsert into Qdrant.  
  - Stores document status (`pending`, `processing`, `completed`, `failed`) plus error messages.  
  - Re-ingest action to re-run the pipeline for a document.

- **Configurable chunking & embedding**  
  - Central RAG config schemas define chunk size, overlap, strategy, and embedding model.  
  - Per-knowledge-base and per-document overrides, plus reusable RAG config presets.

## Retrieval-Augmented Generation (RAG)

- **Hybrid retrieval**  
  - Combines keyword-based scanning and dense vector search for robust recall.  
  - Keyword stage ensures that obvious matches (names, numbers, IDs) are not missed.  
  - Vector search adds semantic matches; results are merged and deduplicated.

- **Context building & citations**  
  - Top‑k chunks (default 10) are concatenated into a context string passed to the model.  
  - Citations (chunk text, source document, scores) are returned and shown in the UI.

- **Safer answers**  
  - Default prompts instruct the model to answer strictly from context and admit when the answer is not in the documents, reducing hallucinations.  
  - Behavior can be customized via prompt templates.

## Model registry & LLM providers

- **Model registry**  
  - Central list of models (name, provider, endpoint URL, model ID, config, version).  
  - Encrypted storage for API keys where needed.

- **Supported provider types**  
  - **Ollama** – local models served via Ollama, usable from host or Docker.  
  - **vLLM / OpenAI-compatible** – any OpenAI-style chat endpoint (including self-hosted vLLM).  
  - **Custom REST** – arbitrary OpenAI-format chat APIs.

- **Model testing & health**  
  - “Test” action from the UI to send a prompt and view the raw reply.  
  - Provider-specific health checks with clear error messages (connection issues, 404, etc.).

## Prompt templates

- **Template management**  
  - Create, version, and update reusable prompt templates.  
  - Templates can be attached to deployments to standardize tone, style, or instructions.

- **Structured placeholders**  
  - Built-in variables for `{context}`, `{question}`, and optional `{memory}` (chat history).  
  - Encourages explicit instructions about using only provided context and how to respond when data is missing.

## Deployments & exported bundles

- **Deployments (RAG applications)**  
  - A deployment binds together:
    - A model from the registry.  
    - An optional knowledge base (for RAG).  
    - An optional prompt template.  
    - Memory and RAG configuration (e.g. number of history turns).
  - Chat UI interacts with deployments rather than raw models.

- **Exportable RAG APIs**  
  - Deployments can be exported as standalone RAG API bundles with their own Docker Compose config.  
  - Each export gets unique host ports for the API and Qdrant, derived from the deployment ID.  
  - Allows running multiple exported deployments alongside the main app without port conflicts.

## Chat & conversation memory

- **Chat sessions and history**  
  - Per-deployment chat sessions with titles and full message history.  
  - Each message includes role, content, and optional citations.

- **Conversation-aware responses**  
  - Last N turns of chat history (configurable per deployment) are injected as memory.  
  - History can be optionally used in prompt templates via `{memory}`.

- **RAG-backed chat flow**  
  - For each user question:
    - Load deployment, model, KB, and template.  
    - Retrieve context (hybrid search) when a KB is attached.  
    - Build the prompt and call the configured LLM.  
    - Persist user and assistant messages plus citations.

## RAG config presets

- **Reusable configuration profiles**  
  - Named presets that capture chunking, embedding, and retrieval settings.  
  - Scoped to a user and reusable across knowledge bases and documents.

- **Effective config resolution**  
  - Final ingest config is composed from defaults, knowledge-base-level settings, and optional preset / per-document overrides.

## Operations, health, and scaling

- **Containerized infrastructure**  
  - Single `docker-compose.yml` for Postgres, Redis, Qdrant, Adminer, API, worker, and frontend.  
  - Dev override (`docker-compose.dev.yml`) for live reload and mounted source.

- **Health & readiness endpoints**  
  - `/health` for basic service health.  
  - `/ready` checks database and Redis connectivity.

- **Operator runbook**  
  - Documented procedures for start/stop, viewing logs, backups, and restores.  
  - Environment-based configuration via `.env` and Pydantic settings.

- **Scaling**  
  - Horizontal scaling of workers (`--scale worker=N`) for ingest throughput.  
  - API replicas behind a load balancer with shared DB and Redis.

- **Optional GPU support**  
  - Additional compose file enabling Ollama (and optionally vLLM) with GPU via NVIDIA Container Toolkit.  
  - Main app and exported deployments can target the same GPU-backed model endpoints.

## Extensibility & integration

- **Public API**  
  - REST endpoints for auth, users, knowledge bases, documents, models, deployments, chat, and RAG configs.  
  - Suitable for scripting, CI/CD, and integration into other systems.

- **Exported deployment APIs**  
  - Lightweight, self-contained RAG microservices derived from deployments.  
  - Test script provided for quick verification of exported endpoints.

- **Pluggable embeddings & models**  
  - Embedding registry abstraction allows swapping or extending embedding models.  
  - Model provider abstraction supports adding new LLM backends with minimal changes.

