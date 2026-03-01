export const metadata = {
  title: "How to use | RAGline",
  description: "Learn how to use LLM Builder: start the app, register, create knowledge bases, add models, deploy, and chat.",
};

export default function HowToUsePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground">How to use LLM Builder</h1>
      <p className="mt-2 text-muted">
        Get from zero to chat with your data in a few steps.
      </p>

      <div className="mt-10 space-y-10">
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Start the app</h2>
          <p className="mt-2 text-muted">
            Run the stack (e.g. with Docker Compose or the provided start script). The web UI and API will be available at their configured ports. Open the app URL in your browser.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Register and log in</h2>
          <p className="mt-2 text-muted">
            Create an account in the app. The first user has full access. Log in with your email and password to use Knowledge, Models, Deployments, and Chat.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. Upload files into a knowledge base (RAG)</h2>
          <p className="mt-2 text-muted">
            Go to Knowledge, create a knowledge base, and upload documents (e.g. PDF, TXT, DOCX). Files are processed in the background: extracted, chunked, embedded, and stored in the vector database. You can track status and re-ingest if needed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Add models</h2>
          <p className="mt-2 text-muted">
            In the Models screen, register your LLM endpoints (e.g. Ollama, vLLM, or OpenAI-compatible APIs). Add a name, provider, endpoint URL, model ID, and optional API key. Use the Test button to verify the model responds.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Create deployments</h2>
          <p className="mt-2 text-muted">
            A deployment ties a knowledge base (RAG) to a model and optional prompt template. Create one or more deployments so Chat can use them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Chat</h2>
          <p className="mt-2 text-muted">
            Go to Chat, pick a deployment, and ask questions. When the deployment has a knowledge base, answers use RAG: your question is used to retrieve relevant chunks, which are sent to the model as context. Responses can include citations to the source chunks.
          </p>
        </section>
      </div>
    </div>
  );
}
