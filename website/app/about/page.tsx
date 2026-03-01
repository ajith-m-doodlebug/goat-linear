export const metadata = {
  title: "About | RAGline",
  description: "About RAGline: self-hosted AI infrastructure for RAG, deployments, and chat.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground">About RAGline</h1>
      <p className="mt-2 text-muted">
        Self-hosted AI infrastructure for teams who want control and privacy.
      </p>

      <div className="mt-10 prose prose-slate max-w-none">
        <p className="text-muted leading-relaxed">
          RAGline delivers LLM Builder—a platform that lets you run RAG (retrieval-augmented generation), register LLM endpoints, create deployments that combine knowledge bases with models, and chat with your data—all on your own infrastructure.
        </p>
        <p className="text-muted leading-relaxed mt-4">
          The goal is to give you a single place to upload documents, configure models, and have conversations that use your data as context, with citations you can trust. No vendor lock-in: you bring your models and your data, we provide the orchestration.
        </p>
      </div>
    </div>
  );
}
