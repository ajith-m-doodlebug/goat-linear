#!/usr/bin/env bash
# Rebuild the app image then reset DB. Only needed if you're NOT using dev compose
# (e.g. production docker-compose.yml without volume mounts). For local dev, use
# ./scripts/reset-db.sh instead; it uses docker-compose.dev.yml so backend is
# mounted and no rebuild is needed.
# Run from project root.

set -e
cd "$(dirname "$0")/.."

echo "Rebuilding app image (includes latest Alembic migrations)..."
docker compose build app

echo ""
echo "Running database reset (with plain compose, no dev mount)..."
docker compose -f docker-compose.yml up -d postgres
sleep 3
docker compose -f docker-compose.yml stop app worker 2>/dev/null || true
docker compose -f docker-compose.yml exec -T postgres psql -U llmbuilder -d postgres -c "DROP DATABASE IF EXISTS llmbuilder;"
docker compose -f docker-compose.yml exec -T postgres psql -U llmbuilder -d postgres -c "CREATE DATABASE llmbuilder;"
docker compose -f docker-compose.yml run --rm app alembic upgrade head
docker compose -f docker-compose.yml start app worker
echo "Done."
