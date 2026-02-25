# LLM Builder – Operator runbook

## Start / stop

This project uses the Docker Compose project name **goat** (containers and volumes are scoped to it).

- **First-time setup:** `./setup.sh` (creates .env, builds, starts infra, runs migrations, starts all)
- **Start all services:** `./start.sh` (uses dev override: backend `--reload`, frontend `npm run dev`; reload on save)
- **Stop:** `./stop.sh` or `docker compose -p goat down`
- **View logs:** `docker compose -p goat -f docker-compose.yml -f docker-compose.dev.yml logs -f app` (or `worker`, `web`, …)

## Health and readiness

- **API health:** `GET http://localhost:8000/health` → `{"status": "ok"}`
- **Readiness (DB + Redis):** `GET http://localhost:8000/ready` → 200 or 503

## Database

- **Adminer (DB UI):** http://localhost:8080 — System: PostgreSQL, Server: `postgres`, User: `llmbuilder`, Password: `llmbuilder`, Database: `llmbuilder`
- **Run migrations:** from repo root, `cd backend && alembic upgrade head`
- **Backup PostgreSQL:** `docker compose exec postgres pg_dump -U llmbuilder llmbuilder > backup.sql`
- **Restore:** `docker compose exec -T postgres psql -U llmbuilder llmbuilder < backup.sql`

## Qdrant

- **Data directory:** Docker volume `qdrant_data`; Qdrant stores under `/qdrant/storage`.
- **Backup:** copy the volume or use Qdrant snapshot API if needed.

## Environment

- Copy `.env.example` to `.env` and set at least:
  - `SECRET_KEY` (use `openssl rand -hex 32`)
  - `DATABASE_URL` if not using default
  - `REDIS_URL` if not using default
- Frontend: `NEXT_PUBLIC_API_URL` must point to the API (e.g. `http://localhost:8000` for local dev).

## Scaling

- **Workers:** run more worker containers: `docker compose up -d --scale worker=3`
- **API:** put a load balancer in front of multiple `app` replicas; ensure shared DB and Redis.

## Optional: GPU

- Use `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d` to add Ollama (and optionally vLLM) with GPU.
- Requires NVIDIA Container Toolkit.
