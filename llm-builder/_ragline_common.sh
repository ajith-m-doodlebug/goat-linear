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

ragline_env_value() {
  local key="$1"
  local file="${SCRIPT_DIR}/.env"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  awk -F= -v k="$key" '$1==k {sub(/^[^=]*=/, ""); print; exit}' "$file"
}

ragline_env_value_trimmed() {
  local raw first last
  raw="$(ragline_env_value "$1")"
  raw="${raw//$'\r'/}"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  while [[ "${#raw}" -ge 2 ]]; do
    first="${raw:0:1}"
    last="${raw:$((${#raw} - 1)):1}"
    if [[ "$first" == '"' && "$last" == '"' ]]; then
      raw="${raw:1}"
      raw="${raw%?}"
      continue
    fi
    if [[ "$first" == "'" && "$last" == "'" ]]; then
      raw="${raw:1}"
      raw="${raw%?}"
      continue
    fi
    break
  done
  echo "$raw"
}

ragline_ui_port() {
  local v
  v="$(ragline_env_value_trimmed RAGLINE_UI_PORT)"
  echo "${v:-3000}"
}

ragline_api_port() {
  local v
  v="$(ragline_env_value_trimmed RAGLINE_API_PORT)"
  echo "${v:-8000}"
}

ragline_print_service_urls() {
  local ui api
  ui="$(ragline_ui_port)"
  api="$(ragline_api_port)"
  echo "[ragline] App: http://localhost:${ui}  API: http://localhost:${api}  Docs: http://localhost:${api}/docs"
}

ragline_host_models_image() {
  local v
  v="$(ragline_env_value_trimmed HOST_MODELS_VLLM_IMAGE)"
  echo "${v:-vllm/vllm-openai:latest}"
}

ragline_host_models_container_prefix() {
  local v
  v="$(ragline_env_value_trimmed RAGLINE_HOST_MODELS_CONTAINER_PREFIX)"
  echo "${v:-llmbuilder-vllm-}"
}

ragline_host_models_auto_start_enabled() {
  local v
  v="$(ragline_env_value_trimmed RAGLINE_HOST_MODELS_AUTO_START)"
  case "${v,,}" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

ragline_host_models_pull_image_if_missing() {
  local image
  image="$(ragline_host_models_image)"
  echo "[ragline] Host Models image check: ${image}"
  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "[ragline] Host Models image already present."
  else
    echo "[ragline] Pulling Host Models image..."
    docker pull "$image"
  fi

  local pull_llamacpp li_img v
  v="$(ragline_env_value_trimmed RAGLINE_HOST_MODELS_PULL_LLAMACPP)"
  case "${v,,}" in
    1|true|yes|on) pull_llamacpp=1 ;;
    *) pull_llamacpp=0 ;;
  esac
  if [[ "$pull_llamacpp" -eq 1 ]]; then
    li_img="$(ragline_env_value_trimmed HOST_MODELS_LLAMACPP_IMAGE)"
    [[ -z "$li_img" ]] && li_img="ghcr.io/ggml-org/llama.cpp:server-cuda"
    echo "[ragline] Host Models llama.cpp image check: ${li_img}"
    if docker image inspect "$li_img" >/dev/null 2>&1; then
      echo "[ragline] llama.cpp server image already present."
    else
      echo "[ragline] Pulling llama.cpp server image..."
      docker pull "$li_img"
    fi
  fi
}

ragline_host_models_start_stopped_containers() {
  local ids id name started skipped prefix pfx_list
  if ! ragline_host_models_auto_start_enabled; then
    echo "[ragline] Host Models auto-start disabled (set RAGLINE_HOST_MODELS_AUTO_START=1 to enable)."
    return 0
  fi
  prefix="$(ragline_host_models_container_prefix)"
  pfx_list="$prefix"$'\n'"llmbuilder-llamacpp-"
  ids="$(
    {
      while IFS= read -r pfx; do
        [[ -z "$pfx" ]] && continue
        docker ps -aq --filter "name=${pfx}" --filter "status=created" 2>/dev/null || true
        docker ps -aq --filter "name=${pfx}" --filter "status=exited" 2>/dev/null || true
      done <<< "$pfx_list"
    } | awk 'NF && !seen[$0]++'
  )"
  if [[ -z "$ids" ]]; then
    echo "[ragline] No stopped Host Models containers to start."
    return 0
  fi
  echo "[ragline] Starting existing Host Models containers..."
  started=0
  skipped=0
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    name="$(docker inspect --format '{{.Name}}' "$id" 2>/dev/null | sed 's#^/##')"
    if docker start "$id" >/dev/null 2>&1; then
      started=$((started + 1))
      continue
    fi
    skipped=$((skipped + 1))
    echo "[ragline] WARN: Could not start Host Models container ${name:-$id}; leaving it stopped."
  done <<< "$ids"
  echo "[ragline] Host Models start summary: started=${started} skipped=${skipped}"
  return 0
}

ragline_host_models_stop_running_containers() {
  local ids prefix pfx_list
  prefix="$(ragline_host_models_container_prefix)"
  pfx_list="$prefix"$'\n'"llmbuilder-llamacpp-"
  ids="$(
    {
      while IFS= read -r pfx; do
        [[ -z "$pfx" ]] && continue
        docker ps -q --filter "name=${pfx}" 2>/dev/null || true
      done <<< "$pfx_list"
    } | awk 'NF && !seen[$0]++'
  )"
  if [[ -z "$ids" ]]; then
    echo "[ragline] No running Host Models containers to stop."
    return 0
  fi
  echo "[ragline] Stopping running Host Models containers..."
  # shellcheck disable=SC2086
  docker stop $ids >/dev/null
}

ragline_host_models_precheck() {
  echo "[ragline] Host Models precheck (vLLM / llama.cpp control plane)..."
  echo "[ragline] Published ports from .env: UI $(ragline_ui_port)  API $(ragline_api_port)"
  if [[ ! -S /var/run/docker.sock ]]; then
    echo "[ragline] WARN: /var/run/docker.sock not found on host."
  else
    echo "[ragline] OK: /var/run/docker.sock present on host."
  fi

  local base_url
  base_url="$(ragline_env_value HOST_MODELS_PUBLIC_BASE_URL)"
  if [[ -z "$base_url" ]]; then
    echo "[ragline] WARN: HOST_MODELS_PUBLIC_BASE_URL not set in .env (defaults to http://localhost)."
  else
    echo "[ragline] OK: HOST_MODELS_PUBLIC_BASE_URL=$base_url"
  fi

  local hf_cache
  hf_cache="$(ragline_env_value HOST_MODELS_HF_CACHE_DIR)"
  if [[ -z "$hf_cache" ]]; then
    echo "[ragline] WARN: HOST_MODELS_HF_CACHE_DIR not set in .env (default /tmp/hf-cache)."
  elif [[ "$hf_cache" != /* ]]; then
    echo "[ragline] WARN: HOST_MODELS_HF_CACHE_DIR must be an absolute host path. Current: $hf_cache"
  else
    mkdir -p "$hf_cache" 2>/dev/null || true
    echo "[ragline] OK: HOST_MODELS_HF_CACHE_DIR=$hf_cache"
  fi

  if docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi >/dev/null 2>&1; then
    echo "[ragline] OK: Docker GPU runtime is available."
  else
    echo "[ragline] WARN: Docker GPU runtime check failed. Host Models start may fail."
  fi

}
