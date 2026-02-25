"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  last_used_at: string | null;
  created_at: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useTopBar("API Keys", null);

  const load = async () => {
    try {
      const list = await apiRequest<ApiKeyRow[]>("/api/v1/api-keys");
      setKeys(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreatedKey(null);
    try {
      const res = await apiRequest<{ key: string; name: string; key_prefix: string }>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setCreatedKey(res.key);
      setNewName("");
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    try {
      await apiRequest(`/api/v1/api-keys/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <PageHeader description="Create keys for programmatic access. Use the key in the X-API-Key header." />

      <Card className="mb-6 max-w-md">
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Create key</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={createKey} className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Key name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input flex-1 min-w-[200px]"
            />
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating…" : "Create key"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {createdKey && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardBody>
            <p className="font-medium text-amber-800">Save this key now. It won&apos;t be shown again.</p>
            <code className="block mt-2 p-3 bg-white rounded-[var(--radius)] break-all text-sm font-mono">{createdKey}</code>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Your API keys</h2>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-600">Loading…</div>
          ) : keys.length === 0 ? (
            <EmptyState
              title="No API keys"
              description="Create a key to use the API from scripts or external apps."
              action={
                <Button variant="primary" onClick={() => {}}>
                  Create key above
                </Button>
              }
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[var(--border)]">
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Prefix</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                    <td className="p-3 font-medium">{k.name}</td>
                    <td className="p-3 font-mono text-sm">{k.key_prefix}</td>
                    <td className="p-3 text-slate-500 text-sm">{new Date(k.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <Button variant="ghost" onClick={() => revoke(k.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        Revoke
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
