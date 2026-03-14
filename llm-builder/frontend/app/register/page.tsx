"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, setTokens } from "@/lib/api";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.requestOtp(email);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.registerWithOtp(email, otp, password, fullName || undefined);
      setTokens(res.access_token, res.refresh_token);
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
          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <h1 className="text-xl font-bold text-slate-800">Sign up</h1>
              <p className="text-sm text-slate-600">
                Enter your work email. We&apos;ll send you a verification code. Only addresses at your company domain can register.
              </p>
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
                  placeholder="you@company.com"
                />
              </div>
              <Button type="submit" variant="primary" disabled={loading} className="w-full">
                {loading ? "Sending code…" : "Send verification code"}
              </Button>
              <p className="text-sm text-slate-600 text-center">
                Already have an account? <Link href="/login" className="text-brand-600 font-medium hover:underline">Log in</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h1 className="text-xl font-bold text-slate-800">Create account</h1>
              <p className="text-sm text-slate-600">
                Check your email for the code, then set your password.
              </p>
              {error && (
                <div className="p-3 rounded-[var(--radius)] bg-red-50 text-red-700 text-sm">{error}</div>
              )}
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} readOnly className="input bg-slate-50" />
              </div>
              <div>
                <label className="label">Verification code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="input"
                  placeholder="123456"
                  maxLength={6}
                  autoComplete="one-time-code"
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
              <div>
                <label className="label">Full name (optional)</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                />
              </div>
              <Button type="submit" variant="primary" disabled={loading} className="w-full">
                {loading ? "Creating account…" : "Create account"}
              </Button>
              <p className="text-sm text-slate-600 text-center">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(""); setOtp(""); }}
                  className="text-brand-600 font-medium hover:underline"
                >
                  Use a different email
                </button>
              </p>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
