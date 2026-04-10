import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const CIRCUIT_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD3z4IA5Mse7p48czcxo03gntKAXJ7LF9PXaxFM2lWq_LXH6_GtgAOxUXSNdL1qQiLsfFOBjdLfNpwZlSTNam2OKAiox0K9LOlbNZgOq2L1dhLO6UzpOcxFkKw6NpqyGT47khL_w0SLOb8-p4SXMQ8N9vmGU6wZk32ZrQEW-x3EmhHea9zAm3mqT6gShU4wJbkyJ43DA39DxE5vsft_-lutgAKCV4iVjVr2ilMQ03eIijxljtpBSipwpPCaK5GW4cthQpshYiOV7cI";

export const metadata: Metadata = {
  title: "Operations & access",
  description: "How LLM Builder handles auth, admin bootstrap, and user management on-premise.",
};

export default function SolutionsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl flex-1 px-6 py-12 md:px-12 md:py-16">
        <section className="mb-24 flex flex-col items-start gap-16 md:flex-row">
          <div className="w-full md:w-1/2">
            <div className="mb-6 flex items-center gap-3">
              <span className="intelligence-pulse" />
              <span className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
                Auth &amp; admins
              </span>
            </div>
            <h1 className="mb-8 font-headline text-5xl font-black leading-[0.9] tracking-tighter text-on-surface md:text-7xl">
              Operators in <br />
              <span className="text-primary">control.</span>
            </h1>
            <p className="mb-10 max-w-md text-lg leading-relaxed text-secondary">
              Email and password login backed by PostgreSQL, JWT access and refresh tokens, and an
              admin-first bootstrap: the first user you register becomes the administrator for the
              whole deployment.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-8 py-4 font-bold text-on-primary"
              >
                <span className="material-symbols-outlined">security</span>
                Review API auth
              </button>
              <button
                type="button"
                className="rounded-lg border border-outline-variant/15 px-8 py-4 font-bold text-primary transition-colors hover:bg-surface-container"
              >
                OpenAPI docs
              </button>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="relative overflow-hidden rounded-xl border-t border-surface-bright bg-surface-container-low p-8 shadow-2xl">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
              <div className="mb-8 flex items-center justify-between">
                <div className="font-headline text-xl font-bold text-on-surface">API session</div>
                <span className="rounded bg-surface-container-highest px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                  JWT
                </span>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-tighter text-secondary">
                    Account email
                  </label>
                  <div className="flex items-center gap-3 rounded border border-transparent bg-surface-container-lowest p-4 transition-colors focus-within:border-primary/40">
                    <span className="material-symbols-outlined text-lg text-secondary">
                      alternate_email
                    </span>
                    <span className="text-on-surface">admin@enterprise.internal</span>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-tighter text-secondary">
                    JWT Access Token
                  </label>
                  <div className="flex items-center gap-3 truncate rounded border border-transparent bg-surface-container-lowest p-4 font-mono text-[10px] text-primary/60">
                    <span className="material-symbols-outlined shrink-0 text-lg text-secondary">key</span>
                    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ...
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-lg border border-primary/20 bg-surface-container-high py-4 font-bold text-primary transition-all hover:bg-primary hover:text-on-primary"
                >
                  Send email OTP (SMTP configured)
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24 grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="flex min-h-[400px] flex-col justify-between rounded-xl bg-surface-container-low p-8 md:col-span-8">
            <div>
              <h3 className="mb-2 font-headline text-3xl font-bold tracking-tight">
                First-time setup
              </h3>
              <p className="mb-8 text-sm text-secondary">
                Bring the compose stack up, run migrations, then register your first admin user in
                the web UI.
              </p>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border-l-4 border-primary bg-surface-container p-4">
                  <span className="material-symbols-outlined mb-2 text-primary">dns</span>
                  <div className="text-xs font-bold uppercase text-secondary">Postgres</div>
                  <div className="font-headline text-lg font-bold">Migrated</div>
                </div>
                <div className="rounded-lg border-l-4 border-outline-variant/40 bg-surface-container-high p-4">
                  <span className="material-symbols-outlined mb-2 text-secondary">lock_open</span>
                  <div className="text-xs font-bold uppercase text-secondary">Redis / RQ</div>
                  <div className="font-headline text-lg font-bold text-primary">Workers up</div>
                </div>
                <div className="rounded-lg border-l-4 border-outline-variant/40 bg-surface-container p-4">
                  <span className="material-symbols-outlined mb-2 text-secondary">token</span>
                  <div className="text-xs font-bold uppercase text-secondary">Qdrant</div>
                  <div className="font-headline text-lg font-bold text-secondary-fixed-dim">
                    Ready
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-stretch justify-between gap-4 rounded-lg bg-surface-container-lowest p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/20 text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    terminal
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-secondary">Current Task</div>
                  <div className="text-sm font-medium">
                    Running Alembic migrations against database llmbuilder
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="rounded bg-primary px-6 py-2 text-sm font-bold text-on-primary"
              >
                Continue Setup
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-gradient-to-br from-surface-container-high to-surface-container-lowest p-8 md:col-span-4">
            <span className="material-symbols-outlined mb-6 text-4xl text-primary">workspace_premium</span>
            <h3 className="mb-4 font-headline text-2xl font-bold">On-prem sovereignty</h3>
            <p className="text-sm leading-relaxed text-secondary">
              You run the containers, the volumes, and the backups. Optional cloud APIs are only used
              when you register external model providers—documents and vectors stay local unless you
              export them.
            </p>
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                EXPORT BUNDLES FOR OFFLINE
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                ENV-DRIVEN SECRETS
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-surface-bright bg-surface-container-low shadow-xl">
          <div className="flex flex-col items-start justify-between gap-6 border-b border-surface-variant p-8 md:flex-row md:items-center">
            <div>
              <h2 className="font-headline text-3xl font-black tracking-tight">
                Identity &amp; Access Management
              </h2>
              <p className="text-sm text-secondary">
                Invite colleagues; today everyone shares the admin role with full access to the
                console.
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-3 md:w-auto">
              <div className="relative min-w-[200px] flex-grow md:flex-grow-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-secondary">
                  search
                </span>
                <input
                  className="w-full rounded-lg border-none bg-surface-container-lowest py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/40 md:w-64"
                  placeholder="Search identities..."
                  type="text"
                  readOnly
                  aria-label="Search identities"
                />
              </div>
              <button
                type="button"
                className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-4 py-2 hover:bg-surface-bright"
              >
                <span className="material-symbols-outlined text-lg">filter_list</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Invite
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-lowest text-[10px] font-black uppercase tracking-widest text-secondary">
                  <th className="px-6 py-5 md:px-8">Identity</th>
                  <th className="px-6 py-5 md:px-8">Role Configuration</th>
                  <th className="px-6 py-5 md:px-8">Authentication Status</th>
                  <th className="px-6 py-5 text-right md:px-8">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/30">
                {[
                  {
                    initials: "AK",
                    name: "Alex Kessler",
                    email: "kessler@monolith.corp",
                    role: "Admin",
                    roleStyle: "bg-primary/10 text-primary border-primary/20",
                    status: "Active Session",
                    active: true,
                  },
                  {
                    initials: "SR",
                    name: "Sarah Reiner",
                    email: "s.reiner@monolith.corp",
                    role: "Developer",
                    roleStyle: "bg-secondary-container text-secondary border-outline-variant/30",
                    status: "Active Session",
                    active: true,
                  },
                  {
                    initials: "MT",
                    name: "Mark Thorne",
                    email: "thorne.m@external.io",
                    role: "Tester",
                    roleStyle: "bg-surface-container-highest text-secondary",
                    status: "Inactive (7d)",
                    active: false,
                  },
                ].map((row) => (
                  <tr
                    key={row.email}
                    className="transition-colors hover:bg-surface-container"
                  >
                    <td className="px-6 py-6 md:px-8">
                      <div className={`flex items-center gap-4 ${!row.active ? "opacity-60" : ""}`}>
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded bg-surface-container-high font-headline font-bold ${row.initials === "AK" ? "text-primary" : "text-on-surface-variant"}`}
                        >
                          {row.initials}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface">{row.name}</div>
                          <div className="text-xs text-secondary">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 md:px-8">
                      <span
                        className={`rounded border px-3 py-1 text-[10px] font-black uppercase tracking-tighter ${row.roleStyle} ${!row.active ? "opacity-60" : ""}`}
                      >
                        {row.role}
                      </span>
                    </td>
                    <td className="px-6 py-6 md:px-8">
                      <div className={`flex items-center gap-2 ${!row.active ? "opacity-60" : ""}`}>
                        <div
                          className={`h-2 w-2 rounded-full ${row.active ? "bg-primary shadow-[0_0_8px_rgba(165,231,255,0.6)]" : "bg-outline-variant"}`}
                        />
                        <span className="text-xs font-bold text-on-surface">{row.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right md:px-8">
                      <button type="button" className="text-secondary transition-colors hover:text-primary">
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center bg-surface-container-lowest p-4">
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary transition-colors hover:text-primary"
            >
              Load more users
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
          </div>
        </section>

        <section className="mt-24 grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <div className="relative">
            <div className="relative h-80 w-full overflow-hidden rounded-xl">
              <Image
                src={CIRCUIT_IMG}
                alt="Abstract glowing circuit board and data lines"
                fill
                className="object-cover grayscale opacity-40 mix-blend-screen"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
              <div className="absolute bottom-8 left-8">
                <div className="font-headline text-4xl font-black text-on-surface">Your network.</div>
                <div className="font-headline text-sm font-bold tracking-[0.2em] text-primary">
                  YOUR POLICIES
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-8">
            {[
              {
                icon: "shield_with_heart",
                title: "Health & readiness",
                body: "The API exposes /health and /ready probes so you can wire the stack into your existing load balancers or Kubernetes controllers.",
              },
              {
                icon: "hub",
                title: "Environment-driven config",
                body: "Database URLs, Qdrant, Redis, SMTP, and model endpoints are all configured through environment variables—no secrets baked into images.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-container text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {item.icon}
                  </span>
                </div>
                <div>
                  <h4 className="mb-2 font-headline text-xl font-bold">{item.title}</h4>
                  <p className="text-sm leading-relaxed text-secondary">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
