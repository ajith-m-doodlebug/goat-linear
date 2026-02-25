import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--background)]">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">LLM Builder</h1>
        <p className="text-slate-600 mb-8">Self-hosted AI: documents, models, RAG, and chat in one place.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-[var(--radius)] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-[var(--radius)] font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
