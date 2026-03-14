#!/usr/bin/env bash
# Clean-slate setup for LLM Builder (ragline): backup existing data (if any), then remove everything, build, start infra, run migrations.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT="ragline"
BACKUP_ROOT="backup"
BACKUP_DIR="${BACKUP_ROOT}/ragline-$(date +%Y%m%d-%H%M%S)"

# ---- Backup existing data (if any) ----
echo "[ragline] Checking for existing data to backup..."
if docker compose -p "$PROJECT" -f docker-compose.yml up -d postgres redis 2>/dev/null; then
  echo "[ragline] Waiting for postgres (up to 60s)..."
  for i in $(seq 1 30); do
    if docker compose -p "$PROJECT" exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; then
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "[ragline] Postgres not ready; skipping backup."
    fi
    sleep 2
  done

  if docker compose -p "$PROJECT" exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; then
    mkdir -p "$BACKUP_DIR"
    echo "[ragline] Backing up database to ${BACKUP_DIR}/postgres_dump.sql.gz ..."
    if docker compose -p "$PROJECT" exec -T postgres pg_dump -U llmbuilder -d llmbuilder 2>/dev/null | gzip -c > "${BACKUP_DIR}/postgres_dump.sql.gz"; then
      echo "[ragline] Database backup saved."
    else
      rm -f "${BACKUP_DIR}/postgres_dump.sql.gz"
      echo "[ragline] Database backup skipped (empty or error)."
    fi

    if docker volume inspect "${PROJECT}_uploads_data" &>/dev/null; then
      echo "[ragline] Backing up uploads volume to ${BACKUP_DIR}/uploads_data ..."
      mkdir -p "${BACKUP_DIR}/uploads_data"
      docker run --rm -v "${PROJECT}_uploads_data:/data:ro" -v "${SCRIPT_DIR}/${BACKUP_DIR}/uploads_data:/out" alpine cp -a /data/. /out/ 2>/dev/null || true
      echo "[ragline] Uploads backup done."
    fi

    if docker volume inspect "${PROJECT}_qdrant_data" &>/dev/null; then
      echo "[ragline] Backing up Qdrant volume to ${BACKUP_DIR}/qdrant_storage ..."
      mkdir -p "${BACKUP_DIR}/qdrant_storage"
      docker run --rm -v "${PROJECT}_qdrant_data:/data:ro" -v "${SCRIPT_DIR}/${BACKUP_DIR}/qdrant_storage:/out" alpine cp -a /data/. /out/ 2>/dev/null || true
      echo "[ragline] Qdrant backup done."
    fi

    if [ -d "$BACKUP_DIR" ] && [ -n "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
      echo "[ragline] Backup completed: ${BACKUP_DIR}"
    else
      rmdir "$BACKUP_DIR" 2>/dev/null || true
    fi
  fi
fi

# ---- Clean slate ----
echo "[ragline] Clean slate: stopping and removing all containers, volumes, and project images..."
docker compose -p "$PROJECT" -f docker-compose.yml down -v --remove-orphans --rmi local 2>/dev/null || true
docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans --rmi local 2>/dev/null || true
# Remove web node_modules volume so next dev run does a clean npm install
docker volume rm "${PROJECT}_web_node_modules" 2>/dev/null || true
for vol in $(docker volume ls -q 2>/dev/null | grep "^${PROJECT}_" || true); do docker volume rm "$vol" 2>/dev/null || true; done
rm -rf frontend/.next
echo "[ragline] Clean slate done."

echo "[ragline] Setting up..."
if [[ ! -f .env ]]; then
  echo "[ragline] Creating .env from .env.example"
  cp .env.example .env
  echo "[ragline] Please set SECRET_KEY in .env (e.g. openssl rand -hex 32)"
fi

echo "[ragline] Building images..."
docker compose -p "$PROJECT" build --no-cache

echo "[ragline] Starting postgres, redis, qdrant, postfix..."
docker compose -p "$PROJECT" up -d postgres redis qdrant postfix

echo "[ragline] Waiting for postgres to be ready..."
until docker compose -p "$PROJECT" exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; do
  sleep 2
done

echo "[ragline] Resetting database (drop all tables and data)..."
docker compose -p "$PROJECT" exec -T postgres psql -U llmbuilder -d llmbuilder -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[ragline] Running migrations..."
docker compose -p "$PROJECT" run --rm app alembic upgrade head

echo "[ragline] Starting all services..."
docker compose -p "$PROJECT" up -d

echo "[ragline] Setup done. App: http://localhost:3000  API: http://localhost:8000  Docs: http://localhost:8000/docs"
echo "[ragline] Use ./start.sh to start, ./stop.sh to stop."
echo ""
echo "[ragline] Next: open http://localhost:3000 — you will be redirected to the initial setup wizard."
echo "[ragline] Complete setup (super admin, company name, allowed email domain). Optionally set up default model and prompt."
echo "[ragline] For user registration (OTP emails), configure SMTP_* in .env (see .env.example)."
