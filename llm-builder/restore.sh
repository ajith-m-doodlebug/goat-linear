#!/usr/bin/env bash
# Restore a backup created by ./setup.sh. Run when you want to restore data into a running stack.
# Usage: ./restore.sh backup/ragline-YYYYMMDD-HHMMSS
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ragline_common.sh"

usage() {
  echo "Usage: $0 <backup-dir>"
  echo "  Restore a backup created by ./setup.sh (e.g. backup/ragline-20260314-123456)."
  echo ""
  echo "Available backups:"
  for d in backup/ragline-* 2>/dev/null; do
    [ -d "$d" ] && echo "  $d"
  done
  echo ""
  echo "Prerequisites: ./start.sh (or at least Postgres up), then run this script."
  exit 1
}

BACKUP_DIR="$1"
if [ -z "$BACKUP_DIR" ]; then
  usage
fi

if [ ! -d "$BACKUP_DIR" ] && [ -d "${SCRIPT_DIR}/${BACKUP_DIR}" ]; then
  BACKUP_DIR="${SCRIPT_DIR}/${BACKUP_DIR}"
fi
if [ ! -d "$BACKUP_DIR" ]; then
  echo "[ragline] Error: backup directory not found: $1"
  usage
fi

DB_DUMP=""
[ -f "${BACKUP_DIR}/postgres_dump.sql.gz" ] && DB_DUMP="${BACKUP_DIR}/postgres_dump.sql.gz"
[ -z "$DB_DUMP" ] && [ -f "${BACKUP_DIR}/postgres_dump.sql" ] && DB_DUMP="${BACKUP_DIR}/postgres_dump.sql"
if [ -z "$DB_DUMP" ]; then
  echo "[ragline] Error: no postgres_dump.sql.gz or postgres_dump.sql in ${BACKUP_DIR}"
  exit 1
fi

echo "[ragline] Restoring from ${BACKUP_DIR}"

echo "[ragline] Ensuring Postgres is running..."
ragline_base up -d postgres redis qdrant
echo "[ragline] Waiting for postgres..."
until ragline_base exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; do
  sleep 2
done

echo "[ragline] Restoring database..."
ragline_base exec -T postgres psql -U llmbuilder -d llmbuilder -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
if [ "${DB_DUMP%.gz}" != "$DB_DUMP" ]; then
  gunzip -c "$DB_DUMP" | ragline_base exec -T postgres psql -U llmbuilder -d llmbuilder -q
else
  cat "$DB_DUMP" | ragline_base exec -T postgres psql -U llmbuilder -d llmbuilder -q
fi
echo "[ragline] Database restored."

if [ -d "${BACKUP_DIR}/uploads_data" ] && [ -n "$(ls -A "${BACKUP_DIR}/uploads_data" 2>/dev/null)" ]; then
  echo "[ragline] Restoring uploads volume..."
  docker run --rm -v "${PROJECT}_uploads_data:/data" -v "${BACKUP_DIR}/uploads_data:/backup:ro" alpine cp -a /backup/. /data/
  echo "[ragline] Uploads restored."
fi

if [ -d "${BACKUP_DIR}/qdrant_storage" ] && [ -n "$(ls -A "${BACKUP_DIR}/qdrant_storage" 2>/dev/null)" ]; then
  echo "[ragline] Restoring Qdrant volume..."
  docker run --rm -v "${PROJECT}_qdrant_data:/data" -v "${BACKUP_DIR}/qdrant_storage:/backup:ro" alpine cp -a /backup/. /data/
  echo "[ragline] Qdrant restored."
fi

echo "[ragline] Restarting app and worker to use restored data..."
ragline_base up -d

echo "[ragline] Restore done."
ragline_print_service_urls
