import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "Run LLM Builder with Docker, register your admin account, then use Knowledge, Models, Deployments, and Chat.",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4 font-mono text-sm leading-relaxed text-on-surface">
      <code>{children}</code>
    </pre>
  );
}

export default function GettingStartedPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-lg flex-1 px-6 py-12 md:px-12 md:py-16">
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <span className="intelligence-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Usage guide</span>
          </div>
          <h1 className="mb-4 font-headline text-4xl font-black tracking-tighter text-on-surface md:text-6xl">
            How to use LLM Builder
          </h1>
          <p className="max-w-2xl text-lg text-secondary">
            You run the stack from the <strong className="text-on-surface">llm-builder</strong>{" "}
            repository: Docker Compose brings up the web app, API, workers, PostgreSQL, Redis, and
            Qdrant. After the first user registers, you work through{" "}
            <strong className="text-on-surface">Knowledge</strong> →{" "}
            <strong className="text-on-surface">Models</strong> →{" "}
            <strong className="text-on-surface">Deployments</strong> →{" "}
            <strong className="text-on-surface">Chat</strong> in the console.
          </p>
        </div>

        <nav className="mb-12 flex flex-wrap gap-3 border-b border-outline-variant/10 pb-6 text-sm">
          {[
            ["#run-the-stack", "Run the stack"],
            ["#open-urls", "URLs"],
            ["#register", "Register & login"],
            ["#knowledge", "Knowledge"],
            ["#models", "Models"],
            ["#deployments", "Deployments"],
            ["#chat", "Chat"],
            ["#production", "Production"],
            ["#api-reference", "API docs"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-outline-variant/20 px-3 py-1 text-secondary transition-colors hover:border-primary/40 hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="space-y-16">
          <section id="run-the-stack">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">1. Run the stack</h2>
            <p className="mb-4 text-secondary">
              Clone the <strong className="text-on-surface">llm-builder</strong> repo and use the
              lifecycle scripts from the project root. Development mode uses bind mounts so code
              reloads on save.
            </p>
            <CodeBlock>{`./setup.sh   # clean slate, build dev images, migrate, start dev stack
./start.sh   # ensure stack is up; Ctrl+C stops log follow only`}</CodeBlock>
            <p className="mt-4 text-sm text-on-surface-variant">
              To stop without losing data: <code className="text-primary">./stop.sh</code>. Compose
              project name defaults to <strong className="text-on-surface">ragline</strong> so it
              does not clash with other stacks; override with{" "}
              <code className="text-primary">RAGLINE_PROJECT</code> if needed.
            </p>
          </section>

          <section id="open-urls">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">2. Open the URLs</h2>
            <p className="mb-4 text-secondary">
              With the dev stack running, these endpoints are available on your machine:
            </p>
            <ul className="mb-4 list-inside list-disc space-y-2 text-secondary">
              <li>
                <strong className="text-on-surface">Web app:</strong>{" "}
                <a
                  href="http://localhost:3000"
                  className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  http://localhost:3000
                </a>
              </li>
              <li>
                <strong className="text-on-surface">REST API:</strong>{" "}
                <a
                  href="http://localhost:8000"
                  className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  http://localhost:8000
                </a>
              </li>
              <li id="api-reference">
                <strong className="text-on-surface">Interactive API docs (OpenAPI):</strong>{" "}
                <a
                  href="http://localhost:8000/docs"
                  className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  http://localhost:8000/docs
                </a>
              </li>
              <li>
                <strong className="text-on-surface">Adminer (database UI):</strong>{" "}
                <a
                  href="http://localhost:8096"
                  className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  http://localhost:8096
                </a>{" "}
                — server <code className="text-on-surface">postgres</code>, user{" "}
                <code className="text-on-surface">llmbuilder</code>, password{" "}
                <code className="text-on-surface">llmbuilder</code>, database{" "}
                <code className="text-on-surface">llmbuilder</code>
              </li>
            </ul>
          </section>

          <section id="register">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">3. Register the first admin</h2>
            <p className="text-secondary">
              Open the web app and create an account with email and password. The{" "}
              <strong className="text-on-surface">first user you register</strong> becomes the
              administrator. Today every account has the same admin role with full access to the
              console—use that login whenever you return to the app.
            </p>
          </section>

          <section id="knowledge">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">4. Knowledge</h2>
            <p className="mb-4 text-secondary">
              In the dashboard, open <strong className="text-on-surface">Knowledge</strong>. Create
              a knowledge base, upload documents (PDF, Office, text, etc.), and let background
              workers chunk and embed them into Qdrant. When ingestion finishes, the collection is
              ready for retrieval in a deployment.
            </p>
            <p className="text-sm text-on-surface-variant">
              You can tune embedding settings per knowledge base so they match the models you run
              locally (e.g. Ollama) or remote APIs.
            </p>
          </section>

          <section id="models">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">5. Models</h2>
            <p className="mb-4 text-secondary">
              Go to <strong className="text-on-surface">Models</strong> and register inference
              endpoints: <strong className="text-on-surface">Ollama</strong> on your LAN, a{" "}
              <strong className="text-on-surface">vLLM</strong> server, or{" "}
              <strong className="text-on-surface">OpenAI</strong>-compatible APIs. Store API keys in
              the registry when required. Optional: add the GPU compose profile so Ollama or vLLM
              runs alongside the stack.
            </p>
          </section>

          <section id="deployments">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">6. Deployments</h2>
            <p className="mb-4 text-secondary">
              Under <strong className="text-on-surface">Deployments</strong>, create a deployment
              that ties together an optional knowledge base, a registered model, and a prompt
              template. From there you can publish <strong className="text-on-surface">hosted</strong>{" "}
              versions (frozen snapshots served by the platform) or build an{" "}
              <strong className="text-on-surface">export ZIP</strong> with a small runnable API and
              embedded vectors for offline use.
            </p>
          </section>

          <section id="chat">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">7. Chat</h2>
            <p className="text-secondary">
              Open <strong className="text-on-surface">Chat</strong>, pick a deployment, and talk to
              your stack with RAG when a knowledge base is attached. Iterate on prompts and models
              without leaving the product.
            </p>
          </section>

          <section id="production">
            <h2 className="mb-4 font-headline text-2xl font-bold text-primary">Production deploy</h2>
            <p className="mb-4 text-secondary">
              On a server, configure <code className="text-primary">.env</code> as needed, then:
            </p>
            <CodeBlock>{`./setup-prod.sh   # build prod images, migrate, start stack
./start-prod.sh   # start or recreate containers
./logs-prod.sh    # follow logs (optional: ./logs-prod.sh app web)
./stop-prod.sh    # stop stack; data preserved`}</CodeBlock>
            <p className="mt-4 text-sm text-on-surface-variant">
              Shared script helpers live in <code className="text-primary">_ragline_common.sh</code>.
              Optional GPU inference: see <code className="text-primary">docker-compose.gpu.yml</code>{" "}
              in the repo.
            </p>
          </section>

          <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-8">
            <h2 className="mb-2 font-headline text-xl font-bold">Related pages</h2>
            <ul className="list-inside list-disc space-y-2 text-secondary">
              <li>
                <Link href="/how-it-works" className="text-primary hover:underline">
                  How it works
                </Link>{" "}
                — conceptual flow across the product
              </li>
              <li>
                <Link href="/product" className="text-primary hover:underline">
                  Deployment architecture
                </Link>{" "}
                — hosted versions vs export bundles
              </li>
              <li>
                <Link href="/help" className="text-primary hover:underline">
                  Help center
                </Link>{" "}
                — quick links and pointers
              </li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
