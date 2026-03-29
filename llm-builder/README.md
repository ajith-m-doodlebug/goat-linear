# LLM Builder On-Premise

Fully on-premises AI infrastructure platform: data ingestion, RAG, fine-tuning, model registry, deployments, and chat with enterprise governance.

## Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, Alembic, Redis (RQ), PostgreSQL, Qdrant
- **Deploy:** Docker Compose; optional GPU stack (Ollama, vLLM)

## Quick start (Docker, project name: ragline)

**Local development** (bind mounts, reload on save):

```bash
./setup.sh   # clean slate, backup if possible, build dev images, migrate, start dev stack
./start.sh   # ensure up, then stream logs (Ctrl+C stops following only)
./stop.sh    # stop dev stack (data preserved)
```

**Production** (server: upload repo, configure `.env`, then):

```bash
./setup-prod.sh   # clean slate, build prod images, migrate, start stack
./start-prod.sh   # start or recreate containers (no logs)
./logs-prod.sh    # follow logs; optional: ./logs-prod.sh app web
./stop-prod.sh    # stop stack (data preserved)
```

Shared logic lives in `_ragline_common.sh`. Override the compose project with `RAGLINE_PROJECT=name` if needed.

Containers and volumes are named under the **ragline** project so they don’t clash with other compose stacks.

- App: http://localhost:3000  
- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  
- Adminer (DB): http://localhost:8096 — login with Server `postgres`, User `llmbuilder`, Password `llmbuilder`, Database `llmbuilder`  

Register a user and use **Knowledge** (upload docs, RAG), **Models** (Ollama/OpenAI/vLLM), **Deployments** (RAG + model + prompt), and **Chat**.

## Project layout

- `frontend/` — Next.js app
- `backend/` — FastAPI app, workers, migrations
- `docker-compose.yml` — all services (project name: **ragline**)
- `docker-compose.gpu.yml` — optional GPU inference
- `_ragline_common.sh` — shared helpers for lifecycle scripts  
- `setup.sh` / `start.sh` / `stop.sh` — dev lifecycle  
- `setup-prod.sh` / `start-prod.sh` / `logs-prod.sh` / `stop-prod.sh` — production lifecycle  

## Users and login

There is a single user type: **admin**. The **first user you register** is admin and has full access. Every user is an admin (one role). Log in with email and password.
