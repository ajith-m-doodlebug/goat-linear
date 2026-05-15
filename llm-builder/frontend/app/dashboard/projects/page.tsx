"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, authApi } from "@/lib/api";
import type { UserResponse } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { EditIcon, DeleteIcon, CloneIcon, ShareIcon } from "@/app/components/ui";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  cloned_from_project_id: string | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  email: string;
  access: string;
};

export default function ProjectsListPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [cloneSource, setCloneSource] = useState<ProjectRow | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [membersFor, setMembersFor] = useState<ProjectRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAccess, setInviteAccess] = useState<"view" | "edit">("view");
  const [membersLoading, setMembersLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const canCreate = user?.role === "super_admin" || user?.role === "admin" || user?.role === "developer";

  useTopBar(
    "Projects",
    canCreate ? (
      <Button variant="primary" onClick={() => setShowCreate(true)}>
        New project
      </Button>
    ) : null,
    user?.role,
  );

  const load = useCallback(async () => {
    try {
      const list = await apiRequest<ProjectRow[]>("/api/v1/projects");
      setProjects(list);
    } catch (e) {
      console.error(e);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMembers = async (pid: string) => {
    setMembersLoading(true);
    try {
      const rows = await apiRequest<MemberRow[]>(`/api/v1/projects/${pid}/members`);
      setMembers(rows);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await apiRequest<ProjectRow>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim() || null,
        }),
      });
      setShowCreate(false);
      setCreateName("");
      setCreateDescription("");
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const runClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSource || !cloneName.trim()) return;
    setCloning(true);
    try {
      const created = await apiRequest<ProjectRow>(`/api/v1/projects/${cloneSource.id}/clone`, {
        method: "POST",
        body: JSON.stringify({ name: cloneName.trim() }),
      });
      setCloneSource(null);
      setCloneName("");
      await load();
      router.push(`/dashboard/projects/${created.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCloning(false);
    }
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membersFor || !inviteEmail.trim()) return;
    try {
      await apiRequest(`/api/v1/projects/${membersFor.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), access: inviteAccess }),
      });
      setInviteEmail("");
      await loadMembers(membersFor.id);
    } catch (err) {
      console.error(err);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await apiRequest(`/api/v1/projects/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      setEditTarget(null);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const archiveProject = async (p: ProjectRow) => {
    if (!confirm(`Archive project “${p.name}”? It will disappear from the list for everyone until restored in the database.`)) return;
    try {
      await apiRequest(`/api/v1/projects/${p.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const openRow = (id: string) => {
    router.push(`/dashboard/projects/${id}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader description="One workspace per project—click a row to open." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New project">
        <form onSubmit={createProject} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input resize-y min-h-[72px]" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={cloneSource != null} onClose={() => setCloneSource(null)} title="Clone project">
        <form onSubmit={runClone} className="space-y-4">
          <p className="text-sm text-slate-600">
            Copy deployments, prompts, intent mappers, and model links from <strong>{cloneSource?.name}</strong>. Knowledge bases are shared by reference.
          </p>
          <div>
            <label className="label">New project name</label>
            <input className="input" value={cloneName} onChange={(e) => setCloneName(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={cloning}>
              {cloning ? "Cloning…" : "Clone"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCloneSource(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={membersFor != null} onClose={() => setMembersFor(null)} title="Share project">
        {membersLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="space-y-2 mb-4 text-sm">
            {members.map((m) => (
              <li key={m.user_id} className="flex justify-between gap-2 border-b border-[var(--border)] pb-2">
                <span className="truncate">{m.email}</span>
                <span className="text-slate-500">{m.access}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={inviteMember} className="space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Invite by email</p>
          <input className="input" placeholder="user@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <select className="input" value={inviteAccess} onChange={(e) => setInviteAccess(e.target.value as "view" | "edit")}>
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
          <Button type="submit" variant="primary">
            Save access
          </Button>
        </form>
      </Modal>

      <Modal open={editTarget != null} onClose={() => setEditTarget(null)} title="Edit project">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-y min-h-[72px]" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description={canCreate ? "Create a project to organize knowledge bases, deployments, and chat." : "Ask an administrator to add you to a project."}
          action={
            canCreate ? (
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-slate-50/80 text-left text-slate-500">
                <th className="px-4 py-3 font-semibold">Project</th>
                <th className="px-4 py-3 font-semibold w-[1%] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => openRow(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRow(p.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium text-slate-800">{p.name}</div>
                    {p.description ? <p className="text-slate-500 mt-0.5 line-clamp-2">{p.description}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {canCreate ? (
                      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="p-2 rounded-[var(--radius)] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Edit"
                          aria-label="Edit project"
                          onClick={() => {
                            setEditTarget(p);
                            setEditName(p.name);
                            setEditDescription(p.description ?? "");
                          }}
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-[var(--radius)] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Clone"
                          aria-label="Clone project"
                          onClick={() => {
                            setCloneSource(p);
                            setCloneName(`${p.name} copy`);
                          }}
                        >
                          <CloneIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-[var(--radius)] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Share"
                          aria-label="Share project"
                          onClick={() => {
                            setMembersFor(p);
                            void loadMembers(p.id);
                          }}
                        >
                          <ShareIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-[var(--radius)] text-slate-500 hover:bg-red-50 hover:text-red-700"
                          title="Archive"
                          aria-label="Archive project"
                          onClick={() => archiveProject(p)}
                        >
                          <DeleteIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
