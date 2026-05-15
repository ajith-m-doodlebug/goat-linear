"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest, authApi } from "@/lib/api";
import { projectApi } from "@/lib/projectApi";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import { EditIcon, DeleteIcon } from "@/app/components/ui";

function providerLabel(provider: string): string {
  if (provider === "ragline_self_hosted") return "Ragline (Self Hosted)";
  return provider;
}

type Model = {
  id: string;
  name: string;
  model_type: string;
  provider: string;
  endpoint_url: string | null;
  model_id: string;
  version: string | null;
  created_at: string;
  host_instance_status?: string | null;
};

export default function ModelsPage() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
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
  const [healthyHosted, setHealthyHosted] = useState<Model[]>([]);
  const [selectedHostedId, setSelectedHostedId] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const canRegisterGlobal = userRole === "admin" || userRole === "super_admin";
  const canModifyProjectModels =
    userRole === "super_admin" || userRole === "admin" || userRole === "developer";

  useTopBar(
    "Models",
    canModifyProjectModels ? (
      <Button variant="primary" onClick={() => setShowAdd(true)}>
        Add model
      </Button>
    ) : null,
    userRole,
  );

  useEffect(() => {
    authApi
      .me()
      .then((u) => setUserRole(u.role))
      .catch(() => setUserRole(""))
      .finally(() => setAuthReady(true));
  }, []);

  const refreshModels = useCallback(async () => {
    if (!authReady || userRole === null || !projectId) return;
    setLoading(true);
    try {
      const list = await apiRequest<Model[]>(projectApi(projectId, "models"));
      setModels(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authReady, userRole, projectId]);

  const loadHealthyHosted = useCallback(async () => {
    try {
      const list = await apiRequest<Model[]>("/api/v1/models/self-hosted-healthy-options");
      setHealthyHosted(list);
      setSelectedHostedId((prev) => {
        if (!list.length) return "";
        if (prev && list.some((m) => m.id === prev)) return prev;
        return list[0].id;
      });
    } catch (e) {
      console.error(e);
      setHealthyHosted([]);
      setSelectedHostedId("");
    }
  }, []);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (showAdd && canModifyProjectModels) void loadHealthyHosted();
  }, [showAdd, canModifyProjectModels, loadHealthyHosted]);

  const linkSelfHosted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedHostedId) return;
    setLinkBusy(true);
    try {
      await apiRequest(projectApi(projectId, "models"), {
        method: "POST",
        body: JSON.stringify({ model_id: selectedHostedId }),
      });
      setShowAdd(false);
      await refreshModels();
    } catch (err) {
      console.error(err);
    } finally {
      setLinkBusy(false);
    }
  };

  const createAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRegisterGlobal || !projectId) return;
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/models", {
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
      await apiRequest(projectApi(projectId, "models"), {
        method: "POST",
        body: JSON.stringify({ model_id: created.id }),
      });
      setForm({ name: "", provider: "ollama", endpoint_url: "", model_id: "llama2", api_key: "" });
      setShowAdd(false);
      await refreshModels();
    } catch (err) {
      console.error(err);
    }
  };

  const updateModel = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!canRegisterGlobal) return;
    try {
      await apiRequest(`/api/v1/models/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          endpoint_url: editForm.endpoint_url || null,
          model_id: editForm.model_id,
        }),
      });
      setEditingId(null);
      await refreshModels();
    } catch (err) {
      console.error(err);
    }
  };

  const removeFromProject = async (registryId: string) => {
    if (!projectId || !canModifyProjectModels) return;
    if (!confirm("Remove this model from the project?")) return;
    try {
      await apiRequest(projectApi(projectId, `models/${registryId}`), { method: "DELETE" });
      if (testModelId === registryId) setTestModelId(null);
      setEditingId((current) => (current === registryId ? null : current));
      await refreshModels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(typeof msg === "string" ? msg : "Could not remove (check deployments and intent mappers first).");
    }
  };

  const deleteRegistry = async (id: string) => {
    if (!canRegisterGlobal) return;
    if (!confirm("Delete this endpoint from the system for all projects? Deployments elsewhere may break.")) return;
    try {
      await apiRequest(`/api/v1/models/${id}`, { method: "DELETE" });
      await refreshModels();
    } catch (err) {
      console.error(err);
    }
  };

  const runTest = async () => {
    if (!projectId || !testModelId || !testPrompt.trim()) return;
    setTestLoading(true);
    setTestResult("");
    try {
      const res = await apiRequest<{ response: string }>(projectApi(projectId, `models/${testModelId}/test`), {
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

  if (!authReady || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="mt-3 text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        description={
          canRegisterGlobal
            ? "Link healthy host models or add other providers. Only listed models are used in this project."
            : "Link models you need; self-hosted must be healthy. Ask an admin to register other providers."
        }
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add model to project">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">RAGLine self-hosted</h3>
            <p className="text-xs text-slate-500 mb-2">
              Must be registered in Host Models first. Listed endpoints are reaching healthy status only.
            </p>
            {healthyHosted.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No healthy self-hosted endpoints available.</p>
            ) : (
              <form onSubmit={linkSelfHosted} className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 min-w-0">
                  <label className="label">Endpoint</label>
                  <select
                    className="input"
                    value={selectedHostedId}
                    onChange={(e) => setSelectedHostedId(e.target.value)}
                    required
                  >
                    {healthyHosted.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.model_id})
                        {m.host_instance_status ? ` — ${m.host_instance_status}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="primary" disabled={linkBusy}>
                  {linkBusy ? "Linking…" : "Link"}
                </Button>
              </form>
            )}
          </div>

          {canRegisterGlobal && (
            <div className="border-t border-[var(--border)] pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Register other provider</h3>
              <form onSubmit={createAndLink} className="space-y-4">
                <div>
                  <label className="label">Provider</label>
                  <select
                    value={form.provider}
                    onChange={(e) => {
                      const provider = e.target.value as
                        | "ollama"
                        | "vllm"
                        | "openai"
                        | "anthropic"
                        | "custom";
                      setForm((f) => ({
                        ...f,
                        provider,
                        endpoint_url:
                          provider === "ollama"
                            ? ""
                            : provider === "openai"
                              ? "https://api.openai.com"
                              : provider === "anthropic"
                                ? "https://api.anthropic.com"
                                : f.endpoint_url,
                        model_id:
                          provider === "ollama"
                            ? "llama2"
                            : provider === "openai"
                              ? "gpt-4o"
                              : provider === "anthropic"
                                ? "claude-3-5-sonnet-20241022"
                                : f.model_id,
                        api_key: ["openai", "anthropic", "custom"].includes(provider) ? f.api_key : "",
                      }));
                    }}
                    className="input"
                  >
                    <option value="ollama">Ollama</option>
                    <option value="vllm">vLLM</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
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
                            : form.provider === "anthropic"
                              ? "https://api.anthropic.com"
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
                    value={form.model_id}
                    onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                    className="input"
                  />
                </div>
                {(form.provider === "openai" || form.provider === "anthropic" || form.provider === "custom") && (
                  <div>
                    <label className="label">API key</label>
                    <input
                      type="password"
                      value={form.api_key}
                      onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                      className="input"
                    />
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" variant="primary">
                    Create & link
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
                    Close
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={editingId != null} onClose={() => setEditingId(null)} title="Edit model">
        <form onSubmit={(e) => editingId && updateModel(e, editingId)} className="space-y-4">
          <div>
            <label className="label">Endpoint URL</label>
            <input
              type="text"
              value={editForm.endpoint_url}
              onChange={(e) => setEditForm((f) => ({ ...f, endpoint_url: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Model ID</label>
            <input
              type="text"
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

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="flex flex-col">
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Models in this project</h2>
          </CardHeader>
          <CardBody>
            {models.length === 0 ? (
              <EmptyState
                title="No models linked yet"
                description={
                  canModifyProjectModels
                    ? "Add a healthy self-hosted endpoint or register another provider."
                    : "Editors can attach models once they are configured."
                }
                action={
                  canModifyProjectModels ? (
                    <Button variant="primary" onClick={() => setShowAdd(true)}>
                      Add model
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="space-y-3">
                {models.map((m) => (
                  <li key={m.id} className="p-4 rounded-[var(--radius)] border border-[var(--border)] bg-slate-50/30">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-800">{m.name}</span>
                        <span className="text-slate-500 text-sm ml-2">
                          {providerLabel(m.provider)} / {m.model_id}
                        </span>
                        {m.host_instance_status && (
                          <span className="ml-2 align-middle inline-block">
                            <Badge variant="default">host: {m.host_instance_status}</Badge>
                          </span>
                        )}
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
                        {canModifyProjectModels && (
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeFromProject(m.id)}
                            title="Remove from project"
                          >
                            <DeleteIcon />
                          </Button>
                        )}
                        {canRegisterGlobal && m.provider !== "ragline_self_hosted" && (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingId(m.id);
                                setEditForm({ endpoint_url: m.endpoint_url || "", model_id: m.model_id });
                              }}
                              title="Edit endpoint"
                            >
                              <EditIcon />
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-red-700 hover:bg-red-50"
                              onClick={() => deleteRegistry(m.id)}
                              title="Delete from system"
                            >
                              Erase
                            </Button>
                          </>
                        )}
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
