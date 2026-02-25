"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardBody } from "@/app/components/ui/Card";

type LogEntry = {
  id: string;
  user_id: string | null;
  api_key_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  request_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useTopBar("Audit", null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (userFilter) params.set("user_id", userFilter);
      if (actionFilter) params.set("action", actionFilter);
      params.set("limit", "100");
      const list = await apiRequest<LogEntry[]>(`/api/v1/audit/logs?${params}`);
      setLogs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Audit logs" description="Viewable by Auditor and Admin roles." />
      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Filter by user ID"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="input max-w-xs"
            />
            <input
              type="text"
              placeholder="Filter by action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="input max-w-xs"
            />
            <button type="button" onClick={load} className="px-4 py-2 rounded-[var(--radius)] font-medium text-white bg-brand-600 hover:bg-brand-700">
              Search
            </button>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-600">Loading…</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[var(--border)]">
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Time</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Resource</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)] hover:bg-slate-50/50">
                    <td className="p-3 text-sm text-slate-600">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-3 font-mono text-sm">{l.user_id || l.api_key_id || "—"}</td>
                    <td className="p-3">{l.action}</td>
                    <td className="p-3">{l.resource_type && l.resource_id ? `${l.resource_type}:${l.resource_id}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && logs.length === 0 && <p className="p-6 text-slate-500 text-center">No audit logs yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
