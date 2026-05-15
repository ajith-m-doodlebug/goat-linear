# Deploy RAGLine (llm-builder) on a GPU server

This guide uses the lifecycle scripts in this repo: `setup.sh`, `start.sh`, `logs.sh`, `stop.sh` (see README for `./reload-start.sh` for local dev with hot reload).

## Prerequisites

- **Docker** and **Docker Compose** (plugin) installed.
- **NVIDIA driver** and **NVIDIA Container Toolkit** on the host so `docker run --gpus all` works.
- Quick GPU check:

  ```bash
  docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
  ```

- Firewall: open the **UI** port and the **public API** port (`RAGLINE_API_PORT`, default `8005`). The **ingress** nginx service on that port routes `/api/` and `/hosted/` to RAGLine and `/v1/` to vLLM on the host. You do **not** need to publish the FastAPI container or vLLM to the internet separately if you use this layout; keep vLLM reachable only via `VLLM_PROXY_HOST` / `VLLM_PROXY_PORT` (defaults: `host.docker.internal:8010`). If you expose Host Model ports directly for debugging, open those too.

### Docker image storage on `/data` (recommended when `/` is small)

vLLM images are large; pulls use Docker’s **data root** (often `/var/lib/docker` on `/`). If **`df -h /`** shows little free space but **`/data`** is on a bigger disk (or you dedicate space there), move Docker’s data root:

1. **Stop Docker:** `sudo systemctl stop docker` (and `sudo systemctl stop containerd` if present and required on your distro).
2. **Target dir:** `sudo mkdir -p /data/docker`.
3. **Migrate existing data** (first time only; skip if this is a new machine and you can wipe images):
   `sudo rsync -aP /var/lib/docker/ /data/docker/`
4. **Configure** `/etc/docker/daemon.json` — merge with any existing JSON. At minimum add **`data-root`** (preserve other keys such as NVIDIA runtime if already set):

   ```json
   {
     "data-root": "/data/docker"
   }
   ```

5. **Start Docker:** `sudo systemctl start docker`.
6. **Verify:** `docker info | grep "Docker Root Dir"` → should show **`/data/docker`**.

If **`/data`** is on the **same disk** as `/` (same `df` device), moving `data-root` to `/data/docker` **does not add space**—it only changes layout. To actually gain capacity, mount a **larger volume** at `/data` (or set `data-root` to a path on another disk). After `data-root` points at a disk with enough free space, **`docker pull`** / Host Models vLLM starts use that location.

### containerd still on `/` (errors mention `/var/lib/containerd`)

`docker info` can show **`Docker Root Dir: /data/docker`**, but **`docker pull`** may still write to **containerd’s** content store under **`/var/lib/containerd`** on the **root** disk—so you still see **`no space left on device`** with paths like **`.../containerd/.../ingest/...`**.

Move containerd’s **root** to **`/data`** (same large disk as `/data/models`):

1. **Stop:** `sudo systemctl stop docker` then `sudo systemctl stop containerd`.
2. **Directory:** `sudo mkdir -p /data/containerd`.
3. **Migrate** (first time; skip on fresh install):  
   `sudo rsync -aP /var/lib/containerd/ /data/containerd/`
4. **Edit** `/etc/containerd/config.toml` — set the **`root`** line to **`/data/containerd`** (default is **`/var/lib/containerd`**). Leave **`state`** as **`/run/containerd`** unless your distro docs say otherwise. Back up the file before editing.
5. **Start:** `sudo systemctl start containerd` then `sudo systemctl start docker`.
6. **Check:** `docker pull hello-world` then **`docker pull vllm/vllm-openai:latest`** (or your **`HOST_MODELS_VLLM_IMAGE`**) and **`docker pull ghcr.io/ggml-org/llama.cpp:server-cuda`** (or your **`HOST_MODELS_LLAMACPP_IMAGE`**). `./setup.sh` pulls both if missing.

If **`/etc/containerd/config.toml`** does not exist, your Docker package may manage containerd differently—see your distro’s Docker Engine + containerd docs.

## 1. Get the code on the server

Clone or copy this repository, then:

```bash
cd /path/to/llm-builder
```

