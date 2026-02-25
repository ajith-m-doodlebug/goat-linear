"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { EmptyState } from "@/app/components/ui/EmptyState";

type Dataset = { id: string; name: string; format: string; row_count: string; created_at: string };
type Job = {
  id: string;
  dataset_id: string;
  base_model_id: string;
  status: string;
  error_message: string | null;
  result_model_id: string | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
type Model = { id: string; name: string };

export default function TrainingPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [createJob, setCreateJob] = useState(false);
  const [jobForm, setJobForm] = useState({ dataset_id: "", base_model_id: "" });

  useTopBar(
    "Training",
    <Button variant="primary" onClick={() => setCreateJob(!createJob)}>
      {createJob ? "Cancel" : "New training job"}
    </Button>,
    createJob
  );

  const load = async () => {
    try {
      const [ds, j, mods] = await Promise.all([
        apiRequest<Dataset[]>("/api/v1/training/datasets"),
        apiRequest<Job[]>("/api/v1/training/jobs"),
        apiRequest<Model[]>("/api/v1/models"),
      ]);
      setDatasets(ds);
      setJobs(j);
      setModels(mods);
      if (mods.length && !jobForm.base_model_id) setJobForm((f) => ({ ...f, base_model_id: mods[0].id }));
      if (ds.length && !jobForm.dataset_id) setJobForm((f) => ({ ...f, dataset_id: ds[0]?.id || "" }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadDataset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const nameInput = form.querySelector('input[name="name"]') as HTMLInputElement;
    if (!fileInput?.files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);
      formData.append("name", nameInput?.value || fileInput.files[0].name || "dataset");
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/v1/training/datasets`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      form.reset();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const startJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.dataset_id || !jobForm.base_model_id) return;
    try {
      await apiRequest("/api/v1/training/jobs", {
        method: "POST",
        body: JSON.stringify({
          dataset_id: jobForm.dataset_id,
          base_model_id: jobForm.base_model_id,
          config: {},
        }),
      });
      setCreateJob(false);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const jobStatusVariant = (s: string) => (s === "completed" ? "success" : s === "failed" ? "error" : "warning");

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
      <PageHeader description="Upload JSONL datasets and run fine-tuning jobs. Result models appear in Models." />

      <Card className="mb-6 max-w-md">
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Upload dataset (JSONL)</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={uploadDataset} className="space-y-3">
            <input type="text" name="name" placeholder="Dataset name" className="input" />
            <input type="file" accept=".jsonl,.json" className="w-full text-sm text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium" />
            <Button type="submit" variant="primary" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {createJob && (
        <Card className="mb-6 max-w-md">
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Start training job</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={startJob} className="space-y-4">
              <div>
                <label className="label">Dataset</label>
                <select
                  value={jobForm.dataset_id}
                  onChange={(e) => setJobForm((f) => ({ ...f, dataset_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Select dataset</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Base model</label>
                <select
                  value={jobForm.base_model_id}
                  onChange={(e) => setJobForm((f) => ({ ...f, base_model_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Select base model</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="primary">Start job</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Datasets</h2>
          </CardHeader>
          <CardBody>
            {datasets.length === 0 ? (
              <EmptyState title="No datasets" description="Upload a JSONL file above." />
            ) : (
              <ul className="space-y-2">
                {datasets.map((d) => (
                  <li key={d.id} className="p-3 rounded-[var(--radius)] border border-[var(--border)]">
                    {d.name} — <span className="text-slate-500">{d.row_count} rows</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Training jobs</h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {jobs.length === 0 ? (
              <EmptyState title="No jobs yet" description="Create a job above." />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-[var(--border)]">
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">ID</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Result</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-sm">{j.id.slice(0, 8)}</td>
                      <td className="p-3">
                        <Badge variant={jobStatusVariant(j.status)}>{j.status}</Badge>
                        {j.error_message && <p className="text-red-600 text-xs mt-1">{j.error_message}</p>}
                      </td>
                      <td className="p-3 font-mono text-sm">{j.result_model_id ? j.result_model_id.slice(0, 8) : "—"}</td>
                      <td className="p-3 text-slate-500 text-sm">{new Date(j.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
