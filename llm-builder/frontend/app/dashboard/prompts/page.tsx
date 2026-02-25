"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { EditIcon, DeleteIcon } from "@/app/components/ui/icons";

const PROMPT_TEMPLATES_API = "/api/v1/deployments/prompt-templates";

type PromptTemplate = {
  id: string;
  name: string;
  content: string;
  version: string | null;
  created_at: string;
};

const PLACEHOLDER_CONTENT = `Use these placeholders in your prompt:
- {context} — retrieved document chunks (when using a knowledge base)
- {question} — the user's question
- {memory} — recent chat history (optional)

Example:
Answer only from the context below. If the answer is not in the context, say so.

Context:
{context}

Question: {question}

Answer:`;

export default function PromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState("");

  useTopBar(
    "Prompts",
    <Button variant="primary" onClick={() => openCreate()}>
      New prompt template
    </Button>
  );

  const loadTemplates = useCallback(async () => {
    try {
      const list = await apiRequest<PromptTemplate[]>(PROMPT_TEMPLATES_API);
      setTemplates(list);
    } catch (e) {
      console.error(e);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setContent("");
    setVersion("");
    setShowModal(true);
  }

  function openEdit(t: PromptTemplate) {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.content);
    setVersion(t.version ?? "");
    setShowModal(true);
  }

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiRequest<PromptTemplate>(`${PROMPT_TEMPLATES_API}/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            content: content.trim(),
            version: version.trim() || null,
          }),
        });
      } else {
        await apiRequest<PromptTemplate>(PROMPT_TEMPLATES_API, {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            content: content.trim(),
            version: version.trim() || null,
          }),
        });
      }
      setShowModal(false);
      await loadTemplates();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this prompt template? Deployments using it will have no template.")) return;
    try {
      await apiRequest(`${PROMPT_TEMPLATES_API}/${id}`, { method: "DELETE" });
      await loadTemplates();
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
        description="Create and manage prompt templates. Use placeholders {context}, {question}, and optionally {memory}. Assign a template to a deployment so chat uses your custom prompt."
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit prompt template" : "New prompt template"}
      >
        <form onSubmit={saveTemplate} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              placeholder="e.g. RAG answer from context"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              placeholder={PLACEHOLDER_CONTENT}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input min-h-[200px] font-mono text-sm"
              rows={10}
            />
            <p className="mt-1 text-xs text-slate-500">
              Use {"{context}"}, {"{question}"}, and optionally {"{memory}"} as placeholders.
            </p>
          </div>
          <div>
            <label className="label">Version (optional)</label>
            <input
              type="text"
              placeholder="e.g. 1.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="input"
            />
          </div>
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

      <Card className="max-w-4xl">
        <CardHeader className="min-h-[3.25rem] flex items-center">
          <h2 className="text-base font-semibold text-slate-800">Prompt templates</h2>
        </CardHeader>
        <CardBody className="p-0">
          {templates.length === 0 ? (
            <EmptyState
              title="No prompt templates yet"
              description="Create a template to reuse prompts across deployments. You can then select it when creating or editing a deployment."
              action={
                <Button variant="primary" onClick={() => openCreate()}>
                  New prompt template
                </Button>
              }
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[var(--border)]">
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Content preview</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Version</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-800">{t.name}</td>
                    <td className="p-3 text-sm text-slate-600 max-w-md truncate" title={t.content}>
                      {t.content.slice(0, 80)}
                      {t.content.length > 80 ? "…" : ""}
                    </td>
                    <td className="p-3 text-sm text-slate-500">{t.version || "—"}</td>
                    <td className="p-3 flex gap-1">
                      <Button
                        variant="ghost"
                        className="text-xs py-1 px-1.5"
                        onClick={() => openEdit(t)}
                        title="Edit"
                      >
                        <EditIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs py-1 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteTemplate(t.id)}
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
    </div>
  );
}
