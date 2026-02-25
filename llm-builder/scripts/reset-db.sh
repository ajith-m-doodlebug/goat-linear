#!/usr/bin/env bash
# Drop the database, recreate it, and run migrations from scratch.
# Uses dev compose so backend is mounted: no image rebuild needed when you change migrations.
# Run from project root (parent of scripts/). Requires Docker Compose.

set -e
cd "$(dirname "$0")/.."

# Use dev override so app/worker have ./backend mounted; migrations run with host code
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml"

echo "Ensuring Postgres is running..."
$COMPOSE up -d postgres
echo "Waiting for Postgres to be ready..."
sleep 3

echo "Stopping app and worker (so they release DB connections)..."
$COMPOSE stop app worker 2>/dev/null || true

echo "Dropping database llmbuilder..."
$COMPOSE exec -T postgres psql -U llmbuilder -d postgres -c "DROP DATABASE IF EXISTS llmbuilder;"

echo "Creating database llmbuilder..."
$COMPOSE exec -T postgres psql -U llmbuilder -d postgres -c "CREATE DATABASE llmbuilder;"

echo "Running migrations (using mounted backend, no rebuild)..."
$COMPOSE run --rm app alembic upgrade head

echo "Starting app and worker..."
$COMPOSE start app worker

echo "Done. Database reset and migrations applied."
