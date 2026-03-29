#!/usr/bin/env bash
# Dev: ensure stack is up (hot-reload), then stream logs (Ctrl+C stops following only).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_dev up -d
echo "[ragline] Dev stack up (backend --reload, Next dev). Edit files on the host to reload."
echo "[ragline] App: http://localhost:${RAGLINE_UI_PORT:-3000}  API: http://localhost:${RAGLINE_API_PORT:-8000}"
echo "[ragline] Streaming logs (Ctrl+C stops following; containers keep running)..."
ragline_dev logs -f "$@"
