#!/usr/bin/env bash
# Start ragline (LLM Builder) with reload on save: backend (--reload), frontend (npm run dev).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
docker compose -p ragline -f docker-compose.yml -f docker-compose.dev.yml up -d
echo "[ragline] Backend (--reload) and frontend (npm run dev) will reload on save."
echo "[ragline] App: http://localhost:3000  API: http://localhost:8000"
echo "[ragline] Streaming logs (Ctrl+C to stop following; containers keep running)..."
docker compose -p ragline -f docker-compose.yml -f docker-compose.dev.yml logs -f
