"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { Modal } from "@/app/components/ui/Modal";
import { EditIcon, DeleteIcon } from "@/app/components/ui/icons";
import { RagConfigForm } from "@/app/components/rag/RagConfigForm";

type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  qdrant_collection_name: string;
  config: Record<string, unknown> | null;
  created_at: string;
};

type Document = {
  id: string;
  knowledge_base_id: string;
  name: string;
  source_type: string;
  status: string;
  error_message: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
};

type RagPreset = {
  id: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  created_at: string;
};

type RagConfigFormValues = {
  chunk_strategy: string;
  chunk_size: number;
  chunk_overlap: number;
  embedding_model: string;
  embedding_query_prefix: string;
};

const DEFAULT_RAG_CONFIG: RagConfigFormValues = {
  chunk_strategy: "fixed",
  chunk_size: 512,
  chunk_overlap: 50,
  embedding_model: "all-MiniLM-L6-v2",
  embedding_query_prefix: "",
};

function statusVariant(s: string): "default" | "success" | "warning" | "error" {
  if (s === "completed") return "success";
  if (s === "failed") return "error";
  if (s === "processing" || s === "pending") return "warning";
  return "default";
}

export default function KnowledgePage() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editKbId, setEditKbId] = useState<string | null>(null);
  const [editKbName, setEditKbName] = useState("");
  const [editKbDescription, setEditKbDescription] = useState("");
  const [editKbConfig, setEditKbConfig] = useState<RagConfigFormValues>(DEFAULT_RAG_CONFIG);
  const [editKbPresetId, setEditKbPresetId] = useState<string>("");
  const [kbConfig, setKbConfig] = useState<RagConfigFormValues>(DEFAULT_RAG_CONFIG);
  const [kbPresetId, setKbPresetId] = useState<string>("");
  const [presets, setPresets] = useState<RagPreset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadConfig, setShowUploadConfig] = useState(false);
  const [uploadConfig, setUploadConfig] = useState<RagConfigFormValues>(DEFAULT_RAG_CONFIG);
  const [uploadPresetId, setUploadPresetId] = useState<string>("");
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editDocConfig, setEditDocConfig] = useState<RagConfigFormValues>(DEFAULT_RAG_CONFIG);
  const [editDocPresetId, setEditDocPresetId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const emptyStateFileInputRef = useRef<HTMLInputElement>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  useTopBar(
    "Knowledge",
    <Button variant="primary" onClick={() => setShowCreate(true)}>
      New knowledge base
    </Button>
  );

  const loadBases = async (): Promise<KnowledgeBase[]> => {
    try {
      const list = await apiRequest<KnowledgeBase[]>("/api/v1/knowledge-bases");
      setBases(list);
      if (list.length && !selected) setSelected(list[0].id);
      return list;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBases();
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const list = await apiRequest<RagPreset[]>("/api/v1/rag-configs");
      setPresets(list);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const fetchDocuments = useCallback(async () => {
    if (!selected) return;
    try {
      const list = await apiRequest<Document[]>(`/api/v1/knowledge-bases/${selected}/documents`);
      setDocuments(list);
    } catch {
      setDocuments([]);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setDocuments([]);
      return;
    }
    fetchDocuments();
  }, [selected, fetchDocuments]);

  const hasPendingOrProcessing = documents.some(
    (d) => d.status === "pending" || d.status === "processing"
  );
  useEffect(() => {
    if (!selected || !hasPendingOrProcessing) return;
    const interval = setInterval(fetchDocuments, 2500);
    return () => clearInterval(interval);
  }, [selected, hasPendingOrProcessing, fetchDocuments]);

  const createBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const config = {
        chunk_strategy: kbConfig.chunk_strategy,
        chunk_size: kbConfig.chunk_size,
        chunk_overlap: kbConfig.chunk_overlap,
        embedding_model: kbConfig.embedding_model,
        embedding_query_prefix: kbConfig.embedding_query_prefix || null,
      };
      await apiRequest<KnowledgeBase>("/api/v1/knowledge-bases", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          config: Object.values(config).some((v) => v != null) ? config : undefined,
          preset_id: kbPresetId || undefined,
        }),
      });
      setName("");
      setDescription("");
      setKbConfig(DEFAULT_RAG_CONFIG);
      setKbPresetId("");
      setShowCreate(false);
      await loadBases();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const ACCEPT_EXT = [".txt", ".pdf", ".docx", ".doc", ".html", ".htm"];
  const isAcceptedFile = (file: File) =>
    ACCEPT_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));

  const uploadSingleFile = useCallback(
    async (
      file: File,
      opts?: { config?: RagConfigFormValues; presetId?: string }
    ): Promise<Document | null> => {
      if (!selected) return null;
      const form = new FormData();
      form.append("file", file);
      if (opts?.presetId) form.append("preset_id", opts.presetId);
      if (opts?.config) {
        form.append(
          "config",
          JSON.stringify({
            chunk_strategy: opts.config.chunk_strategy,
            chunk_size: opts.config.chunk_size,
            chunk_overlap: opts.config.chunk_overlap,
            embedding_model: opts.config.embedding_model,
            embedding_query_prefix: opts.config.embedding_query_prefix || null,
          })
        );
      }
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/v1/knowledge-bases/${selected}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [selected]
  );

  const getUploadOpts = useCallback((): { config?: RagConfigFormValues; presetId?: string } | undefined => {
    if (uploadPresetId || (uploadConfig && uploadConfig.chunk_strategy)) {
      return {
        config: uploadConfig,
        presetId: uploadPresetId || undefined,
      };
    }
    return undefined;
  }, [uploadConfig, uploadPresetId]);

  const handleHeaderFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !selected) return;
      setUploading(true);
      try {
        const opts = getUploadOpts();
        for (let i = 0; i < files.length; i++) {
          const doc = await uploadSingleFile(files[i], opts);
          if (doc) setDocuments((d) => [doc, ...d]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [selected, uploadSingleFile, getUploadOpts]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (!selected || uploading) return;
      const files = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
      if (files.length === 0) return;
      setUploading(true);
      try {
        const opts = getUploadOpts();
        for (const file of files) {
          const doc = await uploadSingleFile(file, opts);
          if (doc) setDocuments((d) => [doc, ...d]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    },
    [selected, uploading, uploadSingleFile, getUploadOpts]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const reingest = async (docId: string) => {
    if (!selected) return;
    try {
      const doc = await apiRequest<Document>(
        `/api/v1/knowledge-bases/${selected}/documents/${docId}/ingest`,
        { method: "POST" }
      );
      setDocuments((d) => d.map((x) => (x.id === docId ? doc : x)));
    } catch (err) {
      console.error(err);
    }
  };

  const updateBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKbId || !editKbName.trim()) return;
    try {
      const config = {
        chunk_strategy: editKbConfig.chunk_strategy,
        chunk_size: editKbConfig.chunk_size,
        chunk_overlap: editKbConfig.chunk_overlap,
        embedding_model: editKbConfig.embedding_model,
        embedding_query_prefix: editKbConfig.embedding_query_prefix || null,
      };
      await apiRequest<KnowledgeBase>(`/api/v1/knowledge-bases/${editKbId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editKbName.trim(),
          description: editKbDescription.trim() || null,
          config,
          preset_id: editKbPresetId || undefined,
        }),
      });
      setEditKbId(null);
      await loadBases();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBase = async (kbId: string) => {
    if (!confirm("Delete this knowledge base and all its documents?")) return;
    try {
      await apiRequest(`/api/v1/knowledge-bases/${kbId}`, { method: "DELETE" });
      const list = await loadBases();
      if (selected === kbId) setSelected(list[0]?.id ?? null);
    } catch (err) {
      console.error(err);
    }
  };

  const updateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !editDocId || !editDocName.trim()) return;
    try {
      const config = {
        chunk_strategy: editDocConfig.chunk_strategy,
        chunk_size: editDocConfig.chunk_size,
        chunk_overlap: editDocConfig.chunk_overlap,
        embedding_model: editDocConfig.embedding_model,
        embedding_query_prefix: editDocConfig.embedding_query_prefix || null,
      };
      const doc = await apiRequest<Document>(
        `/api/v1/knowledge-bases/${selected}/documents/${editDocId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editDocName.trim(),
            config,
            preset_id: editDocPresetId || undefined,
          }),
        }
      );
      setDocuments((d) => d.map((x) => (x.id === editDocId ? doc : x)));
      setEditDocId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!selected || !confirm("Remove this document from the knowledge base?")) return;
    try {
      await apiRequest(`/api/v1/knowledge-bases/${selected}/documents/${docId}`, { method: "DELETE" });
      setDocuments((d) => d.filter((x) => x.id !== docId));
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
      <PageHeader description="Create knowledge bases and upload documents for RAG. Files are chunked and embedded automatically." />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New knowledge base"
      >
        <form onSubmit={createBase} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              placeholder="e.g. Product docs"
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
          <div className="border-t border-[var(--border)] pt-3">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Default Chunking & Embedding (optional)</h3>
            <RagConfigForm
              value={kbConfig}
              onChange={setKbConfig}
              showPresetDropdown
              presets={presets}
              presetId={kbPresetId}
              onPresetChange={setKbPresetId}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editDocId != null}
        onClose={() => setEditDocId(null)}
        title="Edit document"
      >
        <form onSubmit={updateDocument} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={editDocName}
              onChange={(e) => setEditDocName(e.target.value)}
              className="input"
            />
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Chunking & Embedding for this document</h3>
            <RagConfigForm
              value={editDocConfig}
              onChange={setEditDocConfig}
              showPresetDropdown
              presets={presets}
              presetId={editDocPresetId}
              onPresetChange={setEditDocPresetId}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditDocId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editKbId != null} onClose={() => setEditKbId(null)} title="Edit knowledge base">
        <form onSubmit={updateBase} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={editKbName}
              onChange={(e) => setEditKbName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input
              type="text"
              value={editKbDescription}
              onChange={(e) => setEditKbDescription(e.target.value)}
              className="input"
            />
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Default Chunking & Embedding</h3>
            <RagConfigForm
              value={editKbConfig}
              onChange={setEditKbConfig}
              showPresetDropdown
              presets={presets}
              presetId={editKbPresetId}
              onPresetChange={setEditKbPresetId}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditKbId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-56 flex-shrink-0 flex flex-col h-[28rem]">
          <CardHeader className="min-h-[3.25rem] flex items-center flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-800">Bases</h2>
          </CardHeader>
          <CardBody className="p-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
            {bases.length === 0 ? (
              <div className="py-4 text-sm text-slate-500 text-center">No knowledge bases yet.</div>
            ) : (
              <ul className="space-y-2">
                {bases.map((kb) => (
                  <li key={kb.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(kb.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(kb.id);
                        }
                      }}
                      className={`flex items-center gap-2 p-3 rounded-[var(--radius-lg)] border border-[var(--border)] transition-all cursor-pointer ${
                        selected === kb.id
                          ? "bg-brand-50 shadow-[var(--shadow)]"
                          : "bg-[var(--card)] hover:border-slate-300 hover:bg-slate-50 hover:shadow-[var(--shadow)]"
                      }`}
                    >
                      <span
                        className={`flex-1 min-w-0 truncate text-sm font-medium ${
                          selected === kb.id ? "text-brand-700" : "text-slate-800"
                        }`}
                      >
                        {kb.name}
                      </span>
                      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditKbId(kb.id);
                            setEditKbName(kb.name);
                            setEditKbDescription(kb.description ?? "");
                            const c = (kb.config || {}) as Record<string, unknown>;
                            setEditKbConfig({
                              chunk_strategy: (c.chunk_strategy as string) || "fixed",
                              chunk_size: typeof c.chunk_size === "number" ? c.chunk_size : 512,
                              chunk_overlap: typeof c.chunk_overlap === "number" ? c.chunk_overlap : 50,
                              embedding_model: (c.embedding_model as string) || "all-MiniLM-L6-v2",
                              embedding_query_prefix: (c.embedding_query_prefix as string) ?? "",
                            });
                            setEditKbPresetId("");
                          }}
                          title="Edit"
                        >
                          <EditIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBase(kb.id);
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

        {selected && (
          <Card className="flex-1 min-w-0">
            <CardHeader className="min-h-[3.25rem] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-800">Documents</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  variant="ghost"
                  className="text-slate-600 text-sm"
                  onClick={() => setShowUploadConfig((v) => !v)}
                >
                  {showUploadConfig ? "Hide" : "Set chunking for uploads"}
                </Button>
                <input
                  ref={headerFileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx,.doc,.html,.htm"
                  className="hidden"
                  onChange={handleHeaderFileChange}
                />
                <Button
                  variant="primary"
                  disabled={uploading}
                  onClick={() => headerFileInputRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Add documents"}
                </Button>
              </div>
            </CardHeader>
            {showUploadConfig && (
              <div className="px-4 pb-3 border-b border-[var(--border)]">
                <RagConfigForm
                  value={uploadConfig}
                  onChange={setUploadConfig}
                  showPresetDropdown
                  presets={presets}
                  presetId={uploadPresetId}
                  onPresetChange={setUploadPresetId}
                />
              </div>
            )}
            <CardBody className="p-0 overflow-x-auto">
              {documents.length === 0 ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => emptyStateFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg m-4 p-8 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-brand-500 bg-brand-50/50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  } ${uploading ? "pointer-events-none opacity-70" : ""}`}
                >
                  <input
                    ref={emptyStateFileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.pdf,.docx,.doc,.html,.htm"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files?.length || !selected) return;
                      const opts = getUploadOpts();
                      (async () => {
                        setUploading(true);
                        try {
                          for (let i = 0; i < files.length; i++) {
                            const doc = await uploadSingleFile(files[i], opts);
                            if (doc) setDocuments((d) => [doc, ...d]);
                          }
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setUploading(false);
                          e.target.value = "";
                        }
                      })();
                    }}
                  />
                  <div className="text-center py-4 px-4">
                    <p className="font-medium text-slate-700">{dragOver ? "Drop files here" : "No documents"}</p>
                    <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                      {dragOver ? "Release to upload" : "Drag and drop PDF, DOCX, TXT, or HTML here, or click to browse."}
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[var(--border)]">
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{d.name}</td>
                        <td className="p-3">
                          <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                          {d.error_message && (
                            <p className="mt-1 text-xs text-red-600 max-w-xs truncate" title={d.error_message}>
                              {d.error_message}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-500">{new Date(d.created_at).toLocaleString()}</td>
                        <td className="p-3 flex gap-2 flex-wrap items-center">
                          <Button
                            variant="ghost"
                            className="text-xs py-1 px-1.5"
                            onClick={() => {
                              setEditDocId(d.id);
                              setEditDocName(d.name);
                              const c = (d.config || {}) as Record<string, unknown>;
                              setEditDocConfig({
                                chunk_strategy: (c.chunk_strategy as string) || "fixed",
                                chunk_size: typeof c.chunk_size === "number" ? c.chunk_size : 512,
                                chunk_overlap: typeof c.chunk_overlap === "number" ? c.chunk_overlap : 50,
                                embedding_model: (c.embedding_model as string) || "all-MiniLM-L6-v2",
                                embedding_query_prefix: (c.embedding_query_prefix as string) ?? "",
                              });
                              setEditDocPresetId("");
                            }}
                            title="Edit"
                          >
                            <EditIcon />
                          </Button>
                          {(d.status === "failed" || d.status === "completed") && (
                            <Button variant="ghost" onClick={() => reingest(d.id)}>
                              Re-ingest
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteDocument(d.id)}
                            title="Delete"
                          >
                            <DeleteIcon />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
