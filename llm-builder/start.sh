#!/usr/bin/env bash
# Start goat (LLM Builder) with reload on save: backend (--reload), frontend (npm run dev).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
docker compose -p goat -f docker-compose.yml -f docker-compose.dev.yml up -d
echo "[goat] Backend (--reload) and frontend (npm run dev) will reload on save."
echo "[goat] App: http://localhost:3000  API: http://localhost:8000"
echo "[goat] Streaming logs (Ctrl+C to stop following; containers keep running)..."
docker compose -p goat -f docker-compose.yml -f docker-compose.dev.yml logs -f
