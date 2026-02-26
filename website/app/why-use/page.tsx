export const metadata = {
  title: "Why use | LLM Builder",
  description: "Why choose LLM Builder: self-hosted, privacy, RAG, model registry, deployments, and chat.",
};

export default function WhyUsePage() {
  const points = [
    {
      title: "Self-hosted",
      description: "Run everything on your own infrastructure. No data leaves your environment unless you connect to external APIs.",
    },
    {
      title: "Privacy and control",
      description: "Your documents and conversations stay in your database and vector store. You decide which models to use and how to scale.",
    },
    {
      title: "RAG out of the box",
      description: "Upload documents, create knowledge bases, and chat with your data. Hybrid retrieval and configurable chunking help you get accurate, cited answers.",
    },
    {
      title: "Model registry",
      description: "Register Ollama, vLLM, OpenAI-compatible, or custom REST endpoints. Switch models per deployment without changing your workflow.",
    },
    {
      title: "Deployments and chat",
      description: "Combine a model with a knowledge base and prompts into a deployment. Use Chat to query with RAG and conversation memory.",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground">Why use LLM Builder</h1>
      <p className="mt-2 text-muted">
        A single platform for self-hosted AI: RAG, models, and chat.
      </p>

      <ul className="mt-10 space-y-8">
        {points.map((item, i) => (
          <li key={i} className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
              {i + 1}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
              <p className="mt-1 text-muted">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
