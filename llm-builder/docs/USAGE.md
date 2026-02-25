# How to use LLM Builder

## 1. Start the app

From the project root:

```bash
./setup.sh   # first time: create .env, build, migrate, start all
./start.sh   # later: start containers (logs stream; Ctrl+C only stops logs)
```

- **App (UI):** http://localhost:3000  
- **API:** http://localhost:8000  
- **API docs:** http://localhost:8000/docs  
- **Adminer (DB):** http://localhost:8080  

## 2. Register and log in

1. Open http://localhost:3000  
2. Click **Register** and create an account.  
3. **First user** registered is automatically **Super Admin**. All later sign-ups get the **User** role.  
4. You always log in the same way: **Login** with your email and password. Your role (Admin, Builder, etc.) is already set on your account; the app shows or hides menu items based on it.

### How to get Admin or Builder

- **Super Admin / Admin** can change roles. They use the API to promote users:  
  `PATCH /api/v1/users/{user_id}` with body `{ "role": "admin" }` or `{ "role": "builder" }` (requires Admin or Super Admin token).  
- Or set the role in the database (e.g. via Adminer at http://localhost:8080): table `users`, column `role` — values: `user`, `builder`, `admin`, `auditor`, `super_admin`).  
- If you need a second Admin/Builder and have no UI yet: log in as the first user (Super Admin), then either call the API (see http://localhost:8000/docs) or use Adminer to set another user’s `role` to `admin` or `builder`.

## 3. Upload files into a knowledge base (RAG)

Only users with the **Builder** role can create knowledge bases and upload files.

### Create a knowledge base

1. Go to **Knowledge** in the sidebar.  
2. Click **Create knowledge base**, enter a name (and optional description), then save.  
3. Select the new knowledge base in the list.

### Upload files

1. With a knowledge base selected, use the **file input** and choose one or more documents.  
2. Click **Upload**.

**Allowed file types:** `.txt`, `.pdf`, `.docx`, `.doc`, `.html`, `.htm`  
**Max file size:** 50 MB per file  

Uploaded files are processed in the background (text extraction → chunking → embedding → Qdrant). Document status appears in the table (pending → processing → completed or failed). You can click **Re-ingest** on a failed or completed document to run the pipeline again.

## 4. Models screen (how to use it)

The **Models** page lets you register LLM endpoints so you can use them in **Deployments** and **Chat**. You need the **Builder** role.

### What you see

- **Add model** — Opens a form to register a new model.
- **Registered models** — List of models you’ve added. Each has a **Test** button.
- **Test prompt** — When you click **Test** on a model, you can type a prompt and **Run** to see the model’s reply (to check it’s working).

### Adding a model

1. Click **Add model**.
2. Fill in the form:
   - **Name** — Label for this model (e.g. “My Llama”).
   - **Provider** — How the app talks to the model:
     - **Ollama** — Local Ollama server. Default URL is `http://localhost:11434`. If the API runs in Docker and Ollama is on your host, use `http://host.docker.internal:11434` (Mac/Windows) or your host IP.
     - **vLLM** — vLLM server (OpenAI-compatible). Set **Endpoint URL** to the vLLM base URL (e.g. `http://vllm:8000` if in the same Docker Compose).
     - **OpenAI-compatible** — Any OpenAI-style API (OpenAI, Azure, other). Set **Endpoint URL** (e.g. `https://api.openai.com`) and **API key** if required.
     - **Custom REST** — Same as OpenAI-compatible; use for other REST APIs that speak the OpenAI chat format.
   - **Endpoint URL** — Leave empty for Ollama to use `http://localhost:11434`; for vLLM/OpenAI/custom, set the base URL (no `/v1/...` path).
   - **Model ID** — The model name as the server knows it (e.g. `llama2`, `gpt-4`, `mistral`).
   - **API key** — Optional; required for OpenAI (or other paid APIs). Leave blank for Ollama and most self-hosted vLLM.
3. Click **Create**. The model appears in the list.

### Testing a model

1. Click **Test** next to a model.
2. Type a short prompt in the **Test prompt** box.
3. Click **Run**. The model’s reply appears below. If you get an error, check the endpoint URL (and that Ollama/vLLM is running and reachable from the API container).

### 502 Bad Gateway when testing a model

The API returns **502** when it cannot reach the model or the model returns an error. In the Test panel you should see the underlying message (e.g. "Connection refused", "404 Not Found"). Fixes:

- **Ollama**
  - **Connection refused / unreachable:** The app runs in Docker, so `http://localhost:11434` points at the container, not your host. Use **Endpoint URL** `http://host.docker.internal:11434` (Ollama on your Mac/PC) or `http://ollama:11434` (Ollama in the same Compose, e.g. with `docker-compose.gpu.yml`). Ensure Ollama is running and the chosen URL is reachable from the API container.
  - **404 / model not found:** Pull the model first, e.g. `ollama pull llama2`, and use that exact name as **Model ID**.
- **vLLM / OpenAI-compatible:** Check **Endpoint URL** and **API key**; ensure the service is up and reachable from the API container.

### Where are the Ollama models?

- **Ollama is not started by default.** The main stack (`./start.sh`) does not include Ollama. To run Ollama in Docker with GPU support, use the GPU compose file:
  ```bash
  docker compose -p goat -f docker-compose.yml -f docker-compose.gpu.yml up -d
  ```
  This starts the **ollama** service on port **11434**. The app container can reach it as `http://ollama:11434` (same Docker network). When adding a model in the UI, set provider **Ollama**, leave **Endpoint URL** empty or set `http://ollama:11434`, and set **Model ID** to the Ollama model name (e.g. `llama2`, `mistral`).

- **Or run Ollama on your host:** install [Ollama](https://ollama.com) locally and run `ollama pull llama2` (or another model). Then in the app, add a model with provider **Ollama**, **Endpoint URL** `http://host.docker.internal:11434` (so the API container can reach your host), and **Model ID** `llama2`.

- **Which model names to use:** Whatever you have pulled in Ollama. Run `ollama list` (on the host or inside the ollama container) to see names like `llama2`, `mistral`, `codellama`. Use that exact name as **Model ID** in the Models screen.

### After adding models

Use **Deployments** to combine a model with a knowledge base (RAG) and prompts; then use **Chat** and select that deployment to talk to the model (with RAG if you attached a knowledge base).

## 5. Deployments

Create a **deployment** to tie a **knowledge base** (RAG) to a **model** and a system/user prompt. Deployments are what **Chat** uses — pick a deployment there to start a conversation.

## 6. Chat

1. Go to **Chat**.  
2. Pick a **deployment** (RAG + model).  
3. Ask questions. Answers use RAG when the deployment has a knowledge base.

### What exactly happens when you ask a question in a deployment?

When you send a message in a chat that’s tied to a deployment, the following runs in order:

1. **Session and deployment**  
   The API loads the chat session and the **deployment** for that session (model, optional knowledge base, prompt template, memory turns, config).

2. **Conversation memory**  
   The last N conversation turns (user + assistant) for that session are loaded and passed as **chat history** (N is the deployment’s “memory turns”, e.g. 10).

3. **RAG (if the deployment has a knowledge base)**  
   - Your **question** is turned into a vector (embedding) and used to **search the knowledge base** in Qdrant.  
   - The top **top_k** matching chunks (default 10) are retrieved.  
   - Those chunks are concatenated into a **context** string, and **citations** (text, source, score) are kept for the UI.

4. **Prompt building**  
   - If the deployment has a **prompt template**, it is filled with placeholders: **{context}** (the retrieved chunks or “No relevant context found.”), **{question}** (your message), and optionally **{memory}** (recent chat history).  
   - If there’s no template, a default prompt tells the model to answer only from the context and to say when the answer is not in the document (to reduce wrong answers).

5. **LLM call**  
   The built prompt is sent to the deployment’s **model** (e.g. Ollama, OpenAI, vLLM). The model returns a single completion (no streaming in the current implementation).

6. **Save and return**  
   Your message and the assistant’s reply are stored in the database. The API returns the **response text** and **citations** to the frontend, which shows the answer (and any citations).

**In short:** Your question → (optional) retrieval from the knowledge base → prompt with context + question + history → one LLM call → answer and citations saved and shown.

## 7. Other features

- **Training:** Upload JSONL/JSON datasets and run fine-tuning jobs (Builder).  
- **Audit:** View audit logs (Admin/Auditor).  
- **API Keys:** Create API keys for programmatic access (Builder/Admin).

## Using an API key

Create keys under **API Keys** in the dashboard (Builder/Admin). The full key is shown only once at creation; store it securely.

Use the key by sending it in the **X-API-Key** header on every request. No Bearer token is needed when using the key.

**Example (curl):**

```bash
curl -s -H "X-API-Key: llmb_YOUR_KEY_HERE" http://localhost:8000/api/v1/auth/me
```

**Example (list models):**

```bash
curl -s -H "X-API-Key: llmb_YOUR_KEY_HERE" http://localhost:8000/api/v1/models
```

Your API key has the same permissions as your user (Builder, Admin, etc.). Use it for scripts, CI, or external apps instead of logging in to get a JWT.

## How training (fine-tuning) works

Training lets you run **fine-tuning jobs** from a dataset and a **base model** (e.g. Llama, Mistral). You need the **Builder** role.

### 1. Upload a dataset

- Go to **Training** in the sidebar.
- Under **Upload dataset (JSONL)**, choose a **JSONL** or **JSON** file and optionally a name, then click **Upload**.
- The file is stored under the app’s upload directory; the API records the dataset (id, name, format, row count).  
- **Dataset format:** One JSON object per line (JSONL). Typical structure for instruction fine-tuning: `{"instruction": "...", "input": "...", "output": "..."}` or `{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`. The app does not validate the schema; it only stores the file and counts lines.

### 2. Create a training job

- Click **New training job**.
- Select a **dataset** (one you uploaded) and a **base model** (one from **Models**).
- Click **Start job**.
- The API creates a **training job** (status `queued`), enqueues a background task for the **worker**, and returns the job id.

### 3. What runs in the background (worker)

- The **worker** (same RQ process that runs ingest) picks up the job.
- It loads the job, base model, and dataset from the DB; it does **not** read the dataset file content in the current implementation.
- **Current behavior (stub):** The worker does **not** run real fine-tuning (no PEFT/LoRA, no GPU training). It:
  - Sets the job status to `running`, then `completed`.
  - Creates a new **model registry** entry of type **fine_tuned**, linked to the base model (same provider, endpoint, model_id; name like `{base.name}-finetuned-{job_id}`).
  - Sets the job’s **result_model_id** to that new model and stores placeholder metrics (e.g. `loss: 0.5, steps: 100`).
- So in the UI you see a completed job and a new “fine-tuned” model; that model currently points at the **same** backend as the base (no real training has been run). Real fine-tuning would require integrating a training stack (e.g. Hugging Face Transformers + PEFT/LoRA, or an external training API) and storing/serving the adapter or new weights.

### 4. Jobs and result model

- **Training jobs** are listed in the table (ID, status, result model, created).
- Status flows: `queued` → `running` → `completed` or `failed` (with `error_message` if failed).
- On **completed**, **Result model** shows the new model’s id; that model appears under **Models** and can be used in **Deployments** and **Chat** like any other model (today it behaves like the base model because no real training runs).

## Safe file uploads

- Only the allowed extensions above are accepted.  
- Filenames are sanitized (no path traversal, safe characters).  
- Files over 50 MB are rejected with **413 Request Entity Too Large**.

## Troubleshooting: "File not found" on ingest

If documents stay in **failed** with an error like `File not found: /tmp/uploads/...`, the **app** (which saves the file) and the **worker** (which runs ingest) are not using the same upload directory. Do this:

1. **Use the same Compose setup for both**  
   Start with `./start.sh` (which uses `docker-compose.yml` + `docker-compose.dev.yml`). Both the API and the worker need the shared **uploads** volume and `UPLOAD_DIR=/tmp/uploads`.

2. **Restart so the volume is applied**  
   ```bash
   ./stop.sh
   ./start.sh
   ```

3. **Re-upload the files**  
   Old documents in the list may point to files that were saved before the shared volume existed. Upload the same files again; the new uploads will land on the shared volume and ingest should succeed. You can ignore or delete the old failed rows.

## RAG pipeline (hybrid retrieval)

The app uses **hybrid retrieval**: (1) a keyword-first pass scrolls the full KB and includes every chunk containing question terms (e.g. "Ajith", "rupees"); (2) vector search + keyword re-rank adds more chunks; (3) the model is prompted to state exact numbers/names from the context. If you still see "The document does not say", ensure the document is **completed** and click **Re-ingest**, then try again.

## Wrong or missing answers in RAG (e.g. “How much does X have?”)

If the model gives an incorrect answer or says it doesn’t know when the document actually contains the information:

1. **Check document status**  
   In **Knowledge**, ensure the document (e.g. Data-1.pdf) shows status **completed**. If it failed or is still processing, fix ingest first and **Re-ingest**.

2. **Use the citations**  
   The chat response can show **citations** (chunks that were sent to the model). Check whether the right sentence (e.g. “Ajith has X rupees”) appears there. If it doesn’t, retrieval may be missing that part of the document.

3. **Stricter prompt (already improved)**  
   The default RAG prompt now tells the model to answer **only from the context** and to say when the answer is not in the document. That reduces made-up numbers. Try asking again after a restart so the new prompt is used.

4. **More chunks (top_k)**  
   The app now retrieves **10** chunks by default (was 5). If the fact is in a chunk that wasn’t in the top 5, it may now be included. You can also add a **prompt template** (Deployments) with placeholders `{context}` and `{question}` and explicitly say “Answer only using the context; if not in the context, say so.”
