import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Help",
  description: "Documentation and support for LLM Builder On-Premise.",
};

const topics = [
  {
    title: "Getting started",
    body: "Follow the repo README: ./setup.sh then ./reload-start.sh (or ./start.sh), open the web app and API docs, register the first admin, then create a knowledge base and deployment.",
  },
  {
    title: "API reference",
    body: "FastAPI serves OpenAPI at /docs on port 8000 by default—includes auth, knowledge, models, deployments, and hosted routes.",
  },
  {
    title: "Operations",
    body: "Use ./reload-start.sh for dev (hot reload) vs ./start.sh for production images; Host Models for vLLM; health/readiness on the API for monitoring.",
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl flex-1 px-6 py-20 md:px-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="intelligence-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Support</span>
        </div>
        <h1 className="mb-6 font-headline text-5xl font-black tracking-tighter text-on-surface md:text-7xl">
          Help center
        </h1>
        <p className="mb-8 max-w-xl text-lg text-secondary">
          For step-by-step usage (scripts, URLs, Knowledge → Chat), use the guide below. This page
          lists quick topics only.
        </p>
        <Link
          href="/getting-started"
          className="mb-12 flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-surface-container-low p-6 transition-colors hover:border-primary/50 hover:bg-surface-container"
        >
          <div>
            <div className="font-headline text-lg font-bold text-primary">How to use LLM Builder</div>
            <p className="mt-1 text-sm text-secondary">
              Run the stack, register, then use Knowledge, Models, Deployments, and Chat.
            </p>
          </div>
          <span className="material-symbols-outlined text-primary">arrow_forward</span>
        </Link>
        <ul className="space-y-4">
          {topics.map((t) => (
            <li
              key={t.title}
              className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 transition-colors hover:bg-surface-container"
            >
              <h2 className="font-headline text-xl font-bold text-primary">{t.title}</h2>
              <p className="mt-2 text-sm text-secondary">{t.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-sm text-on-surface-variant">
          <Link href="/how-it-works" className="text-primary hover:underline">
            How it works
          </Link>
          {" · "}
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
