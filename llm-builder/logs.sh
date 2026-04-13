#!/usr/bin/env bash
# Stream or print container logs (default: follow, tail 200).
# Examples: ./logs.sh   ./logs.sh app web   ./logs.sh --no-follow app   ./logs.sh --tail 300 postgres
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

FOLLOW=1
TAIL=200
SERVICES=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-follow)
      FOLLOW=0
      shift
      ;;
    --follow)
      FOLLOW=1
      shift
      ;;
    --tail)
      TAIL="${2:-200}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./logs.sh [--follow|--no-follow] [--tail N] [services...]"
      exit 0
      ;;
    *)
      SERVICES+=("$1")
      shift
      ;;
  esac
done

if [[ "$FOLLOW" -eq 1 ]]; then
  ragline_base logs -f --tail "$TAIL" "${SERVICES[@]}"
else
  ragline_base logs --tail "$TAIL" "${SERVICES[@]}"
fi
