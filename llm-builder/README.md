# LLM Builder On-Premise

Fully self-hosted AI infrastructure platform: data ingestion, RAG, fine-tuning, model registry, deployments, and chat with enterprise governance.

## Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, Alembic, Redis (RQ), PostgreSQL, Qdrant
- **Deploy:** Docker Compose; optional GPU stack (Ollama, vLLM)

## Quick start (Docker, project name: goat)

```bash
./setup.sh   # create .env, build, start infra, run migrations, start all
./start.sh   # start containers (backend --reload, frontend npm run dev; reload on save)
./stop.sh    # stop containers (data preserved)
```

Containers and volumes are named under the **goat** project so they don’t clash with other compose stacks.

- App: http://localhost:3000  
- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  
- Adminer (DB): http://localhost:8080 — login with Server `postgres`, User `llmbuilder`, Password `llmbuilder`, Database `llmbuilder`  

Register a user and use **Knowledge** (upload docs, RAG), **Models** (Ollama/OpenAI/vLLM), **Deployments** (RAG + model + prompt), **Chat**, **Training** (fine-tuning jobs), **Audit**, and **API Keys**.  
**How to use (including file upload):** [docs/USAGE.md](docs/USAGE.md)

## Project layout

- `frontend/` — Next.js app
- `backend/` — FastAPI app, workers, migrations
- `docker-compose.yml` — all services (project name: **goat**)
- `docker-compose.gpu.yml` — optional GPU inference
- `setup.sh` / `start.sh` / `stop.sh` — Docker lifecycle for this project only
- `docs/` — [README](docs/README.md), [USAGE.md](docs/USAGE.md) (how to use & upload files), [OPERATOR.md](docs/OPERATOR.md)

## Roles and login

You **log in the same way** (email + password) no matter your role. The app uses your account’s role to show or hide features.

- **User** — chat, run deployments
- **Builder** — knowledge bases, models, deployments, training
- **Admin** — users, audit
- **Auditor** — read-only audit logs
- **Super Admin** — full access

The **first user you register** is made **Super Admin**. To give another account Admin or Builder: use the API (`PATCH /api/v1/users/{user_id}` with `{"role": "admin"}` or `"builder"`) or set `role` in the `users` table in Adminer (http://localhost:8080). See [docs/USAGE.md](docs/USAGE.md) for details.

All eight phases from the build plan are implemented.
