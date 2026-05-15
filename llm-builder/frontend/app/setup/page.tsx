"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setupApi } from "@/lib/api";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [superAdminEmail, setSuperAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setupApi
      .getStatus()
      .then((data) => {
        if (data.setup_completed) {
          router.replace("/login");
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await setupApi.runSetup({
        super_admin_email: superAdminEmail,
        password,
      });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
        <p className="text-slate-600">Checking setup status…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <Card className="w-full max-w-md">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">Initial setup</h1>
            <p className="text-sm text-slate-600">
              Create the super admin account. After signing in, create a project from the dashboard when you are ready—nothing is seeded automatically.
            </p>
            {error && (
              <div className="p-3 rounded-[var(--radius)] bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={superAdminEmail}
                onChange={(e) => setSuperAdminEmail(e.target.value)}
                required
                className="input"
                placeholder="admin@company.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
              />
            </div>
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? "Setting up…" : "Complete setup"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
