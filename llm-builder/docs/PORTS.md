# Port reference

Single reference for all ports so the main app and exported deployments can run side by side without conflicts.

## Main app (llm-builder)

| Service   | Host port | Container/internal | Purpose                    |
|-----------|-----------|--------------------|----------------------------|
| Web (UI)  | 3000      | 3000               | Next.js frontend           |
| API (app) | 8000      | 8000               | FastAPI backend            |
| Qdrant    | 6333      | 6333               | Vector DB                  |
| Postgres  | 5432      | 5432               | Database                   |
| Redis     | 6379      | 6379               | Queue / cache              |
| Adminer   | 8080      | 8080               | DB admin UI (optional)     |

- **API base URL:** `http://localhost:8000`
- **Qdrant (from host):** `http://localhost:6333`  
- **Qdrant (from app/worker in Docker):** `http://qdrant:6333` (set via `QDRANT_URL`)

## Exported deployment bundles

Each export gets **unique** host ports derived from the deployment ID so multiple exports can run with the main app.

| Service | Host port range | Container | Purpose                    |
|---------|------------------|-----------|----------------------------|
| API     | 8001–8999       | 8000      | Exported RAG API          |
| Qdrant  | 6334–6433       | 6333      | Exported vector store     |

- **API:** `api_port = 8001 + (hash(deployment_id) % 999)` → avoids main app 8000.
- **Qdrant:** `qdrant_port = 6334 + (hash(deployment_id) % 100)` → avoids main Qdrant 6333.
- Exact ports for a given export are in that bundle’s `README.md` and `docker-compose.yml`.

## Ollama (optional)

| Where        | Default URL / port |
|-------------|---------------------|
| Host        | `http://localhost:11434` |
| From Docker | `http://host.docker.internal:11434` (Mac/Windows) or host IP |

Used by the main app and by exported servers when the deployment model is Ollama.

## Test script

- **Default URL:** `http://localhost:8001` (typical first export).
- **Override:** `python scripts/test_exported_api.py --port 8374` or `--url http://localhost:8374`.
- Port for each export is in that export’s README after you run `docker compose up`.
