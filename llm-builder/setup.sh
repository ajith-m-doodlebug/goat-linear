#!/usr/bin/env bash
# Setup LLM Builder (goat): env, build, start infra, run migrations.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT="goat"

echo "[goat] Setting up..."
if [[ ! -f .env ]]; then
  echo "[goat] Creating .env from .env.example"
  cp .env.example .env
  echo "[goat] Please set SECRET_KEY in .env (e.g. openssl rand -hex 32)"
fi

echo "[goat] Building images..."
docker compose -p "$PROJECT" build

echo "[goat] Starting postgres, redis, qdrant..."
docker compose -p "$PROJECT" up -d postgres redis qdrant

echo "[goat] Waiting for postgres to be ready..."
until docker compose -p "$PROJECT" exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; do
  sleep 2
done

echo "[goat] Resetting database (drop all tables and data)..."
docker compose -p "$PROJECT" exec -T postgres psql -U llmbuilder -d llmbuilder -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[goat] Running migrations..."
docker compose -p "$PROJECT" run --rm app alembic upgrade head

echo "[goat] Starting all services..."
docker compose -p "$PROJECT" up -d

echo "[goat] Setup done. App: http://localhost:3000  API: http://localhost:8000  Docs: http://localhost:8000/docs"
echo "[goat] Use ./start.sh to start, ./stop.sh to stop."
