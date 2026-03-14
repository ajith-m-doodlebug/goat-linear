"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import { EditIcon, DeleteIcon, PlayIcon, StopIcon, DownloadIcon } from "@/app/components/ui";

type Deployment = {
  id: string;
  name: string;
  model_id: string;
  knowledge_base_id: string | null;
  prompt_template_id: string | null;
  is_hosted: boolean;
  live_version: string | null;
  created_at: string;
  has_hosted_versions?: boolean;
  hosted_status?: "live" | "stopped" | null;
};

type DeploymentVersion = {
  id: string;
  deployment_id: string;
  version_label: string;
  status: string;
  memory_enabled: boolean;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
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
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deployModalId, setDeployModalId] = useState<string | null>(null);
  const [deployMemoryEnabled, setDeployMemoryEnabled] = useState(false);
  const [deployMemoryTurns, setDeployMemoryTurns] = useState(10);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<{ endpoint_url: string; version_label: string; version_id?: string } | null>(null);
  const [deployStarted, setDeployStarted] = useState(false);
  const [versionsForId, setVersionsForId] = useState<string | null>(null);
  const [versions, setVersions] = useState<DeploymentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionActionId, setVersionActionId] = useState<string | null>(null);
  const [exportingVersionId, setExportingVersionId] = useState<string | null>(null);
  const [confirmNewVersionDeploymentId, setConfirmNewVersionDeploymentId] = useState<string | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);

  const exportVersion = async (deploymentId: string, versionId: string, deploymentName: string, versionLabel: string) => {
    setExportingVersionId(versionId);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const res = await fetch(`${API_BASE}/api/v1/deployments/${deploymentId}/versions/${versionId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(deploymentName || "deployment").replace(/\s+/g, "-")}-${versionLabel}-export.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExportingVersionId(null);
    }
  };

  const exportDeployment = async (d: Deployment) => {
    setExportingId(d.id);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const res = await fetch(`${API_BASE}/api/v1/deployments/${d.id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(d.name || "deployment").replace(/\s+/g, "-")}-export.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExportingId(null);
    }
  };

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

  useEffect(() => {
    if (deployments.length > 0 && versionsForId === null) {
      loadVersions(deployments[0].id);
    }
  }, [deployments, versionsForId]);

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

  const deployDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployModalId) return;
    setDeployLoading(true);
    setDeployResult(null);
    try {
      const res = await apiRequest<{ endpoint_url: string; version_label: string; version_id: string; status: string }>(
        `/api/v1/deployments/${deployModalId}/deploy`,
        {
          method: "POST",
          body: JSON.stringify({
            memory_enabled: deployMemoryEnabled,
            memory_turns: deployMemoryTurns,
          }),
        }
      );
      setDeployResult({ endpoint_url: res.endpoint_url, version_label: res.version_label, version_id: res.version_id });
      setDeployStarted(false);
      await load();
      setVersionsForId(deployModalId);
      const vers = await apiRequest<DeploymentVersion[]>(`/api/v1/deployments/${deployModalId}/versions`);
      setVersions(vers);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeployResult({ endpoint_url: "", version_label: msg });
    } finally {
      setDeployLoading(false);
    }
  };

  const addNewVersion = async (deploymentId: string, makeLive: boolean) => {
    setCreatingVersion(true);
    try {
      const res = await apiRequest<{ version_id: string; version_label: string }>(`/api/v1/deployments/${deploymentId}/versions`, { method: "POST" });
      setConfirmNewVersionDeploymentId(null);
      if (makeLive) {
        await startVersion(deploymentId, res.version_id);
      } else {
        await load();
        if (versionsForId === deploymentId) {
          const vers = await apiRequest<DeploymentVersion[]>(`/api/v1/deployments/${deploymentId}/versions`);
          setVersions(vers);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingVersion(false);
    }
  };

  const confirmCreateNewVersion = async (makeLive: boolean) => {
    if (!confirmNewVersionDeploymentId) return;
    await addNewVersion(confirmNewVersionDeploymentId, makeLive);
  };

  const loadVersions = async (deploymentId: string) => {
    setVersionsForId(deploymentId);
    setVersionsLoading(true);
    try {
      const vers = await apiRequest<DeploymentVersion[]>(`/api/v1/deployments/${deploymentId}/versions`);
      setVersions(vers);
    } catch (err) {
      console.error(err);
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const deleteVersion = async (deploymentId: string, versionId: string) => {
    if (!confirm("Delete this version? Session history for this version will be removed.")) return;
    try {
      await apiRequest(`/api/v1/deployments/${deploymentId}/versions/${versionId}`, { method: "DELETE" });
      if (versionsForId === deploymentId) await loadVersions(deploymentId);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const startVersion = async (deploymentId: string, versionId: string) => {
    setVersionActionId(versionId);
    try {
      await apiRequest(`/api/v1/deployments/${deploymentId}/versions/${versionId}/start`, { method: "POST" });
      if (versionsForId === deploymentId) await loadVersions(deploymentId);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setVersionActionId(null);
    }
  };

  const stopVersion = async (deploymentId: string, versionId: string) => {
    setVersionActionId(versionId);
    try {
      await apiRequest(`/api/v1/deployments/${deploymentId}/versions/${versionId}/stop`, { method: "POST" });
      if (versionsForId === deploymentId) await loadVersions(deploymentId);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setVersionActionId(null);
    }
  };

  const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") : "";
  const hostedEndpointUrl = deployModalId ? `${API_BASE}/hosted/${deployModalId}/v1/chat/completions` : "";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-9 h-9 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading deployments…</p>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { dateStyle: "medium" }) + " " + d.toLocaleTimeString(undefined, { timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="w-full">
      <PageHeader description="Pair a model with an optional knowledge base. Deploy to get a stable API URL, or export as a zip. Select a deployment to view versions." />

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

      <Modal
        open={deployModalId != null}
        onClose={() => {
          setDeployModalId(null);
          setDeployResult(null);
          setDeployStarted(false);
          setDeployMemoryEnabled(false);
          setDeployMemoryTurns(10);
        }}
        title="Deploy (hosted API)"
      >
        <form onSubmit={(e) => { e.preventDefault(); deployDeployment(e); }} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create the first hosted version. You can add more versions later and start/stop them from the Versions table.
          </p>
          <div>
            <label htmlFor="deploy-memory" className="label">
              Enable conversation memory
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="deploy-memory"
                checked={deployMemoryEnabled}
                onChange={(e) => setDeployMemoryEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-2 border-[var(--border)] bg-white dark:bg-[var(--input-bg)] accent-brand-500 focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-0 dark:border-[var(--input-border)]"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">Include recent turns in context per session. Use <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-xs">{"{memory}"}</code> in your prompt to place history, or leave it out to have it prepended.</span>
            </div>
          </div>
          {deployMemoryEnabled && (
            <div>
              <label className="label">Last N turns to include in context</label>
              <input
                type="number"
                min={1}
                max={50}
                value={deployMemoryTurns}
                onChange={(e) => setDeployMemoryTurns(parseInt(e.target.value, 10) || 10)}
                className="input w-24"
              />
            </div>
          )}
          {deployResult && (
            <div className={`rounded-lg border p-4 text-sm space-y-2 ${deployResult.endpoint_url ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
              {deployResult.endpoint_url ? (
                <>
                  <p className="font-medium">
                    {deployStarted ? "Version is live. You can close this and use the endpoint." : "Version created (stopped). Start it to use the endpoint."}
                  </p>
                  <p className="text-xs break-all font-mono opacity-90">Endpoint: {deployResult.endpoint_url}</p>
                  <p className="text-xs opacity-90">Health: {API_BASE}/hosted/{deployModalId}/health</p>
                  {deployMemoryEnabled && (
                    <p className="text-xs mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-700/50">
                      Send <code className="bg-white/50 dark:bg-black/20 px-1 rounded">session_id</code> in the request body or <code className="bg-white/50 dark:bg-black/20 px-1 rounded">X-Session-Id</code> header to use conversation memory.
                    </p>
                  )}
                </>
              ) : (
                <p>{deployResult.version_label}</p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {deployResult?.endpoint_url && !deployStarted ? (
              (() => {
                const versionToStart = deployResult.version_id ?? (versions.length > 0 && versionsForId === deployModalId ? versions[0].id : null);
                return versionToStart ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={versionActionId != null}
                    onClick={async () => {
                      if (!deployModalId || !versionToStart) return;
                      setVersionActionId(versionToStart);
                      try {
                        await apiRequest(`/api/v1/deployments/${deployModalId}/versions/${versionToStart}/start`, { method: "POST" });
                        setDeployStarted(true);
                        await load();
                        if (versionsForId === deployModalId) {
                          const vers = await apiRequest<DeploymentVersion[]>(`/api/v1/deployments/${deployModalId}/versions`);
                          setVersions(vers);
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setVersionActionId(null);
                      }
                    }}
                  >
                    {versionActionId === versionToStart ? "Starting…" : "Start"}
                  </Button>
                ) : (
                  <Button type="submit" variant="primary" disabled={deployLoading}>
                    {deployLoading ? "Deploying…" : "Deploy"}
                  </Button>
                );
              })()
            ) : deployResult?.endpoint_url && deployStarted ? null : (
              <Button type="submit" variant="primary" disabled={deployLoading}>
                {deployLoading ? "Deploying…" : "Deploy"}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeployModalId(null);
                setDeployResult(null);
                setDeployStarted(false);
              }}
            >
              {deployResult?.endpoint_url ? "Close" : "Cancel"}
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

      <Modal
        open={confirmNewVersionDeploymentId != null}
        onClose={() => !creatingVersion && setConfirmNewVersionDeploymentId(null)}
        title="Create new version?"
      >
        {confirmNewVersionDeploymentId && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This will freeze the current deployment state (model, prompt, knowledge base) as a new version. Do you want to create it and set it live now, or just create it? Setting it live will stop any currently running version for this deployment.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => confirmCreateNewVersion(true)} disabled={creatingVersion}>
                {creatingVersion ? "Creating…" : "Create and make live"}
              </Button>
              <Button variant="secondary" onClick={() => confirmCreateNewVersion(false)} disabled={creatingVersion}>
                {creatingVersion ? "Creating…" : "Create only"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <div className="space-y-6 min-w-0">
      <div className="flex flex-col lg:flex-row gap-6 w-full min-w-0">
        <Card className="lg:w-72 flex-shrink-0 flex flex-col max-lg:max-h-[24rem] lg:h-[28rem]">
          <CardHeader className="flex-shrink-0">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Deployments</h2>
          </CardHeader>
          <CardBody className="p-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
            {deployments.length === 0 ? (
              <div className="px-2 pb-8 pt-2">
                <EmptyState
                  title="No deployments"
                  description="Create a deployment to use in Chat. Link a knowledge base for RAG-powered answers."
                  action={
                    <Button variant="primary" onClick={() => setShowForm(true)}>
                      New deployment
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {deployments.map((d) => (
                  <li key={d.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => loadVersions(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          loadVersions(d.id);
                        }
                      }}
                      className={`flex items-center gap-2 p-3 rounded-[var(--radius-lg)] border border-[var(--border)] transition-all cursor-pointer ${
                        versionsForId === d.id
                          ? "bg-brand-50 dark:bg-brand-900/20 shadow-[var(--shadow)]"
                          : "bg-[var(--card)] hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-[var(--shadow)]"
                      }`}
                    >
                      <span
                        className={`flex-1 min-w-0 truncate text-sm font-medium ${
                          versionsForId === d.id ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {d.name}
                      </span>
                      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
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
                          className="text-xs py-1 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDeployment(d.id);
                          }}
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

        <Card className="flex-1 min-w-0 w-0 flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-shrink-0 flex-wrap">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Versions</h2>
              {versionsForId && !versionsLoading && versions.length > 0 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-xs break-all">{API_BASE}/hosted/{versionsForId}/v1/chat/completions</code>
                </p>
              )}
            </div>
            {versionsForId && !versionsLoading && versions.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const d = deployments.find((x) => x.id === versionsForId);
                    if (d) exportDeployment(d);
                  }}
                  disabled={exportingId === versionsForId}
                >
                  {exportingId === versionsForId ? "Exporting…" : "Export"}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmNewVersionDeploymentId(versionsForId)} disabled={creatingVersion}>
                  {creatingVersion ? "Creating…" : "New version"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto flex-1 min-h-0">
            {!versionsForId ? (
              <div className="px-5 py-12 flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                <p className="text-sm">Select a deployment to view and manage its versions.</p>
              </div>
            ) : versionsLoading ? (
              <div className="px-5 py-8 flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="w-7 h-7 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                <span className="text-sm">Loading versions…</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  This deployment is not hosted yet. Host it to get an API endpoint, or export it as a zip to host on your own.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setDeployModalId(versionsForId);
                      setDeployResult(null);
                      setDeployMemoryEnabled(false);
                      setDeployMemoryTurns(10);
                    }}
                    disabled={deployLoading}
                  >
                    {deployLoading ? "Deploying…" : "Host it"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const d = deployments.find((x) => x.id === versionsForId);
                      if (d) exportDeployment(d);
                    }}
                    disabled={exportingId === versionsForId}
                  >
                    {exportingId === versionsForId ? "Exporting…" : "Export"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-slate-50 dark:bg-slate-800/60">
                      <th className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300">Version</th>
                      <th className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300 w-36">Status</th>
                      <th className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300">Created</th>
                      <th className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{v.version_label}</span>
                          {v.memory_enabled && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">· Memory on</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {v.status === "running" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-200/60 dark:ring-emerald-700/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
                              Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-200/60 dark:ring-red-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" aria-hidden />
                              Stopped
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{formatDate(v.created_at)}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            {v.status === "running" ? (
                              <Button
                                variant="ghost"
                                className="text-xs py-1 px-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                onClick={() => stopVersion(versionsForId, v.id)}
                                disabled={versionActionId === v.id}
                                title="Stop"
                              >
                                {versionActionId === v.id ? (
                                  <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                ) : (
                                  <StopIcon />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                className="text-xs py-1 px-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/20"
                                onClick={() => startVersion(versionsForId, v.id)}
                                disabled={versionActionId === v.id}
                                title="Start"
                              >
                                {versionActionId === v.id ? (
                                  <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                ) : (
                                  <PlayIcon />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              className="text-xs py-1 px-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                              onClick={() => {
                                const d = deployments.find((x) => x.id === versionsForId);
                                if (d) exportVersion(versionsForId, v.id, d.name, v.version_label);
                              }}
                              disabled={exportingVersionId === v.id}
                              title="Export this version"
                            >
                              {exportingVersionId === v.id ? (
                                <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              ) : (
                                <DownloadIcon />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-xs py-1 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                              onClick={() => deleteVersion(versionsForId, v.id)}
                              title="Delete version"
                            >
                              <DeleteIcon />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {testId && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Test run</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ask a question against this deployment’s RAG pipeline.</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label htmlFor="test-question" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Question</label>
                <textarea
                  id="test-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. What is the main topic of the document?"
                  rows={4}
                  className="input resize-y w-full rounded-lg border border-[var(--border)] bg-white dark:bg-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <Button onClick={run} variant="primary" disabled={runLoading}>
                {runLoading ? "Running…" : "Run"}
              </Button>
              {runResult && (
                <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Response</p>
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 whitespace-pre-wrap text-sm leading-relaxed border border-[var(--border)]">
                      {runResult.response}
                    </div>
                  </div>
                  {runResult.citations?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Sources</p>
                      <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                        {runResult.citations.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                            <span>{c.source}</span>
                            {c.score != null && <span className="text-slate-400 dark:text-slate-500 text-xs">(score: {c.score.toFixed(2)})</span>}
                          </li>
                        ))}
                      </ul>
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
