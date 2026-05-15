"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody } from "@/app/components/ui/Card";

function useProjectBase(): string {
  const params = useParams();
  const id = typeof params.projectId === "string" ? params.projectId : "";
  return id ? `/dashboard/projects/${id}` : "";
}

export default function ProjectHelpPage() {
  const base = useProjectBase();
  useTopBar("Help & features", null);

  const step = (href: string, num: number, title: string, line: string) => (
    <Link href={href}>
      <Card className="overflow-hidden hover:border-brand-300 transition-colors h-full">
        <CardBody className="flex flex-row items-center gap-3 py-3">
          <span className="flex-shrink-0 w-8 h-8 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
            {num}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">{line}</p>
          </div>
          <span className="flex-shrink-0 text-slate-400 ml-auto" aria-hidden>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </CardBody>
      </Card>
    </Link>
  );

  const feat = (href: string, label: string, line: string) => (
    <Link href={href}>
      <Card className="overflow-hidden hover:border-brand-300 transition-colors h-full">
        <CardBody className="py-3 px-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-slate-800 text-sm">{label}</p>
            <p className="text-xs text-slate-500">{line}</p>
          </div>
          <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </CardBody>
      </Card>
    </Link>
  );

  if (!base) {
    return <p className="text-sm text-slate-600">Invalid project.</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader description="Cards link to areas in this project. Admins: Users & Host Models in the sidebar." />

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Suggested order</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {step(`${base}/knowledge`, 1, "Knowledge", "Sources, chunking & embed; run per-document tests where available")}
          {step(`${base}/models`, 2, "Models", "Link healthy self-hosted endpoints or (admins) register other providers—only linked models appear here")}
          {step(`${base}/intent-mapper`, 3, "Intent Mapper", "Optional: route questions to one document with a routing model")}
          {step(`${base}/deployments/new/canvas`, 4, "New deployment", "Full-page canvas: drag nodes, set pipeline, create")}
          {step(`${base}/deployments`, 5, "Deployments list", "Hosted API, versions, export; open Canvas on an existing row to edit")}
          {step(`${base}/chat`, 6, "Chat", "Try a deployment with citations when retrieval is on")}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Areas in this project</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {feat(`${base}`, "Project home", "Overview tiles and shortcuts")}
          {feat(`${base}/knowledge`, "Knowledge", "Documents, APIs, DB-backed sources for RAG")}
          {feat(`${base}/models`, "Models", "Project-scoped endpoints; self-hosted from Host Models when healthy")}
          {feat(`${base}/intent-mapper`, "Intent Mapper", "Intents per document and routing tests")}
          {feat(`${base}/deployments/new/canvas`, "New deployment (canvas)", "Visual builder; creates the deployment when you save")}
          {feat(`${base}/deployments`, "Deployments", "List, host, versions, export; Canvas link per row")}
          {feat(`${base}/chat`, "Chat", "Sessions, memory, citations")}
          {feat(`${base}/prompts`, "Prompts", "Templates with placeholders like {context} and {question}")}
          {feat(`${base}/rag-configs`, "Chunking & embedding", "Presets for ingestion and vector settings")}
          {feat(`/dashboard/projects`, "All projects", "Create, clone, share, or archive projects")}
          {feat(`${base}/host-models`, "Host Models (super admin)", "Run and register vLLM self-hosted instances")}
        </div>
      </section>
    </div>
  );
}
