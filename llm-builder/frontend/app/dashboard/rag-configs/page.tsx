"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EditIcon, DeleteIcon } from "@/app/components/ui/icons";
import { RagConfigForm, type RagConfigFormValues } from "@/app/components/rag/RagConfigForm";

export type RagConfigPreset = {
  id: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  created_at: string;
};

const DEFAULT_CONFIG: RagConfigFormValues = {
  chunk_strategy: "fixed",
  chunk_size: 512,
  chunk_overlap: 50,
  embedding_model: "all-MiniLM-L6-v2",
  embedding_query_prefix: "",
};

export default function RagConfigsPage() {
  const [presets, setPresets] = useState<RagConfigPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formConfig, setFormConfig] = useState<RagConfigFormValues>(DEFAULT_CONFIG);

  useTopBar(
    "Chunking & Embedding",
    <Button variant="primary" onClick={() => openCreate()}>
      New preset
    </Button>
  );

  const loadPresets = useCallback(async () => {
    try {
      const list = await apiRequest<RagConfigPreset[]>("/api/v1/rag-configs");
      setPresets(list);
    } catch (e) {
      console.error(e);
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setFormConfig(DEFAULT_CONFIG);
    setShowModal(true);
  }

  function openEdit(p: RagConfigPreset) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    const c = (p.config || {}) as Record<string, unknown>;
    setFormConfig({
      chunk_strategy: (c.chunk_strategy as string) || "fixed",
      chunk_size: typeof c.chunk_size === "number" ? c.chunk_size : 512,
      chunk_overlap: typeof c.chunk_overlap === "number" ? c.chunk_overlap : 50,
      embedding_model: (c.embedding_model as string) || "all-MiniLM-L6-v2",
      embedding_query_prefix: (c.embedding_query_prefix as string) ?? "",
    });
    setShowModal(true);
  }

  const savePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const config = {
        chunk_strategy: formConfig.chunk_strategy,
        chunk_size: formConfig.chunk_size,
        chunk_overlap: formConfig.chunk_overlap,
        embedding_model: formConfig.embedding_model,
        embedding_query_prefix: formConfig.embedding_query_prefix || null,
      };
      if (editingId) {
        await apiRequest<RagConfigPreset>(`/api/v1/rag-configs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), description: description.trim() || null, config }),
        });
      } else {
        await apiRequest<RagConfigPreset>("/api/v1/rag-configs", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim() || null, config }),
        });
      }
      setShowModal(false);
      await loadPresets();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async (id: string) => {
    if (!confirm("Delete this preset?")) return;
    try {
      await apiRequest(`/api/v1/rag-configs/${id}`, { method: "DELETE" });
      await loadPresets();
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
      <PageHeader
        description="Create and manage chunking and embedding presets. Apply them when creating a knowledge base or configuring a document for consistent RAG settings."
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit preset" : "New preset"}
      >
        <form onSubmit={savePreset} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              placeholder="e.g. Small chunks + BGE"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input
              type="text"
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
            />
          </div>
          <RagConfigForm value={formConfig} onChange={setFormConfig} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Card className="max-w-3xl">
        <CardHeader className="min-h-[3.25rem] flex items-center">
          <h2 className="text-base font-semibold text-slate-800">Presets</h2>
        </CardHeader>
        <CardBody className="p-0">
          {presets.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No presets yet. Create one to reuse chunking and embedding settings across knowledge bases and documents.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[var(--border)]">
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Config</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => {
                  const c = (p.config || {}) as Record<string, unknown>;
                  const strategy = (c.chunk_strategy as string) || "fixed";
                  const model = (c.embedding_model as string) || "—";
                  return (
                    <tr key={p.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-800">{p.name}</td>
                      <td className="p-3 text-sm text-slate-600 max-w-[12rem] truncate">
                        {p.description || "—"}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {strategy}, {model}
                      </td>
                      <td className="p-3 flex gap-1">
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5"
                          onClick={() => openEdit(p)}
                          title="Edit"
                        >
                          <EditIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deletePreset(p.id)}
                          title="Delete"
                        >
                          <DeleteIcon />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
