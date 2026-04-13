"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import { DeleteIcon, PlayIcon, StopIcon } from "@/app/components/ui";

type HostModel = {
  id: string;
  name: string;
  engine: string;
  model_source: "hf_repo" | "local_path";
  model_ref: string;
  served_model_name: string;
  gpu_ids: string;
  tensor_parallel_size: number;
  port: number;
  base_url: string;
  status: "creating" | "starting" | "healthy" | "error" | "stopping" | "stopped";
  health_message: string | null;
  created_at: string;
};

export default function HostModelsPage() {
  const [rows, setRows] = useState<HostModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [logsForId, setLogsForId] = useState<string | null>(null);
  const [logsText, setLogsText] = useState("");
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    model_ref: "",
    served_model_name: "",
    gpu_ids: "0",
    tensor_parallel_size: 1,
    port: 8010,
    api_key: "",
    autostart: true,
    gpu_memory_utilization: "",
    max_model_len: "",
    dtype: "",
    trust_remote_code: true,
  });

  useTopBar(
    "Host Models",
    <Button variant="primary" onClick={() => setShowForm(true)}>
      Host model
    </Button>
  );

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<HostModel[]>("/api/v1/host-models");
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const anyStarting = rows.some((r) => r.status === "starting");
    if (!anyStarting) return;
    const timer = window.setInterval(() => {
      load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [rows, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    try {
      await apiRequest("/api/v1/host-models", {
        method: "POST",
        body: JSON.stringify({
          name: form.name || form.served_model_name,
          model_ref: form.model_ref,
          served_model_name: form.served_model_name,
          gpu_ids: form.gpu_ids,
          tensor_parallel_size: form.tensor_parallel_size,
          port: form.port,
          api_key: form.api_key || null,
          autostart: form.autostart,
          config: {
            gpu_memory_utilization: form.gpu_memory_utilization ? Number(form.gpu_memory_utilization) : undefined,
            max_model_len: form.max_model_len ? Number(form.max_model_len) : undefined,
            dtype: form.dtype || undefined,
            trust_remote_code: form.trust_remote_code,
          },
        }),
      });
      setShowForm(false);
      setForm({
        name: "",
        model_ref: "",
        served_model_name: "",
        gpu_ids: "0",
        tensor_parallel_size: 1,
        port: 8010,
        api_key: "",
        autostart: true,
        gpu_memory_utilization: "",
        max_model_len: "",
        dtype: "",
        trust_remote_code: true,
      });
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  const runAction = async (id: string, action: "start" | "stop") => {
    setActionId(id);
    try {
      await apiRequest(`/api/v1/host-models/${id}/${action}`, { method: "POST" });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this hosted model instance?")) return;
    setActionId(id);
    try {
      await apiRequest(`/api/v1/host-models/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const fetchLogs = useCallback(async (id: string, withLoadingText = false) => {
    if (withLoadingText) setLogsText("Loading logs…");
    try {
      const res = await apiRequest<{ logs: string }>(`/api/v1/host-models/${id}/logs`);
      setLogsText(res.logs || "No logs yet.");
    } catch (err) {
      setLogsText("Failed to load logs: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const openLogs = async (id: string) => {
    setLogsForId(id);
    await fetchLogs(id, true);
  };

  useEffect(() => {
    if (!logsForId) return;
    const timer = window.setInterval(() => {
      fetchLogs(logsForId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [logsForId, fetchLogs]);

  const registerInModels = async (id: string) => {
    setRegisteringId(id);
    try {
      await apiRequest(`/api/v1/host-models/${id}/register-model`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      alert("Registered in Models page.");
    } catch (err) {
      alert("Failed to register: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRegisteringId(null);
    }
  };

  const statusPill = (status: HostModel["status"]) => {
    if (status === "healthy") return "bg-emerald-50 text-emerald-700";
    if (status === "error") return "bg-red-50 text-red-700";
    if (status === "stopped") return "bg-slate-100 text-slate-700";
    return "bg-amber-50 text-amber-700";
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
      <PageHeader description="Launch and manage GPU model instances from host model directories." />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Host model">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sarvam 30B (GPU0)" />
          </div>
          <div>
            <label className="label">Model directory (Docker host)</label>
            <p className="text-xs text-slate-500 mb-1">Absolute path on the machine where Docker runs (not inside the API container).</p>
            <input
              className="input"
              value={form.model_ref}
              onChange={(e) => setForm((f) => ({ ...f, model_ref: e.target.value }))}
              placeholder="/data/models/Meta-Llama-3-8B-Instruct"
              required
            />
          </div>
          <div>
            <label className="label">Served model name</label>
            <input className="input" value={form.served_model_name} onChange={(e) => setForm((f) => ({ ...f, served_model_name: e.target.value }))} placeholder="e.g. sarvam-30b" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">GPU IDs</label>
              <input className="input" value={form.gpu_ids} onChange={(e) => setForm((f) => ({ ...f, gpu_ids: e.target.value }))} placeholder="0 or 0,1" required />
            </div>
            <div>
              <label className="label">Tensor parallel</label>
              <input type="number" className="input" min={1} max={16} value={form.tensor_parallel_size} onChange={(e) => setForm((f) => ({ ...f, tensor_parallel_size: Number(e.target.value) || 1 }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Host port (Docker publish)</label>
              <p className="text-xs text-slate-500 mb-1">
                TCP port on the Docker host for this model container (e.g. 8010). This is not necessarily the same as the public ingress port in .env (HOST_MODELS_REGISTER_HTTP_PORT).
              </p>
              <input type="number" className="input" min={1025} max={65535} value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 8010 }))} required />
            </div>
            <div>
              <label className="label">Dtype (optional)</label>
              <input className="input" value={form.dtype} onChange={(e) => setForm((f) => ({ ...f, dtype: e.target.value }))} placeholder="auto / float16 / bfloat16" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">GPU mem util (optional)</label>
              <input className="input" value={form.gpu_memory_utilization} onChange={(e) => setForm((f) => ({ ...f, gpu_memory_utilization: e.target.value }))} placeholder="e.g. 0.9" />
            </div>
            <div>
              <label className="label">Max model len (optional)</label>
              <input className="input" value={form.max_model_len} onChange={(e) => setForm((f) => ({ ...f, max_model_len: e.target.value }))} placeholder="e.g. 8192" />
            </div>
          </div>
          <div>
            <label className="label">API key (optional)</label>
            <input className="input" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder="If set, required by the model endpoint" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.autostart} onChange={(e) => setForm((f) => ({ ...f, autostart: e.target.checked }))} />
            <span className="text-sm text-slate-600">Start immediately after create</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.trust_remote_code} onChange={(e) => setForm((f) => ({ ...f, trust_remote_code: e.target.checked }))} />
            <span className="text-sm text-slate-600">trust_remote_code</span>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">Create</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={logsForId != null} onClose={() => setLogsForId(null)} title="Model logs">
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap text-xs bg-slate-100 p-3 rounded-[var(--radius)]">{logsText}</pre>
        <div className="flex gap-2 mt-3">
          {logsForId && (
            <Button variant="secondary" onClick={() => fetchLogs(logsForId, true)}>
              Refresh
            </Button>
          )}
          <Button variant="ghost" onClick={() => setLogsForId(null)}>
            Close
          </Button>
        </div>
      </Modal>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Hosted model instances</h2>
        </CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <EmptyState title="No hosted models" description="Start a model from a local model directory on the host." action={<Button variant="primary" onClick={() => setShowForm(true)}>Host model</Button>} />
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="p-4 rounded-[var(--radius)] border border-[var(--border)] bg-slate-50/30">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800">{r.name}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusPill(r.status)}`}>{r.status}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {r.model_source === "hf_repo" ? (
                          <span className="text-amber-700">Legacy HF repo (remove and recreate with a host path)</span>
                        ) : (
                          <span>local · {r.model_ref}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        model: {r.served_model_name} · gpu: {r.gpu_ids} · tp: {r.tensor_parallel_size} · host port: {r.port}
                      </p>
                      {r.base_url && (
                        <>
                          <p className="text-xs text-slate-600 mt-1 break-all" title="Use this base for Register in Models when ingress is enabled">
                            <span className="text-slate-500">Client URL </span>
                            {r.base_url}/v1/chat/completions
                          </p>
                        </>
                      )}
                      {r.health_message && <p className="text-xs text-slate-400 mt-1">{r.health_message}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status === "healthy" || r.status === "starting" ? (
                        <Button variant="ghost" onClick={() => runAction(r.id, "stop")} disabled={actionId === r.id} title="Stop">
                          {actionId === r.id ? "…" : <StopIcon />}
                        </Button>
                      ) : (
                        <Button variant="ghost" onClick={() => runAction(r.id, "start")} disabled={actionId === r.id} title="Start">
                          {actionId === r.id ? "…" : <PlayIcon />}
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => openLogs(r.id)}>Logs</Button>
                      <Button variant="primary" onClick={() => registerInModels(r.id)} disabled={registeringId === r.id}>
                        {registeringId === r.id ? "Registering…" : "Register in Models"}
                      </Button>
                      <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => remove(r.id)} disabled={actionId === r.id} title="Delete">
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
    </div>
  );
}
