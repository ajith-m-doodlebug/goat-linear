#!/usr/bin/env bash
# Rebuild and roll forward after code updates (no volume/data reset).
# Usage: ./build.sh [--no-cache]
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

NO_CACHE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-cache)
      NO_CACHE=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./build.sh [--no-cache]"
      echo "  Rebuild images, run migrations, and restart the stack without wiping data."
      exit 0
      ;;
    *)
      echo "[ragline] Unknown argument: $1"
      echo "Usage: ./build.sh [--no-cache]"
      exit 1
      ;;
  esac
done

echo "[ragline] === build (update code, preserve data) ==="
ragline_ensure_dotenv
ragline_host_models_pull_image_if_missing

if [[ "$NO_CACHE" -eq 1 ]]; then
  echo "[ragline] Building production images (no cache)..."
  ragline_base build --no-cache
else
  echo "[ragline] Building production images..."
  ragline_base build
fi

echo "[ragline] Starting postgres, redis, qdrant for migrations..."
ragline_base up -d postgres redis qdrant
ragline_wait_postgres
ragline_migrate

echo "[ragline] Restarting full stack..."
ragline_base up -d --remove-orphans
ragline_host_models_start_stopped_containers

echo "[ragline] Build/update complete (data preserved)."
ragline_print_service_urls
echo "[ragline] Logs: ./logs.sh   Stop: ./stop.sh   Dev reload: ./reload-start.sh"
