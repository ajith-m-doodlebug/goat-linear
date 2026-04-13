#!/usr/bin/env bash
# Start the full stack (production images, no bind mounts / reload).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_base up -d
ragline_host_models_start_stopped_containers
echo "[ragline] Stack up (production mode)."
ragline_print_service_urls
echo "[ragline] Logs: ./logs.sh   Stop: ./stop.sh   Dev reload: ./reload-start.sh"
