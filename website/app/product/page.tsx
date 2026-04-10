import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Deployment Architecture",
  description: "Hosted deployment versions vs portable export bundles in LLM Builder.",
};

export default function ProductPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl flex-1 px-6 py-12 md:px-12 md:py-16">
        <section className="mb-24 flex flex-col items-start gap-16 md:flex-row">
          <div className="md:w-3/5">
            <div className="mb-6 flex items-center gap-3">
              <span className="intelligence-pulse-ripple" />
              <span className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
                Same deployment, two surfaces
              </span>
            </div>
            <h1 className="mb-8 font-headline text-5xl font-black leading-[0.9] tracking-tighter text-on-surface md:text-7xl lg:text-8xl">
              HOSTED VS.
              <br />
              <span className="text-primary">EXPORT</span>
            </h1>
            <p className="max-w-xl text-lg font-light leading-relaxed text-on-surface-variant">
              Keep everything inside the main LLM Builder stack with versioned hosted snapshots—or pack
              a deployment into a ZIP with frozen config, vector data, and a minimal API server for
              disconnected sites.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 md:w-2/5">
            <div className="rounded-xl border-l-4 border-primary bg-surface-container-low p-8 shadow-2xl">
              <span className="material-symbols-outlined mb-4 text-primary" style={{ fontSize: 40 }}>
                terminal
              </span>
              <h3 className="mb-2 font-headline text-xl font-bold">Docker Compose</h3>
              <p className="text-sm text-on-secondary-container">
                The app, API, workers, Postgres, Redis, and Qdrant ship as one compose project—add
                optional GPU services when you need local inference.
              </p>
            </div>
          </div>
        </section>

        <div className="mb-24 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-outline-variant/10 md:grid-cols-2">
          <div className="group bg-surface-container-low p-8 transition-colors hover:bg-surface-container md:p-12">
            <div className="mb-12 flex items-start justify-between">
              <div className="rounded-lg bg-primary/10 p-4 transition-colors group-hover:bg-primary/20">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 48 }}>
                  cloud_sync
                </span>
              </div>
              <span className="rounded-full border border-outline-variant px-3 py-1 font-headline text-[10px] font-bold tracking-[0.2em] text-outline">
                MODE: MANAGED
              </span>
            </div>
            <h2 className="mb-6 font-headline text-4xl font-bold">Hosted versions</h2>
            <p className="mb-10 leading-relaxed text-on-surface-variant">
              Create a deployment version to freeze model settings, prompt text, and a snapshot of
              your knowledge base. The platform seeds a dedicated Qdrant collection and serves RAG
              through the hosted API routes.
            </p>
            <ul className="mb-12 space-y-6">
              {[
                ["Frozen snapshots", "Each version captures embedding config and KB state for repeatable answers."],
                ["Per-version collections", "Vectors live in Qdrant under hosted_* collections isolated from dev data."],
                ["In-process inference", "Hosted chat reuses your registered model endpoints with the frozen prompt."],
              ].map(([t, d]) => (
                <li key={t} className="flex items-start gap-4">
                  <span className="material-symbols-outlined mt-1 text-primary">check_circle</span>
                  <div>
                    <span className="block font-bold">{t}</span>
                    <span className="text-sm text-on-secondary-container">{d}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="w-full border border-primary py-4 font-bold text-primary transition-all hover:bg-primary/5"
            >
              Create hosted version
            </button>
          </div>
          <div className="group bg-surface-container-low p-8 transition-colors hover:bg-surface-container md:p-12">
            <div className="mb-12 flex items-start justify-between">
              <div className="rounded-lg bg-tertiary/10 p-4 transition-colors group-hover:bg-tertiary/20">
                <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 48 }}>
                  package_2
                </span>
              </div>
              <span className="rounded-full border border-outline-variant px-3 py-1 font-headline text-[10px] font-bold tracking-[0.2em] text-outline">
                MODE: AIR-GAPPED
              </span>
            </div>
            <h2 className="mb-6 font-headline text-4xl font-bold">Portable export</h2>
            <p className="mb-10 leading-relaxed text-on-surface-variant">
              Build a ZIP that contains JSON config, serialized vectors (when a knowledge base is
              attached), and a small FastAPI app so you can run the same RAG logic outside the main
              cluster—ideal for labs or air-gapped hosts.
            </p>
            <ul className="mb-12 space-y-6">
              {[
                ["Runnable server", "Python entrypoint plus requirements to stand up the export API quickly."],
                ["Vector payload", "Points are exported from Qdrant for offline top-k search in the bundle."],
                ["Secrets via env", "API keys for cloud models are not embedded; operators inject them at runtime."],
              ].map(([t, d]) => (
                <li key={t} className="flex items-start gap-4">
                  <span className="material-symbols-outlined mt-1 text-tertiary">check_circle</span>
                  <div>
                    <span className="block font-bold">{t}</span>
                    <span className="text-sm text-on-secondary-container">{d}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="w-full border border-tertiary py-4 font-bold text-tertiary transition-all hover:bg-tertiary/5"
            >
              Download export bundle
            </button>
          </div>
        </div>

        <section className="mb-24">
          <h2 className="mb-12 flex items-center gap-4 font-headline text-3xl font-bold">
            Ingestion &amp; models
            <div className="h-px flex-1 bg-outline-variant opacity-20" />
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center gap-10 rounded-xl bg-surface-container p-8 md:col-span-2 md:flex-row md:p-10">
              <div className="md:w-1/2">
                <h3 className="mb-4 font-headline text-2xl font-bold">Chunking &amp; embeddings</h3>
                <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">
                  Knowledge base configs carry embedding provider settings—Ollama, sentence-transformers,
                  and friends—so exports and hosted versions know which models produced your vectors.
                </p>
                <div className="space-y-3">
                  {[
                    ["Recursive Character", "Optimal", true],
                    ["Sentence-Aware Split", "Contextual", false],
                    ["Fixed Size (512 tokens)", "Static", false],
                  ].map(([label, tag, primary]) => (
                    <div
                      key={label as string}
                      className={`flex items-center justify-between rounded border-l-2 bg-surface-container-highest p-3 ${
                        primary ? "border-primary" : "border-outline"
                      }`}
                    >
                      <span className="text-xs font-bold">{label}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          primary ? "bg-primary/10 text-primary" : "bg-outline/10 text-outline"
                        }`}
                      >
                        {tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:w-1/2 overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6 font-mono text-[11px] text-primary/80 shadow-inner">
                <div className="mb-2 text-outline"># llm-builder/knowledge-base.yaml</div>
                <div>strategy: &quot;recursive_context&quot;</div>
                <div>chunk_size: 1024</div>
                <div>overlap: 128</div>
                <div>embedding_provider: &quot;ollama&quot;</div>
                <div>model: &quot;nomic-embed-text&quot;</div>
                <div className="mt-4 text-outline">// Processing stream...</div>
                <div className="mt-1 flex gap-1">
                  <div className="h-1 w-12 rounded bg-primary/40" />
                  <div className="h-1 w-8 rounded bg-primary/20" />
                  <div className="h-1 w-16 rounded bg-primary/60" />
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-surface-container-high p-10">
              <div className="relative z-10">
                <h3 className="mb-4 font-headline text-2xl font-bold">Model Registry</h3>
                <p className="mb-8 text-sm leading-relaxed text-on-surface-variant">
                  Register once, reuse everywhere: chat, deployments, and fine-tuning pick up the
                  same model rows.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ["Ollama", "LOCAL Llama3"],
                    ["vLLM", "SERVER-SIDE"],
                    ["OpenAI", "CLOUD API"],
                    ["Custom", "OPENAI-COMPAT"],
                  ].map(([name, sub]) => (
                    <div
                      key={name}
                      className="flex flex-col items-center justify-center rounded border border-outline-variant/20 bg-surface-container-highest p-4"
                    >
                      <span className="text-sm font-bold">{name}</span>
                      <span className="text-[9px] text-outline">{sub}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-10">
                <span className="material-symbols-outlined" style={{ fontSize: 140 }}>
                  hub
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low p-10 text-center shadow-2xl md:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-5"
            style={{
              backgroundImage: "radial-gradient(#00d2ff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <h2 className="mb-6 font-headline text-4xl font-black tracking-tighter md:text-5xl">
            Ready for <span className="text-primary">Production?</span>
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg font-light leading-relaxed text-on-surface-variant">
            Clone the repo, run the compose stack, register the first admin, and you&apos;re ready to
            upload documents and ship a deployment—hosted in-cluster or exported for offline use.
          </p>
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <button
              type="button"
              className="kinetic-gradient flex items-center gap-3 rounded-lg px-10 py-4 font-bold text-on-primary shadow-xl transition-all hover:shadow-primary/20"
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              Get the project
            </button>
            <button
              type="button"
              className="rounded-lg border border-outline-variant px-10 py-4 font-bold transition-all hover:bg-surface-container-high"
            >
              Read the README
            </button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
