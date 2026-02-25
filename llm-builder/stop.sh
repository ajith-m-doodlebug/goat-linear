#!/usr/bin/env bash
# Stop goat (LLM Builder) containers only. Volumes and data are preserved.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
docker compose -p goat down
echo "[goat] Stopped."
