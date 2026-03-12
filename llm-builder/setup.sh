#!/usr/bin/env bash
# Setup LLM Builder (ragline): env, build, start infra, run migrations.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT="ragline"

echo "[ragline] Setting up..."
if [[ ! -f .env ]]; then
  echo "[ragline] Creating .env from .env.example"
  cp .env.example .env
  echo "[ragline] Please set SECRET_KEY in .env (e.g. openssl rand -hex 32)"
fi

echo "[ragline] Removing stale volumes and cache..."
docker compose -p "$PROJECT" down -v 2>/dev/null || true
docker volume rm "${PROJECT}_web_node_modules" 2>/dev/null || true
rm -rf frontend/.next

echo "[ragline] Building images..."
docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.dev.yml build --no-cache web
docker compose -p "$PROJECT" build

echo "[ragline] Starting postgres, redis, qdrant..."
docker compose -p "$PROJECT" up -d postgres redis qdrant

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
