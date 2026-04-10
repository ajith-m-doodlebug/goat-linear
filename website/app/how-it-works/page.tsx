import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "How it Works",
  description: "Knowledge → models → deployments → chat in LLM Builder On-Premise.",
};

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl flex-1 px-6 py-12 md:px-12 md:py-16">
        <section className="mb-24 flex flex-col items-end justify-between gap-12 md:flex-row">
          <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="intelligence-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                End-to-end flow
              </span>
            </div>
            <h1 className="mb-8 font-headline text-5xl font-black leading-none tracking-tighter text-on-surface md:text-7xl lg:text-8xl">
              FROM DOCS TO
              <br />
              DEPLOYED CHAT.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-secondary md:text-xl">
              LLM Builder wires together knowledge bases, a model registry, versioned deployments, and
              chat—so every answer can be grounded in your own documents on your own hardware.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/getting-started" className="font-bold text-primary hover:underline">
                Step-by-step usage →
              </Link>
            </p>
          </div>
          <div className="hidden h-64 w-px bg-surface-container-high opacity-30 lg:block" />
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 md:col-span-7 md:p-10">
            <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-primary/5 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 flex items-center justify-between">
                  <span className="font-headline text-6xl font-black text-outline opacity-20">01</span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-primary">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      database
                    </span>
                  </div>
                </div>
                <h2 className="mb-4 font-headline text-3xl font-bold text-on-surface">Knowledge</h2>
                <p className="mb-6 max-w-md text-secondary">
                  Create knowledge bases, upload documents, and let background workers chunk and embed
                  content into Qdrant collections for retrieval.
                </p>
                <div className="mb-12 flex flex-wrap gap-3">
                  {["Uploads", "Embeddings", "Qdrant vectors"].map((t) => (
                    <span
                      key={t}
                      className="rounded bg-surface-container-highest px-3 py-1 text-xs text-on-surface-variant"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href="/product"
                className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary transition-all hover:gap-4"
              >
                Learn More <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl bg-surface-container p-8 transition-colors hover:bg-surface-container-high md:col-span-5 md:p-10">
            <div>
              <div className="mb-8 flex items-center justify-between">
                <span className="font-headline text-6xl font-black text-outline opacity-20">02</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    neurology
                  </span>
                </div>
              </div>
              <h2 className="mb-4 font-headline text-3xl font-bold text-on-surface">Models</h2>
              <p className="mb-8 text-secondary">
                Point at Ollama on the LAN, a vLLM server, or OpenAI-compatible APIs. The registry stores
                endpoints and credentials for use in deployments and fine-tuning flows.
              </p>
            </div>
            <div>
              <div className="mb-6 rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4">
                <div className="flex items-center gap-3 text-sm text-primary-fixed-dim">
                  <span className="intelligence-pulse" />
                  Ollama reachable at host.docker.internal:11434
                </div>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                Registry <span className="material-symbols-outlined">arrow_forward</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border-t-2 border-primary/20 bg-surface-container p-8 md:col-span-5 md:p-10">
            <div>
              <div className="mb-8 flex items-center justify-between">
                <span className="font-headline text-6xl font-black text-outline opacity-20">03</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    rocket_launch
                  </span>
                </div>
              </div>
              <h2 className="mb-4 font-headline text-3xl font-bold text-on-surface">Deployments</h2>
              <p className="mb-8 text-secondary">
                Bind a knowledge base (optional), a model, and a prompt template. Publish hosted
                versions with frozen snapshots, or export a ZIP with a runnable API and embedded
                vectors.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
              Configure <span className="material-symbols-outlined">arrow_forward</span>
            </span>
          </div>

          <div className="flex flex-col gap-10 rounded-xl bg-surface-container-low p-8 md:col-span-7 md:flex-row md:p-10">
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <div className="mb-8 flex items-center justify-between">
                  <span className="font-headline text-6xl font-black text-outline opacity-20">04</span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-primary">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      forum
                    </span>
                  </div>
                </div>
                <h2 className="mb-4 font-headline text-3xl font-bold text-on-surface">Chat</h2>
                <p className="mb-8 text-secondary">
                  Use the web UI to talk to a deployment with RAG turned on—retrieve context from
                  Qdrant, call your registered model, and iterate on prompts without leaving the app.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                Open app <span className="material-symbols-outlined">arrow_forward</span>
              </span>
            </div>
            <div className="flex-1 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 border-b border-outline-variant/10 pb-2">
                <div className="h-2 w-2 rounded-full bg-red-500/50" />
                <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
                <div className="h-2 w-2 rounded-full bg-green-500/50" />
                <span className="ml-2 font-mono text-[10px] uppercase tracking-tighter text-outline">
                  Deployment: handbook-rag
                </span>
              </div>
              <div className="space-y-4">
                <div className="rounded bg-surface-container-high/50 p-2 font-mono text-[11px] text-secondary">
                  [09:41:02] User: &quot;What&apos;s our PTO policy?&quot;
                </div>
                <div className="rounded border-l-2 border-primary bg-primary/5 p-2 font-mono text-[11px] text-primary">
                  [09:41:03] Retriever: Qdrant top_k=10 → 3 chunks from employee-handbook.pdf
                </div>
                <div className="rounded bg-surface-container-high/50 p-2 font-mono text-[11px] text-on-surface">
                  Assistant: &quot;Full-time employees accrue PTO per §4.2…&quot; (citations attached)
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-32 border-t border-outline-variant/10 pt-24">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-3">
            {[
              {
                title: "Async by design",
                body: "Heavy work—ingestion, exports, embedding warmups—runs in Redis-backed RQ workers so the API stays responsive.",
              },
              {
                title: "Grounded answers",
                body: "Retrieval uses your Qdrant collections; models never see your raw files unless you send them through the RAG path you configured.",
              },
              {
                title: "APIs + exports",
                body: "Hosted deployment routes expose frozen RAG configs. Need offline? Download the export bundle with vectors and a small FastAPI server.",
              },
            ].map((b) => (
              <div key={b.title}>
                <h3 className="mb-6 font-headline text-xl font-bold text-primary">{b.title}</h3>
                <p className="text-sm leading-relaxed text-secondary">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mt-32 overflow-hidden rounded-2xl bg-surface-container-high p-12 text-center md:p-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="mb-8 font-headline text-4xl font-black leading-tight text-on-surface md:text-5xl">
              READY TO RUN LLM BUILDER ON-PREMISE?
            </h2>
            <Link
              href="/"
              className="inline-block rounded-lg px-10 py-4 text-lg font-bold text-on-primary transition-transform duration-150 kinetic-gradient active:scale-95"
            >
              Explore the stack
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
