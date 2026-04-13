"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest, getApiBase } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

type KnowledgeBase = { id: string; name: string };
type Model = { id: string; name: string; provider: string };
type Deployment = {
  id: string;
  name: string;
  knowledge_base_id?: string | null;
  has_hosted_versions?: boolean;
  hosted_status?: "live" | "stopped" | null;
};
type Session = { id: string; deployment_id: string; title: string; updated_at: string };

type DeploymentVersion = {
  id: string;
  deployment_id: string;
  version_label: string;
  status: string;
  memory_enabled: boolean;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
};

type LiveHostedRow = {
  deployment: Deployment;
  version: DeploymentVersion;
  endpoint_url: string;
};

type Overview = {
  knowledgeBases: KnowledgeBase[];
  models: Model[];
  deployments: Deployment[];
  sessions: Session[];
};

function StatCard({
  label,
  value,
  href,
  linkLabel,
  icon,
}: {
  label: string;
  value: number;
  href: string;
  linkLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="flex flex-row items-center gap-4">
        <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-800 mt-0.5">{value}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-brand-600 font-medium text-sm hover:text-brand-700 hover:underline mt-2"
          >
            {linkLabel}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

const BookIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const CpuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);
const RocketIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);
const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function DashboardPage() {
  useTopBar("Home", null);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveHosted, setLiveHosted] = useState<LiveHostedRow[]>([]);
  const [liveHostedLoading, setLiveHostedLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<KnowledgeBase[]>("/api/v1/knowledge-bases").catch(() => []),
      apiRequest<Model[]>("/api/v1/models").catch(() => []),
      apiRequest<Deployment[]>("/api/v1/deployments").catch(() => []),
      apiRequest<Session[]>("/api/v1/chat/sessions").catch(() => []),
    ])
      .then(([knowledgeBases, models, deployments, sessions]) => {
        if (!cancelled) {
          setData({ knowledgeBases, models, deployments, sessions });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load overview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const live = data.deployments.filter((dep) => dep.hosted_status === "live");
    if (live.length === 0) {
      setLiveHosted([]);
      return;
    }
    let cancelled = false;
    setLiveHostedLoading(true);
    Promise.all(
      live.map((dep) =>
        apiRequest<DeploymentVersion[]>(`/api/v1/deployments/${dep.id}/versions`).then((versions) => {
          const running = versions.find((v) => v.status === "running");
          if (!running) return null;
          const endpoint_url = `${getApiBase()}/hosted/${dep.id}/v1/chat/completions`;
          return { deployment: dep, version: running, endpoint_url } as LiveHostedRow;
        })
      )
    )
      .then((rows) => {
        if (!cancelled) setLiveHosted(rows.filter((r): r is LiveHostedRow => r != null));
      })
      .catch(() => {
        if (!cancelled) setLiveHosted([]);
      })
      .finally(() => {
        if (!cancelled) setLiveHostedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500 mt-4">Loading overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
        {error}
      </div>
    );
  }

  const d = data!;
  const { knowledgeBases, models, deployments, sessions } = d;
  const hostedLive = deployments.filter((x) => x.hosted_status === "live").length;
  const hostedStopped = deployments.filter((x) => x.hosted_status === "stopped").length;
  const deploymentsWithRag = deployments.filter((dep) => dep.knowledge_base_id != null).length;
  const recentSessions = [...sessions].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 5);
  const canChat = deployments.length > 0;
  const hasModels = models.length > 0;
  const hasKnowledge = knowledgeBases.length > 0;
  const statusLevel = canChat ? "ready" : hasModels ? "partial" : "setup";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Overview</h1>
        <p className="text-sm text-slate-600 mt-1">
          Current state of your knowledge, models, deployments, and chat activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Knowledge bases"
          value={knowledgeBases.length}
          href="/dashboard/knowledge"
          linkLabel="Manage"
          icon={<BookIcon />}
        />
        <StatCard
          label="Models"
          value={models.length}
          href="/dashboard/models"
          linkLabel="Manage"
          icon={<CpuIcon />}
        />
        <StatCard
          label="Deployments"
          value={deployments.length}
          href="/dashboard/deployments"
          linkLabel="Manage"
          icon={<RocketIcon />}
        />
        <StatCard
          label="Chat sessions"
          value={sessions.length}
          href="/dashboard/chat"
          linkLabel="Open Chat"
          icon={<ChatIcon />}
        />
      </div>

      {/* Status / readiness */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">Status</h2>
          <p className="text-sm text-slate-500 mt-0.5 font-normal">
            Setup completeness and current state of your workflow.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Overall status badge */}
          <div className="flex flex-wrap items-center gap-3">
            {statusLevel === "ready" && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Ready to chat
              </span>
            )}
            {statusLevel === "partial" && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Add a deployment to start chatting
              </span>
            )}
            {statusLevel === "setup" && (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                Get started: add a model, then create a deployment
              </span>
            )}
            {hostedLive > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
                {hostedLive} hosted deployment{hostedLive !== 1 ? "s" : ""} live
              </span>
            )}
          </div>

          {/* Breakdown */}
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[var(--border)]">
                  <th className="text-left font-medium text-slate-600 py-2.5 px-3">Component</th>
                  <th className="text-left font-medium text-slate-600 py-2.5 px-3">Count</th>
                  <th className="text-left font-medium text-slate-600 py-2.5 px-3">Names</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2.5 px-3 font-medium">Knowledge bases</td>
                  <td className="py-2.5 px-3">{knowledgeBases.length}</td>
                  <td className="py-2.5 px-3">
                    {hasKnowledge ? (
                      <span className="text-slate-600">{knowledgeBases.map((kb) => kb.name).join(", ")}</span>
                    ) : (
                      <Link href="/dashboard/knowledge" className="text-brand-600 hover:underline">
                        Add knowledge base
                      </Link>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2.5 px-3 font-medium">Models</td>
                  <td className="py-2.5 px-3">{models.length}</td>
                  <td className="py-2.5 px-3">
                    {hasModels ? (
                      <span className="text-slate-600">{models.map((m) => m.name).join(", ")}</span>
                    ) : (
                      <Link href="/dashboard/models" className="text-brand-600 hover:underline">
                        Register a model
                      </Link>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2.5 px-3 font-medium">Deployments</td>
                  <td className="py-2.5 px-3">{deployments.length}</td>
                  <td className="py-2.5 px-3">
                    {deployments.length === 0 ? (
                      <Link href="/dashboard/deployments" className="text-brand-600 hover:underline">
                        Create deployment
                      </Link>
                    ) : (
                      <span className="text-slate-600">{deployments.map((dep) => dep.name).join(", ")}</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Chat sessions</td>
                  <td className="py-2.5 px-3">{sessions.length}</td>
                  <td className="py-2.5 px-3">
                    {sessions.length === 0 ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <span className="text-slate-600">
                        {sessions.map((s) => s.title || "Untitled").join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Next steps when not fully ready */}
          {(statusLevel === "partial" || statusLevel === "setup") && (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-[var(--radius)] p-3 border border-[var(--border)]">
              <p className="font-medium text-slate-700 mb-1">Next steps</p>
              <ul className="list-disc list-inside space-y-0.5">
                {!hasModels && (
                  <li>
                    <Link href="/dashboard/models" className="text-brand-600 hover:underline">
                      Register at least one model
                    </Link>{" "}
                    (Ollama, OpenAI-compatible, etc.)
                  </li>
                )}
                {hasModels && !canChat && (
                  <li>
                    <Link href="/dashboard/deployments" className="text-brand-600 hover:underline">
                      Create a deployment
                    </Link>{" "}
                    (pair a model with optional knowledge base)
                  </li>
                )}
                {canChat && (
                  <li>
                    <Link href="/dashboard/chat" className="text-brand-600 hover:underline">
                      Open Chat
                    </Link>{" "}
                    and pick a deployment to start talking.
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Live hosted deployments */}
      {(hostedLive > 0 || liveHostedLoading) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Live hosted deployments</h2>
              <p className="text-sm text-slate-500 mt-0.5 font-normal">
                Deployments currently running on the hosted API.
              </p>
            </div>
            <Link href="/dashboard/deployments" className="text-brand-600 hover:underline text-sm font-medium">
              Manage
            </Link>
          </CardHeader>
          <CardBody>
            {liveHostedLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                Loading hosted details…
              </div>
            ) : liveHosted.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No live hosted deployments.</p>
            ) : (
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-[var(--border)]">
                      <th className="text-left font-medium text-slate-600 py-2.5 px-3">Deployment</th>
                      <th className="text-left font-medium text-slate-600 py-2.5 px-3">Version</th>
                      <th className="text-left font-medium text-slate-600 py-2.5 px-3">Endpoint URL</th>
                      <th className="text-left font-medium text-slate-600 py-2.5 px-3">Status</th>
                      <th className="text-left font-medium text-slate-600 py-2.5 px-3">Memory</th>
                      <th className="text-left font-medium text-slate-600 py-2.5 px-3">Started</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {liveHosted.map(({ deployment, version, endpoint_url }) => (
                      <tr key={version.id} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="py-2.5 px-3 font-medium">{deployment.name}</td>
                        <td className="py-2.5 px-3">{version.version_label}</td>
                        <td className="py-2.5 px-3">
                          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded break-all">
                            {endpoint_url}
                          </code>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {version.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{version.memory_enabled ? "Yes" : "No"}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {version.started_at
                            ? new Date(version.started_at).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Recent chat sessions</h2>
          {sessions.length > 0 && (
            <Link href="/dashboard/chat">
              <Button variant="secondary">
                Open Chat
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardBody>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">
              No chat sessions yet. Start a conversation from{" "}
              <Link href="/dashboard/chat" className="text-brand-600 hover:underline font-medium">
                Chat
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recentSessions.map((s) => (
                <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/dashboard/chat?session=${encodeURIComponent(s.id)}`}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius)] p-2 -mx-2 hover:bg-slate-50 transition-colors group"
                  >
                    <span className="font-medium text-slate-800 truncate group-hover:text-brand-600">
                      {s.title || "Untitled"}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {formatRelativeTime(s.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/knowledge"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
        >
          <BookIcon />
          <span className="font-medium text-slate-800">Knowledge</span>
        </Link>
        <Link
          href="/dashboard/models"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
        >
          <CpuIcon />
          <span className="font-medium text-slate-800">Models</span>
        </Link>
        <Link
          href="/dashboard/deployments"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
        >
          <RocketIcon />
          <span className="font-medium text-slate-800">Deployments</span>
        </Link>
        <Link
          href="/dashboard/chat"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
        >
          <ChatIcon />
          <span className="font-medium text-slate-800">Chat</span>
        </Link>
      </div>
    </div>
  );
}
