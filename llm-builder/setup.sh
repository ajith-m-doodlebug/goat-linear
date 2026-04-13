#!/usr/bin/env bash
# One-time clean slate: backup, destroy volumes, build prod images, reset DB, migrate.
# Brings Postgres/Redis/Qdrant up only for migrate, then tears them down (volumes kept). Run ./start.sh or ./reload-start.sh after.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

echo "[ragline] === setup (clean slate, migrate, then stop all containers) ==="
ragline_backup_if_possible
ragline_clean_slate
ragline_ensure_dotenv
ragline_host_models_pull_image_if_missing

echo "[ragline] Building production images..."
ragline_base build --no-cache

echo "[ragline] Starting postgres, redis, qdrant..."
ragline_base up -d postgres redis qdrant
ragline_wait_postgres
ragline_db_reset
ragline_migrate

ragline_host_models_precheck

echo "[ragline] Stopping data services (volumes kept; ./start.sh will bring everything up)..."
ragline_base down --remove-orphans

echo "[ragline] Setup done. No containers running."
ragline_print_service_urls
echo "[ragline] Production: ./start.sh   Development (hot reload): ./reload-start.sh"
echo "[ragline] Logs: ./logs.sh   Stop: ./stop.sh"
