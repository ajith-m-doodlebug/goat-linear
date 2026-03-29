#!/usr/bin/env bash
# Production: start or recreate containers (no logs; use ./logs-prod.sh).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_base up -d
echo "[ragline] Production stack up."
echo "[ragline] App: http://localhost:${RAGLINE_UI_PORT:-3000}  API: http://localhost:${RAGLINE_API_PORT:-8000}"
echo "[ragline] Logs: ./logs-prod.sh"
