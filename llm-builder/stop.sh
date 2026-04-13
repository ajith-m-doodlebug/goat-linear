#!/usr/bin/env bash
# Stop and remove application containers; named volumes (Postgres, Qdrant, uploads, etc.) are kept.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_dev down --remove-orphans 2>/dev/null || true
ragline_base down --remove-orphans
ragline_host_models_stop_running_containers
echo "[ragline] Stack stopped (volumes preserved)."
