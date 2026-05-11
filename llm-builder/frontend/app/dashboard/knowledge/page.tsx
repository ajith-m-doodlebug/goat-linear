"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getApiBase } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { Modal } from "@/app/components/ui/Modal";
import { EditIcon, DeleteIcon } from "@/app/components/ui";
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

type DocumentTestResponse = {
  ok: boolean;
  mode: string;
  message: string | null;
  snippets: string[] | null;
  citations: unknown[] | null;
  api_ok: boolean | null;
  api_response: string | null;
  database_preview: string | null;
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

function isRetrievalDocType(t: string) {
  return t === "file" || t === "url" || t === "documentation_zip";
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
  const [editKbRetrieverMode, setEditKbRetrieverMode] = useState<"hybrid" | "vector_only">("hybrid");
  const [editKbPresetId, setEditKbPresetId] = useState<string>("");
  const [kbConfig, setKbConfig] = useState<RagConfigFormValues>(DEFAULT_RAG_CONFIG);
  const [kbRetrieverMode, setKbRetrieverMode] = useState<"hybrid" | "vector_only">("hybrid");
  const [kbPresetId, setKbPresetId] = useState<string>("");
  const [presets, setPresets] = useState<RagPreset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editDocConfig, setEditDocConfig] = useState<RagConfigFormValues>(DEFAULT_RAG_CONFIG);
  const [editDocPresetId, setEditDocPresetId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "documentation">("file");
  const [showApiModal, setShowApiModal] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [apiSaving, setApiSaving] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [apiForm, setApiForm] = useState({
    name: "",
    method: "GET",
    url: "",
    headersJson: "",
    body: "",
    example_response: "",
    execute_at_runtime: true,
  });
  const [dbForm, setDbForm] = useState({
    name: "",
    engine: "postgresql",
    host: "",
    port: "",
    database: "",
    user: "",
    password: "",
    sqlite_path: "",
  });
  const [testDoc, setTestDoc] = useState<Document | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testApiBody, setTestApiBody] = useState("{}");
  const [testDbTable, setTestDbTable] = useState("");
  const [testDbLimit, setTestDbLimit] = useState("20");
  const [testResult, setTestResult] = useState<DocumentTestResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);
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
        retriever_mode: kbRetrieverMode,
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
      setKbRetrieverMode("hybrid");
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
    uploadType === "documentation"
      ? file.name.toLowerCase().endsWith(".zip")
      : ACCEPT_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));

  const submitApiDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !apiForm.name.trim() || !apiForm.url.trim()) return;
    let headers: Record<string, string> | undefined;
    if (apiForm.headersJson.trim()) {
      try {
        headers = JSON.parse(apiForm.headersJson) as Record<string, string>;
      } catch {
        alert("Headers must be valid JSON object");
        return;
      }
    }
    setApiSaving(true);
    try {
      await apiRequest(`/api/v1/knowledge-bases/${selected}/documents/api`, {
        method: "POST",
        body: JSON.stringify({
          name: apiForm.name.trim(),
          method: apiForm.method,
          url: apiForm.url.trim(),
          headers,
          body: apiForm.body || null,
          example_response: apiForm.example_response || null,
          execute_at_runtime: apiForm.execute_at_runtime,
        }),
      });
      setShowApiModal(false);
      setApiForm({
        name: "",
        method: "GET",
        url: "",
        headersJson: "",
        body: "",
        example_response: "",
        execute_at_runtime: true,
      });
      await fetchDocuments();
    } catch (err) {
      console.error(err);
    } finally {
      setApiSaving(false);
    }
  };

  const submitDbDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !dbForm.name.trim()) return;
    setDbSaving(true);
    try {
      const portNum = dbForm.port.trim() ? parseInt(dbForm.port, 10) : undefined;
      await apiRequest(`/api/v1/knowledge-bases/${selected}/documents/database`, {
        method: "POST",
        body: JSON.stringify({
          name: dbForm.name.trim(),
          engine: dbForm.engine,
          host: dbForm.host || null,
          port: Number.isFinite(portNum as number) ? portNum : null,
          database: dbForm.database || null,
          user: dbForm.user || null,
          password: dbForm.password || null,
          sqlite_path: dbForm.sqlite_path || null,
        }),
      });
      setShowDbModal(false);
      setDbForm({
        name: "",
        engine: "postgresql",
        host: "",
        port: "",
        database: "",
        user: "",
        password: "",
        sqlite_path: "",
      });
      await fetchDocuments();
    } catch (err) {
      console.error(err);
    } finally {
      setDbSaving(false);
    }
  };

  const uploadSingleFile = useCallback(
    async (
      file: File,
      opts?: { config?: RagConfigFormValues; presetId?: string; uploadType?: "file" | "documentation" }
    ): Promise<Document | null> => {
      if (!selected) return null;
      const form = new FormData();
      form.append("file", file);
      if (opts?.uploadType === "documentation") {
        form.append("upload_type", "documentation");
      } else {
        if (opts?.presetId) form.append("preset_id", opts.presetId);
        if (opts?.config) {
          form.append(
            "config",
            JSON.stringify({
              chunk_strategy: opts.config!.chunk_strategy,
              chunk_size: opts.config!.chunk_size,
              chunk_overlap: opts.config!.chunk_overlap,
              embedding_model: opts.config!.embedding_model,
              embedding_query_prefix: opts.config!.embedding_query_prefix || null,
            })
          );
        }
      }
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${getApiBase()}/api/v1/knowledge-bases/${selected}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [selected]
  );

  const getUploadOpts = useCallback((): {
    config?: RagConfigFormValues;
    presetId?: string;
    uploadType?: "file" | "documentation";
  } | undefined => {
    if (uploadType === "documentation") {
      return { uploadType: "documentation" };
    }
    return undefined;
  }, [uploadType]);

  const handleHeaderFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !selected) return;
      const toUpload = uploadType === "documentation" ? [files[0]] : Array.from(files);
      setUploading(true);
      try {
        const opts = getUploadOpts();
        for (let i = 0; i < toUpload.length; i++) {
          const doc = await uploadSingleFile(toUpload[i], opts);
          if (doc) setDocuments((d) => [doc, ...d]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [selected, uploadType, uploadSingleFile, getUploadOpts]
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
        retriever_mode: editKbRetrieverMode,
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

  const openDocumentTest = (d: Document) => {
    setTestDoc(d);
    setTestResult(null);
    setTestQuery("");
    setTestApiBody("{}");
    const c = (d.config || {}) as { allowed_tables?: string[] };
    const tables = Array.isArray(c.allowed_tables) ? c.allowed_tables : [];
    setTestDbTable(tables[0] ?? "");
    setTestDbLimit("20");
  };

  const runDocumentTest = async () => {
    if (!selected || !testDoc) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const payload: Record<string, unknown> = {};
      if (isRetrievalDocType(testDoc.source_type)) {
        payload.question = testQuery.trim();
      } else if (testDoc.source_type === "api") {
        try {
          const raw = testApiBody.trim();
          payload.request_body = raw ? JSON.parse(raw) : undefined;
        } catch {
          alert("Request body must be valid JSON.");
          setTestLoading(false);
          return;
        }
      } else if (testDoc.source_type === "database") {
        payload.table = testDbTable.trim() || undefined;
        const lim = parseInt(testDbLimit, 10);
        payload.limit = Number.isFinite(lim) ? lim : 20;
      }
      const res = await apiRequest<DocumentTestResponse>(
        `/api/v1/knowledge-bases/${selected}/documents/${testDoc.id}/test`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      setTestResult(res);
    } catch (e) {
      setTestResult({
        ok: false,
        mode: "error",
        message: e instanceof Error ? e.message : "Request failed",
        snippets: null,
        citations: null,
        api_ok: null,
        api_response: null,
        database_preview: null,
      });
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
      <PageHeader description="Upload files, add API definitions, or database connections. Files are chunked and embedded; API and DB sources are used by intent-mapped deployments. Use Test on a document to verify retrieval, HTTP, or database connectivity." />

      <Modal open={showApiModal} onClose={() => setShowApiModal(false)} title="Add API document">
        <form onSubmit={submitApiDocument} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={apiForm.name} onChange={(e) => setApiForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={apiForm.method} onChange={(e) => setApiForm((f) => ({ ...f, method: e.target.value }))}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">URL</label>
            <input className="input font-mono text-sm" value={apiForm.url} onChange={(e) => setApiForm((f) => ({ ...f, url: e.target.value }))} required placeholder="https://api.example.com/v1/..." />
          </div>
          <div>
            <label className="label">Headers (JSON object, optional)</label>
            <textarea className="input font-mono text-xs min-h-[60px]" value={apiForm.headersJson} onChange={(e) => setApiForm((f) => ({ ...f, headersJson: e.target.value }))} placeholder='{"Authorization": "Bearer ..."}' />
          </div>
          <div>
            <label className="label">Body template (optional)</label>
            <textarea className="input font-mono text-xs min-h-[72px]" value={apiForm.body} onChange={(e) => setApiForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <div>
            <label className="label">Example response (optional)</label>
            <textarea className="input font-mono text-xs min-h-[72px]" value={apiForm.example_response} onChange={(e) => setApiForm((f) => ({ ...f, example_response: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={apiForm.execute_at_runtime} onChange={(e) => setApiForm((f) => ({ ...f, execute_at_runtime: e.target.checked }))} />
            Execute request at chat time (subject to network policy)
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={apiSaving}>{apiSaving ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowApiModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showDbModal} onClose={() => setShowDbModal(false)} title="Add database document">
        <form onSubmit={submitDbDocument} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={dbForm.name} onChange={(e) => setDbForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Engine</label>
            <select className="input" value={dbForm.engine} onChange={(e) => setDbForm((f) => ({ ...f, engine: e.target.value }))}>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>
          {dbForm.engine === "sqlite" ? (
            <div>
              <label className="label">SQLite file path</label>
              <input className="input font-mono text-sm" value={dbForm.sqlite_path} onChange={(e) => setDbForm((f) => ({ ...f, sqlite_path: e.target.value }))} required />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Host</label>
                  <input className="input" value={dbForm.host} onChange={(e) => setDbForm((f) => ({ ...f, host: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input className="input" value={dbForm.port} onChange={(e) => setDbForm((f) => ({ ...f, port: e.target.value }))} placeholder="5432 / 3306" />
                </div>
              </div>
              <div>
                <label className="label">Database name</label>
                <input className="input" value={dbForm.database} onChange={(e) => setDbForm((f) => ({ ...f, database: e.target.value }))} />
              </div>
              <div>
                <label className="label">User</label>
                <input className="input" value={dbForm.user} onChange={(e) => setDbForm((f) => ({ ...f, user: e.target.value }))} />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={dbForm.password} onChange={(e) => setDbForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
            </>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={dbSaving}>{dbSaving ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowDbModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={testDoc != null}
        onClose={() => {
          setTestDoc(null);
          setTestResult(null);
        }}
        title={testDoc ? `Test: ${testDoc.name}` : "Test document"}
      >
        {testDoc && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Type: <span className="font-medium text-slate-800">{testDoc.source_type}</span>
            </p>
            {isRetrievalDocType(testDoc.source_type) && (
              <div>
                <label className="label">Test query or phrase</label>
                <textarea
                  className="input resize-y min-h-[88px] text-sm"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Enter text to run hybrid retrieval against this document’s chunks…"
                  rows={3}
                />
                <p className="mt-1 text-xs text-slate-500">Requires status “completed” after ingest.</p>
              </div>
            )}
            {testDoc.source_type === "api" && (
              <div>
                <label className="label">JSON body (merged with the document body template)</label>
                <textarea
                  className="input font-mono text-xs min-h-[100px]"
                  value={testApiBody}
                  onChange={(e) => setTestApiBody(e.target.value)}
                  placeholder="{}"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Sends a real HTTP request when “execute at runtime” is enabled; otherwise shows config only.
                </p>
              </div>
            )}
            {testDoc.source_type === "database" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Table</label>
                  {(
                    ((testDoc.config || {}) as { allowed_tables?: string[] }).allowed_tables || []
                  ).length > 0 ? (
                    <select
                      className="input"
                      value={testDbTable}
                      onChange={(e) => setTestDbTable(e.target.value)}
                    >
                      <option value="">Default (first allowed)</option>
                      {(
                        ((testDoc.config || {}) as { allowed_tables?: string[] }).allowed_tables || []
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input font-mono text-sm"
                      value={testDbTable}
                      onChange={(e) => setTestDbTable(e.target.value)}
                      placeholder="Table name (must be in allowed_tables on the document)"
                    />
                  )}
                </div>
                <div>
                  <label className="label">Row limit</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={200}
                    value={testDbLimit}
                    onChange={(e) => setTestDbLimit(e.target.value)}
                  />
                </div>
              </div>
            )}
            <Button type="button" variant="primary" onClick={runDocumentTest} disabled={testLoading}>
              {testLoading ? "Running…" : "Run test"}
            </Button>
            {testResult && (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-slate-50 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={testResult.ok ? "success" : "error"}>{testResult.ok ? "OK" : "Failed"}</Badge>
                  <span className="text-slate-600">{testResult.mode}</span>
                </div>
                {testResult.message && <p className="text-slate-800">{testResult.message}</p>}
                {testResult.snippets && testResult.snippets.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Snippets</p>
                    <ul className="space-y-2 list-decimal list-inside text-slate-700 text-xs">
                      {testResult.snippets.map((s, i) => (
                        <li key={i} className="whitespace-pre-wrap break-words">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {testResult.api_response != null && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {testResult.mode === "api" ? "Response" : "Output"}
                    </p>
                    <pre className="p-2 rounded bg-white border border-[var(--border)] text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {testResult.api_response}
                    </pre>
                  </div>
                )}
                {testResult.database_preview != null && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Query preview</p>
                    <pre className="p-2 rounded bg-white border border-[var(--border)] text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {testResult.database_preview}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

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
            <h3 className="text-sm font-medium text-slate-700 mb-2">Retrieval (Chat & API)</h3>
            <div className="mb-2">
              <label className="label">Mode</label>
              <select
                value={kbRetrieverMode}
                onChange={(e) => setKbRetrieverMode(e.target.value as "hybrid" | "vector_only")}
                className="input w-full"
              >
                <option value="hybrid">Standard (hybrid) — best recall, keyword + vector</option>
                <option value="vector_only">Fast (vector only) — faster, semantic search only</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {kbRetrieverMode === "vector_only"
                  ? "Skips keyword scan; same answer quality for most queries, lower latency."
                  : "Searches by keywords and vectors for maximum recall."}
              </p>
            </div>
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
            <h3 className="text-sm font-medium text-slate-700 mb-2">Retrieval (Chat & API)</h3>
            <div className="mb-2">
              <label className="label">Mode</label>
              <select
                value={editKbRetrieverMode}
                onChange={(e) => setEditKbRetrieverMode(e.target.value as "hybrid" | "vector_only")}
                className="input w-full"
              >
                <option value="hybrid">Standard (hybrid) — best recall, keyword + vector</option>
                <option value="vector_only">Fast (vector only) — faster, semantic search only</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {editKbRetrieverMode === "vector_only"
                  ? "Skips keyword scan; same answer quality for most queries, lower latency."
                  : "Searches by keywords and vectors for maximum recall."}
              </p>
            </div>
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
        <Card className="lg:w-72 flex-shrink-0 flex flex-col max-lg:max-h-[24rem] lg:h-[28rem]">
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
                            setEditKbRetrieverMode(
                              (c.retriever_mode as "hybrid" | "vector_only") === "vector_only" ? "vector_only" : "hybrid"
                            );
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
                <div className="flex rounded-[var(--radius)] border border-[var(--border)] p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setUploadType("file")}
                    className={`px-3 py-1.5 text-sm rounded-[calc(var(--radius)-2px)] transition-colors ${
                      uploadType === "file"
                        ? "bg-white shadow-sm text-slate-800 font-medium"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadType("documentation")}
                    className={`px-3 py-1.5 text-sm rounded-[calc(var(--radius)-2px)] transition-colors ${
                      uploadType === "documentation"
                        ? "bg-white shadow-sm text-slate-800 font-medium"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    Documentation (ZIP)
                  </button>
                </div>
                <input
                  ref={headerFileInputRef}
                  type="file"
                  multiple={uploadType === "file"}
                  accept={uploadType === "documentation" ? ".zip" : ".txt,.pdf,.docx,.doc,.html,.htm"}
                  className="hidden"
                  onChange={handleHeaderFileChange}
                />
                <Button variant="secondary" type="button" onClick={() => setShowApiModal(true)}>
                  Add API
                </Button>
                <Button variant="secondary" type="button" onClick={() => setShowDbModal(true)}>
                  Add database
                </Button>
                <Button
                  variant="primary"
                  disabled={uploading}
                  onClick={() => headerFileInputRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Add documents"}
                </Button>
              </div>
            </CardHeader>
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
                    multiple={uploadType === "file"}
                    accept={uploadType === "documentation" ? ".zip" : ".txt,.pdf,.docx,.doc,.html,.htm"}
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files?.length || !selected) return;
                      const opts = getUploadOpts();
                      (async () => {
                        setUploading(true);
                        try {
                          const toUpload = uploadType === "documentation" ? [files[0]] : Array.from(files);
                          for (let i = 0; i < toUpload.length; i++) {
                            const doc = await uploadSingleFile(toUpload[i], opts);
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
                      {uploadType === "documentation"
                        ? dragOver
                          ? "Release to upload"
                          : "Drag and drop a documentation ZIP here, or click to browse."
                        : dragOver
                          ? "Release to upload"
                          : "Drag and drop PDF, DOCX, TXT, or HTML here, or click to browse."}
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[var(--border)]">
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{d.name}</td>
                        <td className="p-3 text-sm text-slate-600">{d.source_type}</td>
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
                            variant="secondary"
                            className="text-xs py-1 px-2"
                            onClick={() => openDocumentTest(d)}
                          >
                            Test
                          </Button>
                          {d.source_type !== "documentation_zip" &&
                            d.source_type !== "api" &&
                            d.source_type !== "database" && (
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
                          )}
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
