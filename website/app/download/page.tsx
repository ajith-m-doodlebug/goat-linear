"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const DEFAULT_PULL = "docker pull llmbuilder/llm-builder:latest";
const DEFAULT_RUN = "docker run -p 3000:3000 -p 8000:8000 llmbuilder/llm-builder:latest";

export default function DownloadPage() {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  const pullCmd = process.env.NEXT_PUBLIC_DOCKER_IMAGE
    ? `docker pull ${process.env.NEXT_PUBLIC_DOCKER_IMAGE}`
    : DEFAULT_PULL;
  const runCmd = process.env.NEXT_PUBLIC_DOCKER_RUN_CMD || DEFAULT_RUN;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login?next=/download");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-4xl font-bold text-foreground tracking-tight">Download LLM Builder</h1>
      <p className="mt-3 text-muted text-lg">
        Use the Docker commands below to pull and run the packaged LLM Builder.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-muted mb-2">1. Pull the image</h2>
          <div className="relative rounded-xl bg-gray-900 text-gray-100 p-4 font-mono text-sm overflow-x-auto">
            <pre className="pr-12">{pullCmd}</pre>
            <button
              type="button"
              onClick={() => copy(pullCmd, "pull")}
              className="absolute top-3 right-3 rounded-lg bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600 transition-colors"
            >
              {copied === "pull" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted mb-2">2. Run the container</h2>
          <div className="relative rounded-xl bg-gray-900 text-gray-100 p-4 font-mono text-sm overflow-x-auto">
            <pre className="pr-12 whitespace-pre-wrap break-all">{runCmd}</pre>
            <button
              type="button"
              onClick={() => copy(runCmd, "run")}
              className="absolute top-3 right-3 rounded-lg bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600 transition-colors"
            >
              {copied === "run" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <p className="text-sm text-muted">
          After the container is running, open the web UI at the port shown (e.g. http://localhost:3000) and register a user to start using Knowledge, Models, Deployments, and Chat.
        </p>
      </div>
    </div>
  );
}
