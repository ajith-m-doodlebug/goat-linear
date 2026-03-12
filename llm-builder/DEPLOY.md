# Deploying llm-builder to a server

## Option 1: Build locally, send images + deploy package (no code on server, no registry)

You build on your machine, save the app images to a tar, and copy to the server only:
- the image tar
- `docker-compose.images.yml`
- `.env`

No source code and no registry.

---

### On your machine

1. **Build the images** (from the repo root, one level above `llm-builder`, or from inside `llm-builder`):

   ```bash
   cd llm-builder
   docker compose build
   ```

2. **Save the app/worker/web images to a single tar** (postgres, redis, qdrant are pulled on the server from the compose file). Make sure all three exist first (`docker images | grep ragline`):

   ```bash
   docker save ragline-app:latest ragline-worker:latest ragline-web:latest -o llm-builder-images.tar
   ```
   If `ragline-app` is missing, run `docker compose build` again (no cache: `docker compose build --no-cache app` if needed).

3. **Create a deploy folder** and put in it only what the server needs:

   ```bash
   mkdir -p deploy-package
   cp docker-compose.images.yml deploy-package/docker-compose.yml
   cp .env deploy-package/.env
   cp llm-builder-images.tar deploy-package/
   ```

4. **Copy the deploy package to the server** (no source code):

   ```bash
   scp -r deploy-package/* user@YOUR_SERVER:/path/on/server/llm-builder/
   # Or rsync:
   rsync -avz deploy-package/ user@YOUR_SERVER:/path/on/server/llm-builder/
   ```

---

### On the server

1. **Install Docker and Docker Compose** if not already installed.

2. **Edit `.env` for production** in `/path/on/server/llm-builder/`:
   - `SECRET_KEY` – e.g. `openssl rand -hex 32`
   - `NEXT_PUBLIC_API_URL` – URL the browser will use for the API (e.g. `http://YOUR_SERVER_IP:8000` or `https://api.yourdomain.com`)
   - On Linux, if Ollama runs on the host: `OLLAMA_DEFAULT_URL=http://172.17.0.1:11434` (or `host.docker.internal` on Mac/Windows)

3. **Load the images and start the stack**:

   ```bash
   cd /path/on/server/llm-builder
   docker load -i llm-builder-images.tar
   docker compose up -d
   ```

   Postgres, Redis, and Qdrant will be pulled automatically; app, worker, and web will use the images you loaded.

---

## Option 2: Copy repo and run on server

Server has the full repo and builds images there (or you can still build locally and load as in Option 1, but the server has the code).

- Copy the whole `llm-builder/` folder (e.g. `rsync` or `git clone`) and `.env` to the server.
- On server: `docker compose up -d` (builds from source).

---

## Option 3: Use a Docker registry

Build and push images to Docker Hub (or another registry); on the server use `docker-compose.registry.example.yml` plus `.env` with `REGISTRY_IMAGE=your-user/llm-builder`, then `docker compose pull && docker compose up -d`. No code on server; images are pulled from the registry.

---

## Ports

- **3000** – frontend (web)
- **8000** – backend API (app)
- **5432** – Postgres | **6379** – Redis | **6333** – Qdrant | **8080** – Adminer (optional)

Use a reverse proxy (nginx/Caddy) in front to expose only 80/443 and proxy to 3000 and 8000.
