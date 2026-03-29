#!/usr/bin/env bash
# Shared helpers for ragline (LLM Builder). Source from a script that sets SCRIPT_DIR to the repo root.
: "${SCRIPT_DIR:?SCRIPT_DIR must be set before sourcing _ragline_common.sh}"
cd "$SCRIPT_DIR" || exit 1

PROJECT="${RAGLINE_PROJECT:-ragline}"
BACKUP_ROOT="backup"

ragline_base() {
  docker compose -p "$PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" "$@"
}

ragline_dev() {
  docker compose -p "$PROJECT" -f "$SCRIPT_DIR/docker-compose.yml" -f "$SCRIPT_DIR/docker-compose.dev.yml" "$@"
}

ragline_backup_if_possible() {
  local backup_dir="${BACKUP_ROOT}/ragline-$(date +%Y%m%d-%H%M%S)"
  echo "[ragline] Checking for existing data to backup..."
  if ragline_base up -d postgres redis 2>/dev/null; then
    echo "[ragline] Waiting for postgres (up to 60s)..."
    local i
    for i in $(seq 1 30); do
      if ragline_base exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; then
        break
      fi
      if [ "$i" -eq 30 ]; then
        echo "[ragline] Postgres not ready; skipping backup."
      fi
      sleep 2
    done

    if ragline_base exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; then
      mkdir -p "$backup_dir"
      echo "[ragline] Backing up database to ${backup_dir}/postgres_dump.sql.gz ..."
      if ragline_base exec -T postgres pg_dump -U llmbuilder -d llmbuilder 2>/dev/null | gzip -c > "${backup_dir}/postgres_dump.sql.gz"; then
        echo "[ragline] Database backup saved."
      else
        rm -f "${backup_dir}/postgres_dump.sql.gz"
        echo "[ragline] Database backup skipped (empty or error)."
      fi

      if docker volume inspect "${PROJECT}_uploads_data" &>/dev/null; then
        echo "[ragline] Backing up uploads volume to ${backup_dir}/uploads_data ..."
        mkdir -p "${backup_dir}/uploads_data"
        docker run --rm -v "${PROJECT}_uploads_data:/data:ro" -v "${SCRIPT_DIR}/${backup_dir}/uploads_data:/out" alpine cp -a /data/. /out/ 2>/dev/null || true
        echo "[ragline] Uploads backup done."
      fi

      if docker volume inspect "${PROJECT}_qdrant_data" &>/dev/null; then
        echo "[ragline] Backing up Qdrant volume to ${backup_dir}/qdrant_storage ..."
        mkdir -p "${backup_dir}/qdrant_storage"
        docker run --rm -v "${PROJECT}_qdrant_data:/data:ro" -v "${SCRIPT_DIR}/${backup_dir}/qdrant_storage:/out" alpine cp -a /data/. /out/ 2>/dev/null || true
        echo "[ragline] Qdrant backup done."
      fi

      if [ -d "$backup_dir" ] && [ -n "$(ls -A "$backup_dir" 2>/dev/null)" ]; then
        echo "[ragline] Backup completed: ${backup_dir}"
      else
        rmdir "$backup_dir" 2>/dev/null || true
      fi
    fi
  fi
}

ragline_clean_slate() {
  echo "[ragline] Clean slate: tearing down stack (including dev volumes)..."
  ragline_dev down -v --remove-orphans --rmi local 2>/dev/null || true
  ragline_base down -v --remove-orphans --rmi local 2>/dev/null || true

  echo "[ragline] Removing any remaining project containers..."
  local cid
  while IFS= read -r cid; do
    [ -n "$cid" ] && docker rm -f "$cid" 2>/dev/null || true
  done < <(docker ps -aq --filter "label=com.docker.compose.project=${PROJECT}" 2>/dev/null || true)

  echo "[ragline] Removing any remaining project volumes (${PROJECT}_*)..."
  local vol
  for vol in \
    "${PROJECT}_postgres_data" \
    "${PROJECT}_qdrant_data" \
    "${PROJECT}_uploads_data" \
    "${PROJECT}_web_node_modules" \
    "${PROJECT}_web_next"; do
    docker volume rm -f "$vol" 2>/dev/null || true
  done
  while IFS= read -r vol; do
    [ -n "$vol" ] && docker volume rm -f "$vol" 2>/dev/null || true
  done < <(docker volume ls -q 2>/dev/null | grep "^${PROJECT}_" || true)

  echo "[ragline] Removing local frontend deps and build artifacts (host)..."
  rm -rf "${SCRIPT_DIR}/frontend/node_modules" "${SCRIPT_DIR}/frontend/.next"

  echo "[ragline] Pruning unused project network (if any left)..."
  docker network rm "${PROJECT}_default" 2>/dev/null || true

  echo "[ragline] Clean slate done."
}

ragline_ensure_dotenv() {
  if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
    echo "[ragline] Creating .env from .env.example"
    cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
    echo "[ragline] Please set SECRET_KEY in .env (e.g. openssl rand -hex 32)"
  fi
}

ragline_wait_postgres() {
  echo "[ragline] Waiting for postgres to be ready..."
  until ragline_base exec -T postgres pg_isready -U llmbuilder -d llmbuilder 2>/dev/null; do
    sleep 2
  done
}

ragline_db_reset() {
  echo "[ragline] Resetting database (drop all tables and data)..."
  ragline_base exec -T postgres psql -U llmbuilder -d llmbuilder -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
}

ragline_migrate() {
  echo "[ragline] Running migrations..."
  ragline_base run --rm app alembic upgrade head
}