## 2. Configure `.env`

Copy from example if needed:

```bash
cp .env.example .env
```

Set at least:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Strong random secret (e.g. `openssl rand -hex 32`) |
| `RAGLINE_UI_PORT` | Host port for the web UI (e.g. `3005`) |
| `RAGLINE_API_PORT` | Host port for **ingress** (browser + `curl`); nginx listens here and proxies `/api/` → app, `/v1/` → vLLM (default `8005`) |
| `VLLM_PROXY_HOST` | (Optional) Hostname the **ingress** container uses to reach vLLM (default `host.docker.internal`) |
| `VLLM_PROXY_PORT` | (Optional) Host port where vLLM listens (default `8010`; must match your Host Models instance) |
| `HOST_MODELS_PUBLIC_BASE_URL` | Base URL for hosted vLLM **as seen by clients** (scheme + host, no path unless you embed the port here instead of using `HOST_MODELS_REGISTER_HTTP_PORT`) |
| `HOST_MODELS_REGISTER_HTTP_PORT` | (Recommended with ingress) Set to **`RAGLINE_API_PORT`** (e.g. `8005`) so Host Models / **Register in Models** use `http://YOUR_HOST:8005` while the vLLM container still publishes the instance port you chose (e.g. `8010`) on the host for the proxy |
| `HOST_MODELS_HF_CACHE_DIR` | **Absolute host path** for optional vLLM Hugging Face **hub** cache (e.g. `/data/hf-cache`); model weights always come from a **local directory** path in the Host Models UI |
| `HOST_MODELS_LOCAL_PATH_PREFIX` | (Optional) Restrict `local_path` models to under this absolute host path (e.g. `/data/models`) |

**CORS:** For typical UI ports (not `80` / `443`), the API allows any browser origin that matches `http(s)://<host>:<RAGLINE_UI_PORT>`, so you do not list your public IP. If the UI is served on port **80** or **443**, set **`CORS_ALLOW_ORIGINS`** in `.env` to your real UI origins (comma-separated).

Create cache (and optional models) directories on the **host**:

```bash
sudo mkdir -p /data/hf-cache /data/models
sudo chown -R "$USER:$USER" /data/hf-cache /data/models
```

- **`/data/hf-cache`**: Optional vLLM Hugging Face **hub** cache volume (not required if everything is offline-local). Host Models uses **local directories** for weights; place self-downloaded models under e.g. **`/data/models`** and point the UI at that path.
- **`/data/models`**: Recommended root for self-downloaded weights; set `HOST_MODELS_LOCAL_PATH_PREFIX` to restrict the UI to paths under here.

These paths are **host** paths. Host Models mounts them into **vLLM** containers Docker starts; they do not need to exist inside the `app` image.

## 3. First-time setup

From the repo root:

```bash
chmod +x setup.sh start.sh reload-start.sh stop.sh logs.sh
./setup.sh
./start.sh
```

`./setup.sh` (destructive for this compose project):

- Backs up what it can, then **clean slate** (destroys existing compose volumes for this project).
- Builds **production** images, starts Postgres/Redis/Qdrant, resets the DB schema, runs **Alembic migrations**.
- Runs **Host Models precheck** (Docker socket, env hints, GPU smoke test).
- Runs **`docker compose down`** so **no containers** are left running (volumes kept).

Then `./start.sh` brings up the full stack. After reboots or routine restarts, use `./start.sh` only.

**Note:** `./setup.sh` wipes RAGLine data for this compose project. Use `./start.sh` for normal restarts.

### Migration edge case

If Alembic fails with **duplicate table** for `host_model_instances` (table already exists but revision not stamped), after confirming the table is correct:

```bash
docker compose -p ragline -f docker-compose.yml run --rm app alembic stamp 011
```

(Project name defaults to `ragline`; override with `RAGLINE_PROJECT` if you use it.)

## 4. Verify

- **RAGLine health (through ingress):** `http://YOUR_HOST:${RAGLINE_API_PORT}/health`
- **vLLM OpenAI API (through ingress):** `http://YOUR_HOST:${RAGLINE_API_PORT}/v1/models`
- **UI:** `http://YOUR_HOST:${RAGLINE_UI_PORT}`
- Optional script (from repo root, after `./start.sh`): `chmod +x ingress/verify.sh && ./ingress/verify.sh YOUR_HOST`
- Complete the setup wizard if this is a fresh database.

