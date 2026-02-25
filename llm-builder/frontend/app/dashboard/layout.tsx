"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { authApi, clearTokens, loadTokensFromStorage } from "@/lib/api";
import type { UserResponse } from "@/lib/api";
import { TopBarProvider, useTopBarState, getTitleFromPathname } from "./TopBarContext";
import { SettingsMenu } from "./SettingsMenu";

const navGroups = [
  {
    label: "Workflow",
    items: [
      { href: "/dashboard", label: "Home" },
      { href: "/dashboard/knowledge", label: "Knowledge" },
      { href: "/dashboard/models", label: "Models" },
      { href: "/dashboard/deployments", label: "Deployments" },
      { href: "/dashboard/chat", label: "Chat" },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/dashboard/prompts", label: "Prompts" },
      { href: "/dashboard/rag-configs", label: "Chunking & Embedding" },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokensFromStorage();
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        clearTokens();
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearTokens();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <TopBarProvider>
      <div className="min-h-screen flex bg-[var(--background)]">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
          <div className="h-14 flex items-center px-4 border-b border-[var(--border)]">
            <Link href="/dashboard" className="font-semibold text-slate-800 text-lg tracking-tight">
              LLM Builder
            </Link>
          </div>
          <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map(({ href, label }) => {
                    const isActive = pathname === href;
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={
                            "block px-3 py-2 rounded-[var(--radius)] text-sm font-medium transition-colors " +
                            (isActive
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-800")
                          }
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-[var(--border)]">
            <div className="px-3 py-2 text-xs text-slate-500 truncate" title={user.email}>
              {user.email}
            </div>
            <div className="px-3 py-1 text-xs text-slate-400">{user.role}</div>
          </div>
        </aside>

        {/* Main: top bar + content */}
        <main className="flex-1 min-w-0 flex flex-col">
          <DashboardTopBar pathname={pathname} user={user} onLogout={logout} />
          <div className="flex-1 w-full px-6 py-6 overflow-auto">{children}</div>
        </main>
      </div>
    </TopBarProvider>
  );
}

function DashboardTopBar({
  pathname,
  user,
  onLogout,
}: {
  pathname: string;
  user: UserResponse | null;
  onLogout: () => void;
}) {
  const { title, action } = useTopBarState();
  const displayTitle = title ?? getTitleFromPathname(pathname);
  return (
    <header className="flex-shrink-0 h-14 px-6 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--card)]">
      <h1 className="text-xl font-semibold text-slate-800 truncate">{displayTitle}</h1>
      <div className="flex items-center gap-2 flex-shrink-0">
        {action != null && <div>{action}</div>}
        {pathname === "/dashboard" && <SettingsMenu user={user} onLogout={onLogout} />}
      </div>
    </header>
  );
}
