# LLM Builder On-Premise

Self-hosted AI infrastructure platform: RAG, fine-tuning, deployments, chat, model registry.

## Running locally

1. Copy `.env.example` to `.env` and set `SECRET_KEY`, `DATABASE_URL`, etc.
2. Start infrastructure: `docker compose up -d postgres redis qdrant`
3. Run migrations: `cd backend && alembic upgrade head`
4. Start backend: `cd backend && uvicorn app.main:app --reload`
5. Start worker (optional, for document ingest): `cd backend && python -m app.workers.runner`
6. Start frontend: `cd frontend && npm install && npm run dev`
7. Open http://localhost:3000 — register a user and use Knowledge, Models, Deployments, Chat.

## Running with Docker Compose

From project root: `docker compose up --build`

- API: http://localhost:8000
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health — Readiness: http://localhost:8000/ready

## Operator guide

See [OPERATOR.md](OPERATOR.md) for start/stop, backups, scaling, and env vars.  
See [PORTS.md](PORTS.md) for the full port reference (main app vs exported deployments).
