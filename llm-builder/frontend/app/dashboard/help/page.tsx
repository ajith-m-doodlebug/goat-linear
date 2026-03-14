"use client";

import Link from "next/link";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody } from "@/app/components/ui/Card";

const steps = [
  { num: 1, title: "Knowledge", line: "Upload docs → chunk & embed for RAG", href: "/dashboard/knowledge" },
  { num: 2, title: "Models", line: "Register Ollama, vLLM, or OpenAI-style endpoints", href: "/dashboard/models" },
  { num: 3, title: "Deployments", line: "Model + optional KB + prompt = chat target", href: "/dashboard/deployments" },
  { num: 4, title: "Chat", line: "Pick a deployment, chat with RAG when KB linked", href: "/dashboard/chat" },
];

const features: { label: string; line: string; href: string }[] = [
  { label: "Knowledge", line: "Docs, chunking, embeddings", href: "/dashboard/knowledge" },
  { label: "Models", line: "Test & health checks", href: "/dashboard/models" },
  { label: "Deployments", line: "Hosted API, versions, export", href: "/dashboard/deployments" },
  { label: "Chat", line: "Sessions, citations, memory", href: "/dashboard/chat" },
  { label: "Prompts", line: "Templates with {context}, {question}", href: "/dashboard/prompts" },
  { label: "Chunking & embedding", line: "RAG config presets", href: "/dashboard/rag-configs" },
];

export default function HelpPage() {
  useTopBar("Help & features", null);
  return (
    <div className="space-y-8">
      <PageHeader description="Quick reference: get started and where to find each feature." />

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Get started</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <Link key={s.num} href={s.href}>
              <Card className="overflow-hidden hover:border-brand-300 transition-colors h-full">
                <CardBody className="flex flex-row items-center gap-3 py-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                    {s.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500 truncate">{s.line}</p>
                  </div>
                  <span className="flex-shrink-0 text-slate-400 ml-auto">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Features</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link key={f.href} href={f.href}>
              <Card className="overflow-hidden hover:border-brand-300 transition-colors">
                <CardBody className="py-3 px-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{f.label}</p>
                    <p className="text-xs text-slate-500 truncate">{f.line}</p>
                  </div>
                  <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
