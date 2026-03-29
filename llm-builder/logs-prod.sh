#!/usr/bin/env bash
# Production: stream logs (Ctrl+C stops following only). Optional: ./logs-prod.sh app web postgres
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

ragline_base logs -f "$@"
