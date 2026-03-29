#!/usr/bin/env bash
# Production: stop containers. Data volumes are kept.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_base down
echo "[ragline] Production stack stopped (volumes preserved)."
