import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const HERO_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAcRzozfjTL7vNoGTZrsWpqh-aaqnoEtx72lR8MNSRgyBvWSdsOA1tGrfaUsnV8UpUKUy6w6vhSIrKop-ERjrfRV5JrAucvChWefLOW_eAHn_VMaoGQ7TzaSNCZBT8iIzIkRvIL2_BTXclxEPL8TxoePs-WheK8vLyRkCS1UC3a3QiLXVesebkyyCCoDl89jfHS_rhL9-Yz5lrp4tNJ0YcOjnVCJrv_vHG60NrDyiTYNuRzqxs-Zn-5XEeNhhNNzbMroIf7-3TDgWY";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden pb-32 pt-16 md:pt-24">
          <div className="mx-auto grid max-w-screen-2xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-12 lg:px-12">
            <div className="space-y-8 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container-high px-3 py-1">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Docker · FastAPI · Qdrant
                </span>
              </div>
              <h1 className="max-w-3xl font-headline text-5xl font-black leading-[0.9] tracking-tighter text-on-background md:text-7xl lg:text-8xl">
                LLM Builder: ingestion,{" "}
                <span className="text-primary-container">RAG</span>, models, and chat—on your metal.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-secondary md:text-xl">
                Fully on-premises AI infrastructure: upload knowledge, wire Ollama or remote APIs,
                compose deployments, and chat with citations—without sending your documents to a
                vendor cloud.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  href="/getting-started"
                  className="kinetic-gradient flex items-center gap-2 rounded-lg px-8 py-4 font-bold text-on-primary transition-all hover:brightness-110 active:scale-95"
                >
                  How to use
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </Link>
                <Link
                  href="/getting-started#api-reference"
                  className="rounded-lg border border-outline-variant/30 px-8 py-4 font-bold text-primary transition-all hover:bg-surface-container-high active:scale-95"
                >
                  API docs (local)
                </Link>
              </div>
              <p className="text-sm text-on-surface-variant">
                <Link href="/getting-started" className="font-bold text-primary hover:underline">
                  Getting started guide
                </Link>
                {" · "}
                <Link href="/how-it-works" className="hover:text-primary">
                  How it works
                </Link>
                {" · "}
                <Link href="/product" className="hover:text-primary">
                  Deployment architecture
                </Link>
              </p>
            </div>
            <div className="relative lg:col-span-5">
              <div className="absolute -inset-4 rounded-full bg-primary/5 blur-3xl" />
              <div className="relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-2xl group">
                <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container-highest">
                  <Image
                    src={HERO_IMG}
                    alt="Technical abstract AI nodes"
                    fill
                    className="object-cover opacity-40 mix-blend-overlay transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    priority
                  />
                  <div className="z-10 w-full max-w-[80%] space-y-4">
                    <div className="flex h-12 items-center gap-3 rounded border border-primary/20 bg-surface-container px-4">
                      <span className="material-symbols-outlined text-sm text-primary">database</span>
                      <div className="h-2 w-24 rounded bg-primary/20" />
                    </div>
                    <div className="ml-8 flex h-12 items-center gap-3 rounded border border-primary/20 bg-surface-container px-4">
                      <span className="material-symbols-outlined text-sm text-primary">
                        psychology
                      </span>
                      <div className="h-2 w-32 rounded bg-primary/20" />
                    </div>
                    <div className="flex h-12 items-center gap-3 rounded border border-primary/20 bg-surface-container px-4">
                      <span className="material-symbols-outlined text-sm text-primary">hub</span>
                      <div className="h-2 w-16 rounded bg-primary/20" />
                    </div>
                  </div>
                </div>
                <div className="absolute right-10 top-10 flex items-center gap-2 rounded-full border border-primary/20 bg-surface-container-highest px-3 py-1.5">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-primary">
                    System Live
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-low py-24">
          <div className="mx-auto max-w-screen-2xl px-6 md:px-12">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  icon: "shield_person",
                  title: "Your data, your network",
                  body: "Run the full stack on-premises: PostgreSQL for app state, Qdrant for vectors, Redis for job queues. You choose whether inference stays local (Ollama, vLLM) or uses an API you control.",
                },
                {
                  icon: "bolt",
                  title: "Docker Compose ready",
                  body: "One compose project brings up the app, API, workers, and dependencies. Optional GPU compose adds Ollama or vLLM. Dev and prod lifecycle scripts keep environments reproducible.",
                },
                {
                  icon: "package_2",
                  title: "Host in-cluster or export",
                  body: "Publish hosted deployment versions with frozen KB snapshots, or download a ZIP bundle with config, vector data, and a runnable API server for air-gapped or edge use.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="group rounded-xl border border-outline-variant/5 bg-surface-container p-8 transition-all hover:bg-surface-container-high"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <span className="material-symbols-outlined">{card.icon}</span>
                  </div>
                  <h3 className="mb-4 font-headline text-2xl font-bold tracking-tight">{card.title}</h3>
                  <p className="leading-relaxed text-secondary">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-screen-2xl px-6 md:px-12">
            <div className="mb-16">
              <h2 className="mb-4 font-headline text-4xl font-black uppercase tracking-tighter md:text-5xl">
                What ships in the box
              </h2>
              <div className="h-1 w-24 bg-primary" />
            </div>
            <div className="grid h-auto grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2 md:h-[600px]">
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 md:col-span-2 md:row-span-2">
                <div>
                  <span className="mb-4 block text-sm font-bold uppercase tracking-widest text-primary">
                    Knowledge
                  </span>
                  <h4 className="mb-4 font-headline text-3xl font-bold tracking-tight">
                    Upload &amp; index
                  </h4>
                  <p className="max-w-sm text-secondary">
                    Ingest documents into knowledge bases, embed with your chosen models, and store
                    vectors in Qdrant for retrieval-augmented generation.
                  </p>
                </div>
                <div className="mt-8 flex gap-2 overflow-hidden opacity-40 transition-opacity group-hover:opacity-100">
                  {["PDF", "DOCX", "MD", "TXT"].map((t) => (
                    <div
                      key={t}
                      className="rounded border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs"
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>
              <div className="group flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 md:col-span-2">
                <div className="flex-1">
                  <span className="mb-2 block text-sm font-bold uppercase tracking-widest text-primary">
                    Models
                  </span>
                  <h4 className="font-headline text-2xl font-bold tracking-tight">Model registry</h4>
                  <p className="text-sm text-secondary">
                    Register Ollama, OpenAI-compatible, or vLLM endpoints. Fine-tuning workflows sit
                    alongside chat and RAG orchestration.
                  </p>
                </div>
                <span className="material-symbols-outlined text-6xl text-primary/20 transition-colors group-hover:text-primary/40">
                  model_training
                </span>
              </div>
              <div className="group flex flex-col rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 md:col-span-1">
                <span className="material-symbols-outlined mb-4 text-primary">grid_view</span>
                <h4 className="mb-2 font-headline text-lg font-bold">RAG &amp; chunking</h4>
                <p className="text-xs leading-relaxed text-secondary">
                  Configure chunking and embedding per knowledge base; Redis-backed workers process
                  ingestion jobs asynchronously.
                </p>
              </div>
              <div className="group flex flex-col rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 md:col-span-1">
                <span className="material-symbols-outlined mb-4 text-primary">cloud_sync</span>
                <h4 className="mb-2 font-headline text-lg font-bold">Deployments</h4>
                <p className="text-xs leading-relaxed text-secondary">
                  Tie a knowledge base, model, and prompt into a deployment—then open chat or expose
                  hosted APIs and export bundles.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-outline-variant/5 bg-surface-container-lowest py-24">
          <div className="mx-auto max-w-screen-2xl px-6 md:px-12">
            <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="mb-2 font-headline text-3xl font-black tracking-tighter text-on-background md:text-4xl">
                  How to use the product
                </h2>
                <p className="max-w-2xl text-secondary">
                  Run the Docker stack from the repo, register your account, then walk through the
                  console in the order below. Everything stays on your infrastructure.
                </p>
              </div>
              <Link
                href="/getting-started"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 px-6 py-3 font-bold text-primary transition-colors hover:bg-surface-container-high"
              >
                Full guide
                <span className="material-symbols-outlined text-lg">menu_book</span>
              </Link>
            </div>
            <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "Run ./setup.sh & ./start.sh",
                  body: "From the llm-builder repo root, start the dev stack (Postgres, Redis, Qdrant, API, workers, web).",
                },
                {
                  step: "2",
                  title: "Open localhost:3000",
                  body: "Register the first user—that account is admin. Use the same login for the dashboard.",
                },
                {
                  step: "3",
                  title: "Knowledge → Models",
                  body: "Upload documents into a knowledge base, then register Ollama, vLLM, or OpenAI-compatible endpoints.",
                },
                {
                  step: "4",
                  title: "Deployments → Chat",
                  body: "Bind KB + model + prompt, then chat in the UI or call the hosted API / export a bundle.",
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="flex gap-4 rounded-xl border border-outline-variant/10 bg-surface-container p-6"
                >
                  <span className="font-headline text-3xl font-black text-primary/40">{item.step}</span>
                  <div>
                    <h3 className="mb-2 font-headline font-bold text-on-background">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-secondary">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-background py-24">
          <div className="mx-auto max-w-screen-2xl px-6 md:px-12">
            <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container">
              <div className="border-b border-outline-variant/10 p-8">
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  Stack at a glance
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-high/50 text-xs uppercase tracking-widest text-secondary">
                      <th className="px-6 py-4 font-bold md:px-8">Category</th>
                      <th className="px-6 py-4 font-bold md:px-8">Capabilities</th>
                      <th className="px-6 py-4 font-bold md:px-8">Architecture</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {[
                      ["Vector DB", "Qdrant collections per KB / hosted version", "gRPC & HTTP API"],
                      ["App & API", "FastAPI, OpenAPI at /docs", "SQLAlchemy + Alembic migrations"],
                      ["Jobs & cache", "Redis (RQ) workers", "Async ingestion & exports"],
                      ["Identity", "JWT access + refresh, PostgreSQL users", "First registered user is admin"],
                    ].map(([cat, cap, arch]) => (
                      <tr key={cat} className="transition-colors hover:bg-surface-container-high">
                        <td className="px-6 py-6 font-bold text-primary md:px-8">{cat}</td>
                        <td className="px-6 py-6 md:px-8">{cap}</td>
                        <td className="px-6 py-6 text-sm text-secondary md:px-8">{arch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
