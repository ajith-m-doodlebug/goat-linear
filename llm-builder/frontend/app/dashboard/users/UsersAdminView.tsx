"use client";

import { useEffect, useState } from "react";
import { apiRequest, createUserAsSuperAdmin } from "@/lib/api";
import type { UserResponse } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { Button } from "@/app/components/ui/Button";

const ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "tester", label: "Tester" },
];

export default function UsersAdminView() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("developer");
  const [creating, setCreating] = useState(false);

  useTopBar("Users");

  useEffect(() => {
    apiRequest<UserResponse[]>("/api/v1/users")
      .then(setUsers)
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
    apiRequest<UserResponse>("/api/v1/users/me").then(setCurrentUser).catch(() => {});
  }, []);

  async function handleRoleChange(userId: string, newRoleValue: string) {
    setUpdatingId(userId);
    setError(null);
    try {
      const updated = await apiRequest<UserResponse>(`/api/v1/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRoleValue }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await createUserAsSuperAdmin({
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setUsers((prev) => [...prev, created].sort((a, b) => a.email.localeCompare(b.email)));
      setNewEmail("");
      setNewPassword("");
      setNewRole("developer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const isSuperAdmin = currentUser?.role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-slate-600">
        You don&apos;t have access to this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-[var(--radius)] bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Add user</h2>
        <form onSubmit={handleCreateUser} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="input w-full"
              placeholder="colleague@company.com"
              autoComplete="off"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="label">Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="input w-full"
              autoComplete="new-password"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="label">Account type</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-2 text-sm bg-[var(--background)] w-full"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="primary" disabled={creating} className="w-full sm:w-auto">
            {creating ? "Creating…" : "Create user"}
          </Button>
        </form>
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-slate-50/80">
              <th className="text-left px-4 py-3 font-medium text-slate-700">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-700">Full name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-700">Role</th>
              <th className="text-left px-4 py-3 font-medium text-slate-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-700">Change role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 text-slate-800">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">{user.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="font-medium capitalize">{user.role.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3">{user.is_active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  {user.role === "super_admin" ? (
                    <span className="text-slate-400 text-xs">—</span>
                  ) : (
                    <select
                      value={user.role}
                      disabled={updatingId === user.id}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm bg-[var(--background)]"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && (
        <p className="text-slate-600 text-center py-8">No users yet.</p>
      )}
    </div>
  );
}
