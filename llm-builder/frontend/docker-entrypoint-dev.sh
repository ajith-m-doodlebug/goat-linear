#!/usr/bin/env sh
set -e
cd /app

lock_hash() {
  sha256sum package-lock.json 2>/dev/null | awk '{print $1}' || true
}

HOST_HASH="$(lock_hash)"
IMAGE_HASH="$(cat /built-deps/.lock-sha 2>/dev/null || true)"
STAMP_FILE="/app/node_modules/.ragline-lock-sha"

needs_install() {
  [ ! -f /app/node_modules/next/package.json ] && return 0
  [ ! -f "$STAMP_FILE" ] && return 0
  [ "$(cat "$STAMP_FILE" 2>/dev/null)" != "$HOST_HASH" ] && return 0
  return 1
}

if [ -z "$HOST_HASH" ]; then
  echo "[web] package-lock.json missing; run npm install on the host or restore the lockfile."
  exit 1
fi

if needs_install; then
  if [ -n "$IMAGE_HASH" ] && [ "$HOST_HASH" = "$IMAGE_HASH" ]; then
    echo "[web] Populating node_modules from image (lock matches build)..."
    find /app/node_modules -mindepth 1 -delete 2>/dev/null || true
    cp -a /built-deps/node_modules/. /app/node_modules/
  else
    echo "[web] Lockfile differs from image or fresh volume; running npm ci..."
    export NODE_ENV=development
    npm ci --no-audit --no-fund
  fi
  echo "$HOST_HASH" > "$STAMP_FILE"
fi

exec "$@"
