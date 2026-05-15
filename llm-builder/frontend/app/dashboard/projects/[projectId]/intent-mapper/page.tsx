"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { projectApi } from "@/lib/projectApi";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { EditIcon, DeleteIcon } from "@/app/components/ui";

type IntentMapperRow = {
  id: string;
  name: string;
  routing_model_id: string;
  knowledge_base_id: string;
  created_at: string;
};

type IntentDocItem = {
  document_id: string;
  intent_text: string;
};

type IntentMapperDetail = IntentMapperRow & {
  documents: IntentDocItem[];
};

type Model = { id: string; name: string };
type KnowledgeBase = { id: string; name: string };
type KBDocument = {
  id: string;
  name: string;
  source_type: string;
};

type IntentMapperDocGuide = {
  document_id: string;
  name: string;
  source_type: string;
  intent_text: string;
  selected: boolean;
  search_query: string | null;
  api_method: string | null;
  api_url: string | null;
  api_body_template: string | null;
  api_body_effective: unknown;
  database_allowed_tables: string[];
  database_table_effective: string | null;
  database_limit_effective: number | null;
};

type IntentMapperTestResponse = {
  question: string;
  router_error?: string | null;
  requested_document_id?: string | null;
  router_reason?: string | null;
  fallback_used?: boolean;
  error?: string | null;
  selected_document_id?: string | null;
  documents: IntentMapperDocGuide[];
};

type IntentMapperTestFetchError = {
  question: string;
  fetchError: string;
};

function isRagSourceType(t: string) {
  return t === "file" || t === "url" || t === "documentation_zip";
}

async function fetchModelsForPicker(projectId: string): Promise<Model[]> {
  if (!projectId) return [];
  const list = await apiRequest<Array<{ id: string; name: string }>>(projectApi(projectId, "models"));
  return list.map((m) => ({ id: m.id, name: m.name }));
}

