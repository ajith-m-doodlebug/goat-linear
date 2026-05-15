"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy `/dashboard` → workspace projects list. */
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/projects");
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      <p className="text-sm text-slate-500 mt-4">Redirecting…</p>
    </div>
  );
}
