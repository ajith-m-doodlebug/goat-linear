# LLM Builder – Operator runbook

## Start / stop

This project uses the Docker Compose project name **ragline** (containers and volumes are scoped to it).

- **First-time setup:** `./setup.sh` (creates .env, builds, starts infra, runs migrations, starts all)
- **Start all services:** `./start.sh` (uses dev override: backend `--reload`, frontend `npm run dev`; reload on save)
- **Stop:** `./stop.sh` or `docker compose -p ragline down`
- **View logs:** `docker compose -p ragline -f docker-compose.yml -f docker-compose.dev.yml logs -f app` (or `worker`, `web`, …)

## Health and readiness

- **API health:** `GET http://localhost:8000/health` → `{"status": "ok"}`
- **Readiness (DB + Redis):** `GET http://localhost:8000/ready` → 200 or 503

## Database

- **Adminer (DB UI):** http://localhost:8080 — System: PostgreSQL, Server: `postgres`, User: `llmbuilder`, Password: `llmbuilder`, Database: `llmbuilder`
- **Run migrations (Docker):** from repo root, run inside the app container so it uses the same `DATABASE_URL` as the app. Ensure the app image is up to date (includes the latest migration files):
  ```bash
  docker compose build app
  docker compose run --rm app alembic upgrade head
  ```
  If you run `alembic` on the host (`cd backend && alembic upgrade head`), it uses the default URL (localhost + user `llmbuilder`). Use that only if your local Postgres has the `llmbuilder` role; otherwise run migrations via Docker as above.
- **“Can't locate revision identified by '006'”:** The app image was built before that migration existed. Rebuild the image, then run migrations: `docker compose build app` then the commands below.
- **“relation already exists” / out-of-sync history:** If the DB already has tables but the `alembic_version` table is missing or empty, Alembic will try to re-run from 001 and fail. Stamp the DB at the revision that matches your current schema, then upgrade (after a fresh `docker compose build app` if needed):
  ```bash
  docker compose run --rm app alembic stamp 006
  docker compose run --rm app alembic upgrade head
  ```
  (Use a different revision if your schema is at a different point; 006 = before the deployments `is_hosted`/`live_version` change.)
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
