"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, setTokens } from "@/lib/api";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register(email, password, fullName || undefined);
      const token = await authApi.login(email, password);
      setTokens(token.access_token, token.refresh_token);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <Card className="w-full max-w-sm">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">Sign up</h1>
            {error && (
              <div className="p-3 rounded-[var(--radius)] bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">Full name (optional)</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
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
              {loading ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-sm text-slate-600 text-center">
              Already have an account? <Link href="/login" className="text-brand-600 font-medium hover:underline">Log in</Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
