# LLM Builder On-Premise

Fully on-premises AI infrastructure platform: data ingestion, RAG, fine-tuning, model registry, deployments, and chat with enterprise governance.

## Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, Alembic, Redis (RQ), PostgreSQL, Qdrant
- **Deploy:** Docker Compose; GPU used on the host for Host Models (vLLM) or a local Ollama install when configured

## Lifecycle scripts (project name: **ragline**)

| Script | Purpose |
|--------|---------|
| `./setup.sh` | One-time **clean slate**: backup, destroy volumes, build **production** images, reset DB, migrate. Temporarily starts Postgres/Redis/Qdrant for migrate, then **`down`** so **no containers** run until `./start.sh` or `./reload-start.sh`. |
| `./build.sh` | After pulling code updates: rebuild production images, run migrations, and restart stack (**data preserved**). |
| `./start.sh` | Start the full stack (production images, no bind mounts). |
| `./reload-start.sh` | Start the full stack in **dev** mode (`docker-compose.dev.yml`: bind mounts, uvicorn `--reload`, Next dev). |
| `./stop.sh` | Stop the stack; **volumes preserved**. |
| `./logs.sh` | Container logs (default: follow, tail 200). Examples: `./logs.sh app web`, `./logs.sh --no-follow app`. |

Typical flows:

```bash
chmod +x setup.sh build.sh start.sh reload-start.sh stop.sh logs.sh

# First time (or full reset)
./setup.sh
./start.sh          # production
# or
./reload-start.sh   # local development with hot reload

# Day to day
./build.sh          # after git pull / code updates
./start.sh          # or ./reload-start.sh
./logs.sh
./stop.sh
```

Shared logic lives in `_ragline_common.sh`. Override the compose project with `RAGLINE_PROJECT=name` if needed.

Containers and volumes are named under the **ragline** project so they don’t clash with other compose stacks.

- **URLs:** Scripts print App, API, and Docs from **`RAGLINE_UI_PORT`** and **`RAGLINE_API_PORT`** in `.env` (defaults `3000` / `8005`). **`RAGLINE_API_PORT`** is the **ingress** port: nginx routes `/api/` to FastAPI and `/v1/` to vLLM on the host. The browser calls the API on **the same hostname** as the UI at that port.  
- Adminer (DB): http://localhost:8096 — login with Server `postgres`, User `llmbuilder`, Password `llmbuilder`, Database `llmbuilder`  

Register a user and use **Knowledge** (upload docs, RAG), **Models** (Ollama/OpenAI/vLLM), **Deployments** (RAG + model + prompt), and **Chat**.

## Project layout

- `frontend/` — Next.js app
- `backend/` — FastAPI app, workers, migrations
- `docker-compose.yml` — all services (project name: **ragline**); **`ingress/`** — nginx: public `RAGLINE_API_PORT` routes `/api/` → app and `/v1/` → vLLM
- `docker-compose.dev.yml` — optional overlay for `./reload-start.sh` (bind mounts, reload)
- `_ragline_common.sh` — shared helpers for lifecycle scripts  
- `setup.sh`, `build.sh`, `start.sh`, `reload-start.sh`, `stop.sh`, `logs.sh` — lifecycle  

Server deploy details: **`DEPLOY-SERVER.md`**.

## Users and login

There is a single user type: **admin**. The **first user you register** is admin and has full access. Every user is an admin (one role). Log in with email and password.
