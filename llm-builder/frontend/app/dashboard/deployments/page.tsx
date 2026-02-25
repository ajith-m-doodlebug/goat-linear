"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import { EditIcon, DeleteIcon } from "@/app/components/ui/icons";

type Deployment = {
  id: string;
  name: string;
  model_id: string;
  knowledge_base_id: string | null;
  prompt_template_id: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
};

type Model = { id: string; name: string; model_id: string };
type KnowledgeBase = { id: string; name: string };
type PromptTemplate = { id: string; name: string };

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [runResult, setRunResult] = useState<{ response: string; citations: { text: string; source: string; score: number }[] } | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    model_id: "",
    knowledge_base_id: "",
    prompt_template_id: "",
  });
  const [editDeploymentId, setEditDeploymentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    model_id: "",
    knowledge_base_id: "",
    prompt_template_id: "",
  });

  useTopBar(
    "Deployments",
    <Button variant="primary" onClick={() => setShowForm(true)}>
      New deployment
    </Button>
  );

  const load = async () => {
    try {
      const [deps, mods, kbs, tmpls] = await Promise.all([
        apiRequest<Deployment[]>("/api/v1/deployments"),
        apiRequest<Model[]>("/api/v1/models"),
        apiRequest<KnowledgeBase[]>("/api/v1/knowledge-bases"),
        apiRequest<PromptTemplate[]>("/api/v1/deployments/prompt-templates"),
      ]);
      setDeployments(deps);
      setModels(mods);
      setKnowledgeBases(kbs);
      setTemplates(tmpls);
      if (mods.length && !form.model_id) setForm((f) => ({ ...f, model_id: mods[0].id }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.model_id) return;
    try {
      await apiRequest("/api/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          model_id: form.model_id,
          knowledge_base_id: form.knowledge_base_id || null,
          prompt_template_id: form.prompt_template_id || null,
        }),
      });
      setForm((f) => ({ ...f, name: "" }));
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const run = async () => {
    if (!testId || !question.trim()) return;
    setRunLoading(true);
    setRunResult(null);
    try {
      const res = await apiRequest<{ response: string; citations: { text: string; source: string; score: number }[] }>(
        `/api/v1/deployments/${testId}/run`,
        { method: "POST", body: JSON.stringify({ question }) }
      );
      setRunResult(res);
    } catch (err) {
      setRunResult({ response: "Error: " + (err instanceof Error ? err.message : String(err)), citations: [] });
    } finally {
      setRunLoading(false);
    }
  };

  const updateDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDeploymentId || !editForm.name.trim() || !editForm.model_id) return;
    try {
      await apiRequest(`/api/v1/deployments/${editDeploymentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          model_id: editForm.model_id,
          knowledge_base_id: editForm.knowledge_base_id || null,
          prompt_template_id: editForm.prompt_template_id || null,
        }),
      });
      setEditDeploymentId(null);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDeployment = async (id: string) => {
    if (!confirm("Delete this deployment? Chat sessions using it may break.")) return;
    try {
      await apiRequest(`/api/v1/deployments/${id}`, { method: "DELETE" });
      if (testId === id) setTestId(null);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="mt-3 text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader description="Pair a model with an optional knowledge base. Each deployment is a chat target (e.g. support bot with RAG)." />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New deployment">
        <form onSubmit={createDeployment} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              placeholder="e.g. Support bot"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Model</label>
            <select
              value={form.model_id}
              onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
              className="input"
              required
            >
              <option value="">Select model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Knowledge base (optional)</label>
            <select
              value={form.knowledge_base_id}
              onChange={(e) => setForm((f) => ({ ...f, knowledge_base_id: e.target.value }))}
              className="input"
            >
              <option value="">None</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prompt template (optional)</label>
            <select
              value={form.prompt_template_id}
              onChange={(e) => setForm((f) => ({ ...f, prompt_template_id: e.target.value }))}
              className="input"
            >
              <option value="">Default</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">
              Create
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editDeploymentId != null} onClose={() => setEditDeploymentId(null)} title="Edit deployment">
        <form onSubmit={updateDeployment} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              placeholder="e.g. Support bot"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Model</label>
            <select
              value={editForm.model_id}
              onChange={(e) => setEditForm((f) => ({ ...f, model_id: e.target.value }))}
              className="input"
              required
            >
              <option value="">Select model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Knowledge base (optional)</label>
            <select
              value={editForm.knowledge_base_id}
              onChange={(e) => setEditForm((f) => ({ ...f, knowledge_base_id: e.target.value }))}
              className="input"
            >
              <option value="">None</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prompt template (optional)</label>
            <select
              value={editForm.prompt_template_id}
              onChange={(e) => setEditForm((f) => ({ ...f, prompt_template_id: e.target.value }))}
              className="input"
            >
              <option value="">Default</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditDeploymentId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-[28rem]">
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Deployments</h2>
          </CardHeader>
          <CardBody className="flex-1 min-h-0 overflow-y-auto">
            {deployments.length === 0 ? (
              <EmptyState
                title="No deployments"
                description="Create a deployment to use in Chat. Link a knowledge base for RAG-powered answers."
                action={
                  <Button variant="primary" onClick={() => setShowForm(true)}>
                    New deployment
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {deployments.map((d) => (
                  <li
                    key={d.id}
                    className="flex justify-between items-center gap-2 p-3 rounded-[var(--radius)] border border-[var(--border)] hover:bg-slate-50/50"
                  >
                    <span className="font-medium text-slate-800 truncate min-w-0">{d.name}</span>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setTestId(d.id);
                          setQuestion("");
                          setRunResult(null);
                        }}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditDeploymentId(d.id);
                          setEditForm({
                            name: d.name,
                            model_id: d.model_id,
                            knowledge_base_id: d.knowledge_base_id ?? "",
                            prompt_template_id: d.prompt_template_id ?? "",
                          });
                        }}
                        title="Edit"
                      >
                        <EditIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteDeployment(d.id)}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {testId && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800">Test run</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question..."
                rows={4}
                className="input resize-y"
              />
              <Button onClick={run} variant="primary" disabled={runLoading}>
                {runLoading ? "Running…" : "Run"}
              </Button>
              {runResult && (
                <div className="space-y-3">
                  <div className="p-4 rounded-[var(--radius)] bg-slate-100 text-slate-800 whitespace-pre-wrap text-sm">
                    {runResult.response}
                  </div>
                  {runResult.citations?.length > 0 && (
                    <div className="text-xs text-slate-600">
                      <span className="font-medium">Sources:</span>
                      {runResult.citations.map((c, i) => (
                        <div key={i} className="mt-1">— {c.source} (score: {c.score?.toFixed(2)})</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
