# LLM Builder On-Premise

Fully self-hosted AI infrastructure platform: data ingestion, RAG, fine-tuning, model registry, deployments, and chat with enterprise governance.

## Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, Alembic, Redis (RQ), PostgreSQL, Qdrant
- **Deploy:** Docker Compose; optional GPU stack (Ollama, vLLM)

## Quick start (Docker, project name: ragline)

```bash
./setup.sh   # create .env, build, start infra, run migrations, start all
./start.sh   # start containers (backend --reload, frontend npm run dev; reload on save)
./stop.sh    # stop containers (data preserved)
```

Containers and volumes are named under the **ragline** project so they don’t clash with other compose stacks.

- App: http://localhost:3000  
- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  
- Adminer (DB): http://localhost:8080 — login with Server `postgres`, User `llmbuilder`, Password `llmbuilder`, Database `llmbuilder`  

Register a user and use **Knowledge** (upload docs, RAG), **Models** (Ollama/OpenAI/vLLM), **Deployments** (RAG + model + prompt), and **Chat**.

## Project layout

- `frontend/` — Next.js app
- `backend/` — FastAPI app, workers, migrations
- `docker-compose.yml` — all services (project name: **ragline**)
- `docker-compose.gpu.yml` — optional GPU inference
- `setup.sh` / `start.sh` / `stop.sh` — Docker lifecycle for this project only

## Users and login

There is a single user type: **admin**. The **first user you register** is admin and has full access. Every user is an admin (one role). Log in with email and password.
