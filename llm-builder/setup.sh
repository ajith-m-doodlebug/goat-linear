#!/usr/bin/env bash
# Dev: clean slate (optional backup), build dev images, reset DB, migrate, start stack with hot-reload.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

echo "[ragline] === Dev setup ==="
ragline_backup_if_possible
ragline_clean_slate
ragline_ensure_dotenv

echo "[ragline] Building images (dev overlay, includes frontend dev stage)..."
ragline_dev build --no-cache

echo "[ragline] Starting postgres, redis, qdrant, postfix..."
ragline_base up -d postgres redis qdrant postfix
ragline_wait_postgres
ragline_db_reset
ragline_migrate

echo "[ragline] Starting full stack (dev: --reload, Next dev)..."
ragline_dev up -d

echo "[ragline] Dev setup done."
echo "[ragline] App: http://localhost:${RAGLINE_UI_PORT:-3000}  API: http://localhost:${RAGLINE_API_PORT:-8000}  Docs: http://localhost:${RAGLINE_API_PORT:-8000}/docs"
echo "[ragline] Follow logs: ./start.sh   Stop: ./stop.sh"
echo "[ragline] Production on a server: ./setup-prod.sh then ./start-prod.sh"
echo ""
echo "[ragline] Open the app to complete the initial setup wizard (super admin)."
