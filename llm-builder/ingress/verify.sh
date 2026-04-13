#!/usr/bin/env sh
# Run on the Docker host after compose is up. Uses RAGLINE_API_PORT (default 8005) and optional HOST.
set -e
HOST="${1:-127.0.0.1}"
PORT="${RAGLINE_API_PORT:-8005}"
echo "Checking http://${HOST}:${PORT}/health ..."
curl -sfS "http://${HOST}:${PORT}/health" | head -c 200 && echo "" || exit 1
echo "Checking http://${HOST}:${PORT}/v1/models ..."
curl -sfS "http://${HOST}:${PORT}/v1/models" | head -c 400 && echo "" || exit 1
echo "OK: ingress routes /health (RAGLine) and /v1/models (vLLM)."
