#!/bin/sh
set -e
export RAGLINE_API_PORT="${RAGLINE_API_PORT:-8005}"
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
envsubst '${RAGLINE_API_PORT}' \
  </templates/default.conf.template >/etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
