#!/bin/sh
set -e
export VLLM_PROXY_HOST="${VLLM_PROXY_HOST:-host.docker.internal}"
export VLLM_PROXY_PORT="${VLLM_PROXY_PORT:-8010}"
export RAGLINE_API_PORT="${RAGLINE_API_PORT:-8005}"
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
envsubst '${VLLM_PROXY_HOST} ${VLLM_PROXY_PORT} ${RAGLINE_API_PORT}' \
  </templates/default.conf.template >/etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
