"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { projectApi } from "@/lib/projectApi";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import {
  HelpCircleIcon,
  BookIcon,
  CpuIcon,
  LayersIcon,
  RocketIcon,
  ChatBubbleIcon,
  DocumentTextIcon,
} from "@/app/components/ui";

type ProjectInfo = {
  id: string;
  name: string;
  description: string | null;
};

type StatKey = "kb" | "deployments" | "mappers" | "models";

const sections: Array<{
  label: string;
  hint: string;
  items: Array<{
    hrefSuffix: string;
    title: string;
    subtitle: string;
    Icon: typeof BookIcon;
    accent: string;
    statKey?: StatKey;
  }>;
}> = [
  {
    label: "Data & prompts",
    hint: "Sources, presets, and templates",
    items: [
      {
        hrefSuffix: "knowledge",
        title: "Knowledge",
        subtitle: "Documents, APIs, DB sources",
        Icon: BookIcon,
        accent: "bg-sky-50 text-sky-700 ring-sky-200/80",
        statKey: "kb",
      },
      {
        hrefSuffix: "rag-configs",
        title: "Chunking & embedding",
        subtitle: "Presets for ingestion",
        Icon: LayersIcon,
        accent: "bg-violet-50 text-violet-700 ring-violet-200/80",
      },
      {
        hrefSuffix: "prompts",
        title: "Prompts",
        subtitle: "Templates for deployments",
        Icon: DocumentTextIcon,
        accent: "bg-amber-50 text-amber-800 ring-amber-200/80",
      },
    ],
  },
  {
    label: "Models & routing",
    hint: "Endpoints and intent selection",
    items: [
      {
        hrefSuffix: "models",
        title: "Models",
        subtitle: "LLMs linked to this project",
        Icon: CpuIcon,
        accent: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
        statKey: "models",
      },
      {
        hrefSuffix: "intent-mapper",
        title: "Intent mapper",
        subtitle: "Route questions to sources",
        Icon: LayersIcon,
        accent: "bg-indigo-50 text-indigo-800 ring-indigo-200/80",
        statKey: "mappers",
      },
    ],
  },
  {
    label: "Ship & try",
    hint: "Deploy and test in chat",
    items: [
      {
        hrefSuffix: "deployments",
        title: "Deployments",
        subtitle: "Host, versions, canvas, export",
        Icon: RocketIcon,
        accent: "bg-rose-50 text-rose-800 ring-rose-200/80",
        statKey: "deployments",
      },
      {
        hrefSuffix: "chat",
        title: "Chat",
        subtitle: "Try a deployment",
        Icon: ChatBubbleIcon,
        accent: "bg-cyan-50 text-cyan-800 ring-cyan-200/80",
      },
    ],
  },
];

export default function ProjectHomePage() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [stats, setStats] = useState<Record<StatKey, number | null>>({
    kb: null,
    deployments: null,
    mappers: null,
    models: null,
  });
  const [loadError, setLoadError] = useState(false);

  useTopBar(project?.name ?? "Home", null, project?.id);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoadError(false);

    Promise.all([
      apiRequest<ProjectInfo>(`/api/v1/projects/${projectId}`),
      apiRequest<Array<{ id: string }>>(projectApi(projectId, "knowledge-bases")),
      apiRequest<Array<{ id: string }>>(projectApi(projectId, "deployments")),
      apiRequest<Array<{ id: string }>>(projectApi(projectId, "intent-mappers")),
      apiRequest<Array<{ id: string }>>(projectApi(projectId, "models")),
    ])
      .then(([p, kb, deps, ims, mods]) => {
        if (!cancelled) {
          setProject(p);
          setStats({
            kb: kb.length,
            deployments: deps.length,
            mappers: ims.length,
            models: mods.length,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProject(null);
          setStats({ kb: null, deployments: null, mappers: null, models: null });
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function statFor(key?: StatKey): number | null {
    return key ? stats[key] : null;
  }

  const base = `/dashboard/projects/${projectId}`;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
        <div
          className="absolute inset-0 opacity-[0.55] pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-50) 0%, transparent 45%, rgb(239 246 255 / 0.4) 100%)",
          }}
        />
        <div className="relative px-6 py-8 sm:px-8 sm:py-10 md:flex md:flex-wrap md:items-start md:justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/90 mb-2">Workspace</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {loadError ? "Project" : project?.name ?? "…"}
            </h1>
            {project?.description ? (
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{project.description}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Manage knowledge, models, deployments, and chat—all scoped to this project.
              </p>
            )}
            <dl className="mt-6 flex flex-wrap gap-3">
              {(
                [
                  ["Knowledge bases", "kb"],
                  ["Deployments", "deployments"],
                  ["Intent mappers", "mappers"],
                  ["Linked models", "models"],
                ] as const
              ).map(([label, key]) => (
                <div
                  key={key}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-white/90 backdrop-blur-sm px-4 py-2.5 shadow-sm"
                >
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-800">
                    {stats[key] === null ? "—" : stats[key]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-6 md:mt-0 shrink-0 flex flex-col gap-2 sm:flex-row md:flex-col">
            <Link
              href={`${base}/help`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
            >
              <HelpCircleIcon className="w-4 h-4" />
              Help & features
            </Link>
            <Link
              href="/dashboard/projects"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-[var(--radius)] text-sm font-medium text-slate-600 bg-white/90 hover:bg-white border border-[var(--border)] transition-colors"
            >
              All projects
            </Link>
          </div>
        </div>
      </div>

      {/* Grouped shortcuts */}
      {sections.map((section) => (
        <section key={section.label}>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{section.label}</h2>
              <p className="text-sm text-slate-500">{section.hint}</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map((item) => {
              const href = `${base}/${item.hrefSuffix}`;
              const n = statFor(item.statKey);
              return (
                <li key={item.hrefSuffix}>
                  <Link
                    href={href}
                    className="group flex items-stretch gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] transition-all hover:border-brand-200 hover:shadow-[var(--shadow-md)]"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] ring-1 ${item.accent}`}
                      aria-hidden
                    >
                      <item.Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                          {item.title}
                        </h3>
                        <span className="text-slate-300 group-hover:text-brand-400 transition-colors shrink-0" aria-hidden>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{item.subtitle}</p>
                      {typeof n === "number" && (
                        <p className="mt-2 text-xs font-semibold text-brand-700 tabular-nums">{n} in project</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
