#!/usr/bin/env bash
# Production: clean slate (optional backup), build production images, reset DB, migrate, start stack (no bind mounts).
# Use on a server after uploading the codebase: copy .env from .env.example, set SECRET_KEY and URLs, then run this.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

echo "[ragline] === Production setup ==="
ragline_backup_if_possible
ragline_clean_slate
ragline_ensure_dotenv

echo "[ragline] Building production images..."
ragline_base build --no-cache

echo "[ragline] Starting postgres, redis, qdrant, postfix..."
ragline_base up -d postgres redis qdrant postfix
ragline_wait_postgres
ragline_db_reset
ragline_migrate

echo "[ragline] Starting full stack (production)..."
ragline_base up -d

echo "[ragline] Production setup done."
echo "[ragline] App: http://localhost:${RAGLINE_UI_PORT:-3000}  API: http://localhost:${RAGLINE_API_PORT:-8000}"
echo "[ragline] Start after reboot: ./start-prod.sh   Logs: ./logs-prod.sh   Stop: ./stop-prod.sh"
echo "[ragline] Set NEXT_PUBLIC_API_URL in .env to your public API URL if browsers reach the app from another host."