export default function IntentMapperPage() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const [mappers, setMappers] = useState<IntentMapperRow[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    routing_model_id: "",
    knowledge_base_id: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IntentMapperDetail | null>(null);
  const [kbDocs, setKbDocs] = useState<KBDocument[]>([]);
  const [intentDrafts, setIntentDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    routing_model_id: "",
    knowledge_base_id: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [testMapperId, setTestMapperId] = useState<string | null>(null);
  const [testQuestion, setTestQuestion] = useState("");
  const [testResult, setTestResult] = useState<IntentMapperTestResponse | IntentMapperTestFetchError | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useTopBar(
    "Intent Mapper",
    <Button variant="primary" onClick={() => setShowCreate(true)}>
      New intent mapper
    </Button>
  );

  const loadMappers = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await apiRequest<IntentMapperRow[]>(projectApi(projectId, "intent-mappers"));
      setMappers(list);
      setSelectedId((prev) => {
        if (prev && list.some((m) => m.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMappers();
  }, [loadMappers]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [mods, kbs] = await Promise.all([
          fetchModelsForPicker(projectId),
          apiRequest<KnowledgeBase[]>(projectApi(projectId, "knowledge-bases")),
        ]);
        setModels(mods);
        setKnowledgeBases(kbs);
        if (mods.length && !form.routing_model_id) {
          setForm((f) => ({ ...f, routing_model_id: mods[0].id }));
        }
      } catch {
        setModels([]);
        setKnowledgeBases([]);
      }
    })();
  }, [projectId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!projectId) return;
    try {
      const d = await apiRequest<IntentMapperDetail>(projectApi(projectId, `intent-mappers/${id}`));
      setDetail(d);
      const drafts: Record<string, string> = {};
      for (const x of d.documents) {
        drafts[x.document_id] = x.intent_text;
      }
      setIntentDrafts(drafts);
      if (d.knowledge_base_id) {
        const docs = await apiRequest<KBDocument[]>(
          projectApi(projectId, `knowledge-bases/${d.knowledge_base_id}/documents`),
        );
        setKbDocs(docs);
      } else {
        setKbDocs([]);
      }
    } catch (e) {
      console.error(e);
      setDetail(null);
      setKbDocs([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else {
      setDetail(null);
      setKbDocs([]);
    }
  }, [selectedId, loadDetail]);

  const createMapper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.routing_model_id || !form.knowledge_base_id) return;
    setCreating(true);
    try {
      await apiRequest(projectApi(projectId, "intent-mappers"), {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          routing_model_id: form.routing_model_id,
          knowledge_base_id: form.knowledge_base_id,
          documents: [],
        }),
      });
      setForm((f) => ({ ...f, name: "" }));
      setShowCreate(false);
      await loadMappers();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const saveIntents = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const documents = kbDocs.map((doc) => ({
        document_id: doc.id,
        intent_text: intentDrafts[doc.id] ?? "",
      }));
      await apiRequest(projectApi(projectId, `intent-mappers/${detail.id}`), {
        method: "PATCH",
        body: JSON.stringify({ documents }),
      });
      await loadDetail(detail.id);
      await loadMappers();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !editForm.name.trim() || !editForm.routing_model_id || !editForm.knowledge_base_id) return;
    setSavingEdit(true);
    try {
      await apiRequest(projectApi(projectId, `intent-mappers/${editId}`), {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          routing_model_id: editForm.routing_model_id,
          knowledge_base_id: editForm.knowledge_base_id,
        }),
      });
      const id = editId;
      setEditId(null);
      await loadMappers();
      if (selectedId === id) await loadDetail(id);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteMapper = async (id: string) => {
    if (!confirm("Delete this intent mapper? Deployments that use it will need to be updated.")) return;
    try {
      await apiRequest(projectApi(projectId, `intent-mappers/${id}`), { method: "DELETE" });
      if (selectedId === id) setSelectedId(null);
      await loadMappers();
    } catch (e) {
      console.error(e);
    }
  };

  const runIntentTest = async () => {
    if (!testMapperId || !testQuestion.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await apiRequest<IntentMapperTestResponse>(
        projectApi(projectId, `intent-mappers/${testMapperId}/test`),
        {
          method: "POST",
          body: JSON.stringify({ question: testQuestion.trim() }),
        },
      );
      setTestResult(r);
    } catch (e) {
      setTestResult({
        question: testQuestion.trim(),
        fetchError: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-9 h-9 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader description="Route each question to a document (search, API, or DB). Use on a deployment instead of wiring the KB directly—KB XOR mapper, not both." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New intent mapper">
        <form onSubmit={createMapper} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Support routing"
              required
            />
          </div>
          <div>
            <label className="label">Routing model</label>
            <select
              className="input"
              value={form.routing_model_id}
              onChange={(e) => setForm((f) => ({ ...f, routing_model_id: e.target.value }))}
              required
            >
              <option value="">Select model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Knowledge base</label>
            <select
              className="input"
              value={form.knowledge_base_id}
              onChange={(e) => setForm((f) => ({ ...f, knowledge_base_id: e.target.value }))}
              required
            >
              <option value="">Select knowledge base</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
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

      <Modal open={editId != null} onClose={() => setEditId(null)} title="Edit intent mapper">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Routing model</label>
            <select
              className="input"
              value={editForm.routing_model_id}
              onChange={(e) => setEditForm((f) => ({ ...f, routing_model_id: e.target.value }))}
              required
            >
              <option value="">Select model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Knowledge base</label>
            <select
              className="input"
              value={editForm.knowledge_base_id}
              onChange={(e) => setEditForm((f) => ({ ...f, knowledge_base_id: e.target.value }))}
              required
            >
              <option value="">Select knowledge base</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditId(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={testMapperId != null}
        onClose={() => {
          setTestMapperId(null);
          setTestQuestion("");
          setTestResult(null);
        }}
        title="Test routing (deployment guide)"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            See how the routing model chooses a document for{" "}
            <strong>{mappers.find((x) => x.id === testMapperId)?.name ?? "this mapper"}</strong> and what the
            deployment would call for each source—search semantics, HTTP call, or SQL table—not full retrieved text.
          </p>
          <div>
            <label className="label">Question</label>
            <textarea
              className="input resize-y min-h-[100px]"
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              placeholder="User question to route…"
              rows={4}
            />
          </div>
          <Button type="button" variant="primary" onClick={runIntentTest} disabled={testLoading || !testQuestion.trim()}>
            {testLoading ? "Running…" : "Run"}
          </Button>
          {testResult &&
            ("fetchError" in testResult ? (
              <p className="text-sm text-red-600">{testResult.fetchError}</p>
            ) : (
              <div className="space-y-4 max-h-[min(32rem,70vh)] overflow-y-auto pr-1">
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-slate-50/80 p-3 text-sm space-y-1">
                  <p>
                    <span className="text-slate-500">Question:</span>{" "}
                    <span className="text-slate-800">{testResult.question}</span>
                  </p>
                  {testResult.router_reason ? (
                    <p>
                      <span className="text-slate-500">Router:</span>{" "}
                      <span className="text-slate-800">{testResult.router_reason}</span>
                    </p>
                  ) : null}
                  {testResult.router_error ? (
                    <p className="text-amber-800">
                      <span className="text-slate-500">Router note:</span> {testResult.router_error}
                    </p>
                  ) : null}
                  {testResult.fallback_used ? (
                    <p className="text-slate-600 text-xs">Fallback routing was used (keyword match on intents).</p>
                  ) : null}
                  {testResult.selected_document_id ? (
                    <p className="text-slate-700">
                      <span className="font-medium text-brand-700">Selected document id:</span>{" "}
                      <code className="text-xs bg-white px-1 rounded border border-[var(--border)]">
                        {testResult.selected_document_id}
                      </code>
                    </p>
                  ) : null}
                  {testResult.error ? (
                    <p className="text-red-700 text-sm">{testResult.error}</p>
                  ) : null}
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mapped documents</p>
                <ul className="space-y-3">
                  {[...testResult.documents]
                    .sort((a, b) => (a.selected === b.selected ? 0 : a.selected ? -1 : 1))
                    .map((g) => (
                      <li
                        key={g.document_id}
                        className={`rounded-[var(--radius)] border p-3 text-sm ${
                          g.selected
                            ? "border-brand-300 bg-brand-50/60 shadow-[var(--shadow)]"
                            : "border-[var(--border)] bg-[var(--card)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-medium text-slate-900">{g.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{g.source_type}</span>
                          {g.selected ? (
                            <span className="text-xs font-medium text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                              Selected for this question
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-2 text-slate-700">
                          <div>
                            <span className="text-slate-500 text-xs font-medium">When to use (intent)</span>
                            <p className="mt-0.5 whitespace-pre-wrap">{g.intent_text || "—"}</p>
                          </div>
                          {isRagSourceType(g.source_type) && g.search_query ? (
                            <div>
                              <span className="text-slate-500 text-xs font-medium">Retrieval / search</span>
                              <p className="mt-0.5">{g.search_query}</p>
                            </div>
                          ) : null}
                          {g.source_type === "api" ? (
                            <div className="space-y-1">
                              <span className="text-slate-500 text-xs font-medium">HTTP call</span>
                              <p className="font-mono text-xs break-all">
                                {g.api_method ?? "?"} {g.api_url || "(no URL)"}
                              </p>
                              {g.api_body_template ? (
                                <div>
                                  <span className="text-slate-500 text-xs">Body template</span>
                                  <pre className="mt-1 p-2 rounded bg-slate-100 text-xs overflow-x-auto whitespace-pre-wrap">
                                    {g.api_body_template}
                                  </pre>
                                </div>
                              ) : null}
                              {g.selected && g.api_body_effective != null ? (
                                <div>
                                  <span className="text-slate-500 text-xs">
                                    Effective body (router overrides merged in)
                                  </span>
                                  <pre className="mt-1 p-2 rounded bg-white border border-[var(--border)] text-xs overflow-x-auto whitespace-pre-wrap">
                                    {typeof g.api_body_effective === "string"
                                      ? g.api_body_effective
                                      : JSON.stringify(g.api_body_effective, null, 2)}
                                  </pre>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {g.source_type === "database" ? (
                            <div className="space-y-1">
                              <span className="text-slate-500 text-xs font-medium">Database</span>
                              {g.database_allowed_tables.length > 0 ? (
                                <p className="text-xs">
                                  Allowed tables: {g.database_allowed_tables.join(", ")}
                                </p>
                              ) : null}
                              {g.selected ? (
                                <p className="text-xs">
                                  <span className="text-slate-500">Table for this question:</span>{" "}
                                  <code className="bg-slate-100 px-1 rounded">{g.database_table_effective ?? "—"}</code>
                                  {g.database_limit_effective != null ? (
                                    <>
                                      {" "}
                                      <span className="text-slate-500">· limit</span>{" "}
                                      <code className="bg-slate-100 px-1 rounded">{g.database_limit_effective}</code>
                                    </>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-500">
                                  When this row is selected, the router chooses the table and row limit for the query.
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
        </div>
      </Modal>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-80 flex-shrink-0">
          <CardHeader>
            <h2 className="font-semibold text-slate-800">Mappers</h2>
          </CardHeader>
          <CardBody className="p-3 space-y-2">
            {mappers.length === 0 ? (
              <EmptyState title="No intent mappers" description="Create one to route questions to documents, APIs, or databases." />
            ) : (
              <ul className="space-y-2">
                {mappers.map((m) => (
                  <li key={m.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(m.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(m.id);
                        }
                      }}
                      className={`flex items-center gap-2 p-3 rounded-[var(--radius-lg)] border transition-all cursor-pointer ${
                        selectedId === m.id
                          ? "border-brand-300 bg-brand-50 shadow-[var(--shadow)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex-1 min-w-0 truncate text-sm font-medium ${
                          selectedId === m.id ? "text-brand-700" : "text-slate-800"
                        }`}
                      >
                        {m.name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          className="text-xs py-1 px-2"
                          onClick={() => {
                            setTestMapperId(m.id);
                            setTestQuestion("");
                            setTestResult(null);
                          }}
                        >
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5"
                          title="Edit"
                          onClick={() => {
                            setEditId(m.id);
                            setEditForm({
                              name: m.name,
                              routing_model_id: m.routing_model_id,
                              knowledge_base_id: m.knowledge_base_id,
                            });
                          }}
                        >
                          <EditIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-xs py-1 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete"
                          onClick={() => deleteMapper(m.id)}
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

        <Card className="flex-1 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-800">Document intents</h2>
            {detail && (
              <Button variant="primary" onClick={saveIntents} disabled={saving}>
                {saving ? "Saving…" : "Save intents"}
              </Button>
            )}
          </CardHeader>
          <CardBody>
            {!selectedId || !detail ? (
              <p className="text-sm text-slate-500">Select an intent mapper to edit per-document intents.</p>
            ) : kbDocs.length === 0 ? (
              <p className="text-sm text-slate-500">No documents in this knowledge base yet. Add files, API specs, or database connections under Knowledge.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Mapper uses <strong>{models.find((x) => x.id === detail.routing_model_id)?.name ?? "model"}</strong>{" "}
                  and knowledge base{" "}
                  <strong>{knowledgeBases.find((k) => k.id === detail.knowledge_base_id)?.name ?? ""}</strong>.
                </p>
                <ul className="space-y-4">
                  {kbDocs.map((doc) => (
                    <li key={doc.id} className="border border-[var(--border)] rounded-[var(--radius)] p-3 bg-[var(--card)]">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium text-slate-800">{doc.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{doc.source_type}</span>
                      </div>
                      <label className="label text-xs">Intent (when to use this source)</label>
                      <textarea
                        className="input min-h-[72px] text-sm"
                        value={intentDrafts[doc.id] ?? ""}
                        onChange={(e) =>
                          setIntentDrafts((prev) => ({
                            ...prev,
                            [doc.id]: e.target.value,
                          }))
                        }
                        placeholder="Describe what user questions should pick this document..."
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
