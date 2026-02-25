"use client";

import Link from "next/link";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

const steps = [
  {
    num: 1,
    title: "Knowledge",
    body: "Create a knowledge base and upload documents (PDF, DOCX, TXT, HTML). Files are chunked and embedded for RAG.",
    href: "/dashboard/knowledge",
    linkLabel: "Open Documents",
  },
  {
    num: 2,
    title: "Models",
    body: "Register your LLMs (Ollama, vLLM, OpenAI-compatible). The app uses these for chat and deployments.",
    href: "/dashboard/models",
    linkLabel: "Open Models",
  },
  {
    num: 3,
    title: "Deployments",
    body: "Pair a model with an optional knowledge base. Each deployment is a chat target (e.g. support bot with RAG).",
    href: "/dashboard/deployments",
    linkLabel: "Open Deployments",
  },
  {
    num: 4,
    title: "Chat",
    body: "Pick a deployment and chat. Answers are grounded in your documents when a knowledge base is linked.",
    href: "/dashboard/chat",
    linkLabel: "Open Chat",
  },
];

export default function DashboardPage() {
  useTopBar("Home", null);
  return (
    <div>
      <PageHeader description="Get started by adding documents, registering a model, creating a deployment, then chatting." />

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((s) => (
          <Card key={s.num} className="overflow-hidden">
            <CardBody className="flex flex-col sm:flex-row gap-4">
              <span className="flex-shrink-0 w-10 h-10 rounded-[var(--radius)] bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
                {s.num}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-slate-800 mb-1">{s.title}</h2>
                <p className="text-sm text-slate-600 mb-4">{s.body}</p>
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-1.5 text-brand-600 font-medium text-sm hover:text-brand-700 hover:underline"
                >
                  {s.linkLabel}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--border)]">
        <p className="text-sm text-slate-500 mb-2">Also available</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/training">
            <Button variant="ghost">Training</Button>
          </Link>
          <Link href="/dashboard/audit">
            <Button variant="ghost">Audit</Button>
          </Link>
          <Link href="/dashboard/api-keys">
            <Button variant="ghost">API Keys</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