### Single public URL for models (`/v1/chat/completions` on the API port)

With **ingress**, `POST http://YOUR_HOST:${RAGLINE_API_PORT}/v1/chat/completions` is proxied to vLLM. Register **Ragline (Self Hosted)** models with **endpoint base** `http://YOUR_HOST:${RAGLINE_API_PORT}` (no path). Set **`HOST_MODELS_PUBLIC_BASE_URL`** to the same host (and use that port in the UI when creating host models) so generated URLs stay consistent.

### Host Models (vLLM)

1. Open **Dashboard → Host Models**.
2. Create a hosted instance (pick a free host port, e.g. `8010`) with an absolute model directory on the Docker host.
3. When healthy, use **Register in Models**, then test from **Models**.

Optional diagnostics: `GET /api/v1/host-models/preflight` (admin) reports Docker socket, CLI, cache path, and GPU smoke checks.

#### Rebuild API after Host Models / Dockerfile changes

The `app` image bundles a **static Docker CLI** so the API can run `docker` against the mounted host socket. Host paths in `.env` (for example `/usr/bin/docker` on the server) are **not** visible inside the container unless you bake them into the image.

From the repo root (compose project name `ragline` matches `./start.sh`; override with `RAGLINE_PROJECT` if you use it):

```bash
docker compose -p ragline -f docker-compose.yml build --no-cache app worker ingress
docker compose -p ragline -f docker-compose.yml up -d postgres redis qdrant
# wait until Postgres is ready, then:
docker compose -p ragline -f docker-compose.yml run --rm app alembic upgrade head
docker compose -p ragline -f docker-compose.yml up -d --force-recreate app worker
```

If you use **`./reload-start.sh`**, use the same `-f docker-compose.yml -f docker-compose.dev.yml` flags (and project name) in place of the single-file commands above, then **`./stop.sh && ./reload-start.sh`** so the dev stack picks up the new image.

## 5. Day-to-day operations

| Action | Command |
|--------|---------|
| Start / recreate stack | `./start.sh` |
| Follow logs (default) | `./logs.sh` |
| Logs for specific services | `./logs.sh app web` |
| One-shot logs | `./logs.sh --no-follow app` |
| Stop (volumes kept) | `./stop.sh` |

## 6. Ports reference

From `docker-compose.yml` (defaults; yours may differ via `.env`):

- **Ingress (public API + vLLM path):** `${RAGLINE_API_PORT:-8005}` → nginx listens on the same port inside its container; routes `/api/`, `/hosted/`, `/health`, `/docs`, … to **`app:8000`**, and **`/v1/`** to **`${VLLM_PROXY_HOST:-host.docker.internal}:${VLLM_PROXY_PORT:-8010}`**
- **App (FastAPI):** not published on the host by default; reachable as `app:8000` on the Compose network only
- UI: `${RAGLINE_UI_PORT:-3000}` → container `3000`
- Postgres `5432`, Redis `6379`, Qdrant `6333`, Adminer `8096`

**Host Models:** each vLLM container still publishes the **host port** you choose in the UI (e.g. `8010` on `0.0.0.0` or `127.0.0.1`). **`VLLM_PROXY_PORT`** must match that port so ingress can reach vLLM.

## Summary checklist

- [ ] GPU works in Docker (`nvidia-smi` in CUDA container)
- [ ] `.env` filled (SECRET_KEY, `RAGLINE_UI_PORT`, `RAGLINE_API_PORT`, Host Models vars). Rebuild **`web`** after changing API port so the UI bundle picks it up.
- [ ] `/data/hf-cache` (and `/data/models` if using local paths) exist on host; Docker **`data-root`** on `/data` if root disk is small (see above)
- [ ] `./setup.sh` once, then `./start.sh` after reboots
- [ ] Host Models: create/start succeeds (or call `GET /api/v1/host-models/preflight` if you want a Docker/GPU diagnostic)
