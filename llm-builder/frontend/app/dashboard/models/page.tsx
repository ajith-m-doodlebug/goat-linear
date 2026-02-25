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

type Model = {
  id: string;
  name: string;
  model_type: string;
  provider: string;
  endpoint_url: string | null;
  model_id: string;
  version: string | null;
  created_at: string;
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testModelId, setTestModelId] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ endpoint_url: "", model_id: "" });
  const [form, setForm] = useState({
    name: "",
    provider: "ollama",
    endpoint_url: "",
    model_id: "llama2",
    api_key: "",
  });

  useTopBar(
    "Models",
    <Button variant="primary" onClick={() => setShowForm(true)}>
      Add model
    </Button>
  );

  const load = async () => {
    try {
      const list = await apiRequest<Model[]>("/api/v1/models");
      setModels(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/api/v1/models", {
        method: "POST",
        body: JSON.stringify({
          name: form.name || form.model_id,
          model_type: "base",
          provider: form.provider,
          endpoint_url: form.endpoint_url || null,
          model_id: form.model_id,
          api_key_encrypted: form.api_key || null,
        }),
      });
      setForm({ name: "", provider: "ollama", endpoint_url: "", model_id: "llama2", api_key: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const updateModel = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/v1/models/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          endpoint_url: editForm.endpoint_url || null,
          model_id: editForm.model_id,
        }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteModel = async (id: string) => {
    if (!confirm("Delete this model? Deployments using it may break.")) return;
    try {
      await apiRequest(`/api/v1/models/${id}`, { method: "DELETE" });
      if (testModelId === id) setTestModelId(null);
      setEditingId((current) => (current === id ? null : current));
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const runTest = async () => {
    if (!testModelId || !testPrompt.trim()) return;
    setTestLoading(true);
    setTestResult("");
    try {
      const res = await apiRequest<{ response: string }>(`/api/v1/models/${testModelId}/test`, {
        method: "POST",
        body: JSON.stringify({ prompt: testPrompt }),
      });
      setTestResult(res.response);
    } catch (err) {
      setTestResult("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTestLoading(false);
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
      <PageHeader description="Register LLM endpoints (Ollama, vLLM, OpenAI-compatible) for use in deployments and chat." />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add model">
        <form onSubmit={createModel} className="space-y-4">
          <div>
            <label className="label">Model type</label>
            <select
              value={form.provider}
              onChange={(e) => {
                const provider = e.target.value as "ollama" | "vllm" | "openai" | "custom";
                setForm((f) => ({
                  ...f,
                  provider,
                  endpoint_url:
                    provider === "ollama"
                      ? ""
                      : provider === "openai"
                        ? "https://api.openai.com"
                        : f.endpoint_url,
                  model_id:
                    provider === "ollama" ? "llama2" : provider === "openai" ? "gpt-4o" : f.model_id,
                  api_key: ["openai", "custom"].includes(provider) ? f.api_key : "",
                }));
              }}
              className="input"
            >
              <option value="ollama">Ollama</option>
              <option value="vllm">vLLM</option>
              <option value="openai">OpenAI</option>
              <option value="custom">Custom REST</option>
            </select>
          </div>
          <div>
            <label className="label">Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. My Llama"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Endpoint URL {form.provider === "ollama" ? "(optional)" : ""}</label>
            <input
              type="text"
              placeholder={
                form.provider === "ollama"
                  ? "e.g. http://host.docker.internal:11434"
                  : form.provider === "vllm"
                    ? "e.g. http://vllm:8000"
                    : form.provider === "openai"
                      ? "e.g. https://api.openai.com"
                      : "Base URL of your API"
              }
              value={form.endpoint_url}
              onChange={(e) => setForm((f) => ({ ...f, endpoint_url: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Model ID</label>
            <input
              type="text"
              placeholder={form.provider === "ollama" ? "e.g. llama2, mistral" : "e.g. gpt-4"}
              value={form.model_id}
              onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
              className="input"
            />
          </div>
          {(form.provider === "openai" || form.provider === "custom") && (
            <div>
              <label className="label">
                API key {form.provider === "openai" ? "(required for OpenAI)" : "(optional for custom)"}
              </label>
              <input
                type="password"
                placeholder={
                  form.provider === "openai"
                    ? "sk-... (from platform.openai.com)"
                    : "Bearer token if required"
                }
                value={form.api_key}
                onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                className="input"
              />
            </div>
          )}
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

      <Modal open={editingId != null} onClose={() => setEditingId(null)} title="Edit model">
        <form onSubmit={(e) => editingId && updateModel(e, editingId)} className="space-y-4">
          <div>
            <label className="label">Endpoint URL</label>
            <input
              type="text"
              placeholder="e.g. http://host.docker.internal:11434"
              value={editForm.endpoint_url}
              onChange={(e) => setEditForm((f) => ({ ...f, endpoint_url: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Model ID</label>
            <input
              type="text"
              placeholder="e.g. llama2, mistral"
              value={editForm.model_id}
              onChange={(e) => setEditForm((f) => ({ ...f, model_id: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-[28rem]">
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Registered models</h2>
          </CardHeader>
          <CardBody className="flex-1 min-h-0 overflow-y-auto">
            {models.length === 0 ? (
              <EmptyState
                title="No models yet"
                description="Add an Ollama, vLLM, or OpenAI-compatible model to use in deployments and chat."
                action={
                  <Button variant="primary" onClick={() => setShowForm(true)}>
                    Add model
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {models.map((m) => (
                  <li key={m.id} className="p-4 rounded-[var(--radius)] border border-[var(--border)] bg-slate-50/30">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-800">{m.name}</span>
                        <span className="text-slate-500 text-sm ml-2">{m.provider} / {m.model_id}</span>
                        {m.endpoint_url && (
                          <p className="text-slate-400 text-xs mt-1 truncate max-w-xs" title={m.endpoint_url}>
                            {m.endpoint_url}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setTestModelId(m.id);
                            setTestPrompt("");
                            setTestResult("");
                          }}
                        >
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditForm({ endpoint_url: m.endpoint_url || "", model_id: m.model_id });
                          }}
                          title="Edit"
                        >
                          <EditIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteModel(m.id)}
                          title="Delete"
                        >
                          <DeleteIcon />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {testModelId && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800">Test prompt</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt..."
                rows={4}
                className="input resize-y"
              />
              <Button onClick={runTest} variant="primary" disabled={testLoading}>
                {testLoading ? "Running…" : "Run"}
              </Button>
              {testResult && (
                <div className="p-4 rounded-[var(--radius)] bg-slate-100 text-slate-800 whitespace-pre-wrap text-sm">
                  {testResult}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
