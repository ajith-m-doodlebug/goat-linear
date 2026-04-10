import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Pricing",
  description: "LLM Builder On-Premise is self-hosted—bring your own infrastructure.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl flex-1 px-6 py-20 md:px-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="intelligence-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Commercial</span>
        </div>
        <h1 className="mb-6 font-headline text-5xl font-black tracking-tighter text-on-surface md:text-7xl">
          Pricing
        </h1>
        <p className="mb-12 max-w-xl text-lg text-secondary">
          LLM Builder is open for you to run on your own servers. Costs are your cloud or data-center
          bill—there is no separate per-seat SaaS fee from this project. Enterprise support or hosted
          offerings would be custom; use the contact links in the footer if you need help scoping a
          deployment.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { tier: "Self-hosted", note: "Clone the repo, run Docker Compose, own the stack." },
            { tier: "Team", note: "Scale workers, GPU nodes, and storage to match your workloads." },
            { tier: "Enterprise", note: "Air-gapped exports, SSO, and compliance are yours to implement on top." },
          ].map(({ tier, note }) => (
            <div
              key={tier}
              className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-8"
            >
              <h2 className="mb-2 font-headline text-2xl font-bold">{tier}</h2>
              <p className="mb-6 text-sm text-secondary">{note}</p>
              <button
                type="button"
                className="w-full rounded-lg border border-primary py-3 font-bold text-primary transition-colors hover:bg-primary/10"
              >
                View README
              </button>
            </div>
          ))}
        </div>
        <p className="mt-12 text-sm text-on-surface-variant">
          <Link href="/" className="text-primary hover:underline">
            Back to product
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
