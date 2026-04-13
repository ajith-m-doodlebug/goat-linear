#!/usr/bin/env bash
# Start the full stack with dev overlay (bind mounts, uvicorn --reload, Next dev).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_dev up -d
echo "[ragline] Stack up (dev: backend --reload, Next dev)."
ragline_print_service_urls
echo "[ragline] Logs: ./logs.sh   Stop: ./stop.sh   Production: ./start.sh"
