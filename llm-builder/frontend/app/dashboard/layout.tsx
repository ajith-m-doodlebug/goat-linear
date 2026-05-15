"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { authApi, clearTokens, loadTokensFromStorage } from "@/lib/api";
import type { UserResponse } from "@/lib/api";
import { TopBarProvider, useTopBarState, getTitleFromPathname } from "./TopBarContext";
import { SettingsMenu } from "./SettingsMenu";
import {
  HomeIcon,
  BookIcon,
  CpuIcon,
  ComputerDesktopIcon,
  RocketIcon,
  ChatBubbleIcon,
  DocumentTextIcon,
  LayersIcon,
  UsersIcon,
  MenuIcon,
  XIcon,
} from "@/app/components/ui";

const MOBILE_NAV_ID = "dashboard-mobile-nav";

export function projectBaseFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  return m ? `/dashboard/projects/${m[1]}` : null;
}

function navItemActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const adminNavGroupSuper = {
  label: "Admin",
  items: [
    { path: "users" as const, label: "Users", Icon: UsersIcon },
    { path: "host-models" as const, label: "Host Models", Icon: ComputerDesktopIcon },
  ],
};

function adminHref(projectBase: string | null, path: "users" | "host-models") {
  return projectBase ? `${projectBase}/${path}` : `/dashboard/${path}`;
}

function navLinkClass(isActive: boolean) {
  return (
    "flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-sm font-medium transition-colors " +
    (isActive
      ? "bg-brand-50 text-brand-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-800")
  );
}

function DashboardNavLinks({
  pathname,
  user,
  onLinkClick,
}: {
  pathname: string;
  user: UserResponse;
  onLinkClick?: () => void;
}) {
  const projectBase = projectBaseFromPath(pathname);

  const workspaceLinks = projectBase
    ? [
        { href: projectBase, label: "Home", Icon: HomeIcon, exact: true },
        { href: `${projectBase}/knowledge`, label: "Knowledge", Icon: BookIcon, exact: false },
        { href: `${projectBase}/intent-mapper`, label: "Intent Mapper", Icon: LayersIcon, exact: false },
        { href: `${projectBase}/models`, label: "Models", Icon: CpuIcon, exact: false },
        { href: `${projectBase}/deployments`, label: "Deployments", Icon: RocketIcon, exact: false },
        { href: `${projectBase}/chat`, label: "Chat", Icon: ChatBubbleIcon, exact: false },
      ]
    : [];

  const moreLinks = projectBase
    ? [
        { href: `${projectBase}/prompts`, label: "Prompts", Icon: DocumentTextIcon, exact: false },
        { href: `${projectBase}/rag-configs`, label: "Chunking & Embedding", Icon: LayersIcon, exact: false },
      ]
    : [];

  return (
    <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
      <div>
        <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Workspace</p>
        <ul className="space-y-0.5">
          <li key="/dashboard/projects">
            <Link
              href="/dashboard/projects"
              onClick={onLinkClick}
              className={navLinkClass(navItemActive(pathname, "/dashboard/projects", true))}
            >
              <LayersIcon className="w-5 h-5 flex-shrink-0" />
              Projects
            </Link>
          </li>
        </ul>
      </div>

      {projectBase && (
        <>
          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Workflow</p>
            <ul className="space-y-0.5">
              {workspaceLinks.map(({ href, label, Icon, exact }) => (
                <li key={href}>
                  <Link href={href} onClick={onLinkClick} className={navLinkClass(navItemActive(pathname, href, exact))}>
                    {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">More</p>
            <ul className="space-y-0.5">
              {moreLinks.map(({ href, label, Icon, exact }) => (
                <li key={href}>
                  <Link href={href} onClick={onLinkClick} className={navLinkClass(navItemActive(pathname, href, exact))}>
                    {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {user.role === "super_admin" && (
        <div>
          <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {adminNavGroupSuper.label}
          </p>
          <ul className="space-y-0.5">
            {adminNavGroupSuper.items.map(({ path, label, Icon }) => {
              const href = adminHref(projectBase, path);
              const isActive = navItemActive(pathname, href, false);
              return (
                <li key={path}>
                  <Link href={href} onClick={onLinkClick} className={navLinkClass(isActive)}>
                    {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}

function DashboardNavFooter({ user }: { user: UserResponse }) {
  return (
    <div className="p-3 border-t border-[var(--border)] shrink-0">
      <div className="px-3 py-2 text-xs text-slate-500 truncate" title={user.email}>
        {user.email}
      </div>
      <div className="px-3 py-1 text-xs text-slate-400">{user.role}</div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

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

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <TopBarProvider>
      <div className="min-h-screen min-h-[100dvh] flex bg-[var(--background)]">
        <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
          <div className="h-14 flex items-center px-4 border-b border-[var(--border)] shrink-0">
            <Link href="/dashboard/projects" className="font-semibold text-slate-800 text-lg tracking-tight">
              RAGLine
            </Link>
          </div>
          <DashboardNavLinks pathname={pathname} user={user} />
          <DashboardNavFooter user={user} />
        </aside>

        <div
          className={
            "fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden " +
            (mobileNavOpen ? "opacity-100" : "opacity-0 pointer-events-none")
          }
          aria-hidden={!mobileNavOpen}
          onClick={closeMobileNav}
        />

        <aside
          id={MOBILE_NAV_ID}
          className={
            "fixed inset-y-0 left-0 z-40 w-56 flex flex-col border-r border-[var(--border)] bg-[var(--card)] " +
            "transform transition-transform duration-200 ease-out md:hidden shadow-lg " +
            (mobileNavOpen ? "translate-x-0" : "-translate-x-full")
          }
          aria-hidden={!mobileNavOpen}
        >
          <div className="h-14 flex items-center justify-between gap-2 px-4 border-b border-[var(--border)] shrink-0">
            <Link
              href="/dashboard/projects"
              className="font-semibold text-slate-800 text-lg tracking-tight min-w-0 truncate"
              onClick={closeMobileNav}
            >
              RAGLine
            </Link>
            <button
              type="button"
              className="p-2 rounded-[var(--radius)] text-slate-500 hover:bg-slate-100 hover:text-slate-700 shrink-0"
              onClick={closeMobileNav}
              aria-label="Close menu"
            >
              <XIcon />
            </button>
          </div>
          <DashboardNavLinks pathname={pathname} user={user} onLinkClick={closeMobileNav} />
          <DashboardNavFooter user={user} />
        </aside>

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          <DashboardTopBar
            pathname={pathname}
            user={user}
            onLogout={logout}
            mobileNavOpen={mobileNavOpen}
            onMobileNavOpen={() => setMobileNavOpen(true)}
            onMobileNavClose={closeMobileNav}
          />
          <div className="flex flex-col flex-1 min-h-0 w-full px-4 py-4 md:px-6 md:py-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </TopBarProvider>
  );
}

function DashboardTopBar({
  pathname,
  user,
  onLogout,
  mobileNavOpen,
  onMobileNavOpen,
  onMobileNavClose,
}: {
  pathname: string;
  user: UserResponse | null;
  onLogout: () => void;
  mobileNavOpen: boolean;
  onMobileNavOpen: () => void;
  onMobileNavClose: () => void;
}) {
  const { title, action } = useTopBarState();
  const displayTitle = title ?? getTitleFromPathname(pathname);
  return (
    <header className="flex-shrink-0 h-14 px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4 border-b border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          className="md:hidden p-2 -ml-1 rounded-[var(--radius)] text-slate-600 hover:bg-slate-100 hover:text-slate-800 shrink-0"
          onClick={() => (mobileNavOpen ? onMobileNavClose() : onMobileNavOpen())}
          aria-expanded={mobileNavOpen}
          aria-controls={MOBILE_NAV_ID}
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileNavOpen ? <XIcon /> : <MenuIcon />}
        </button>
        <h1 className="text-lg md:text-xl font-semibold text-slate-800 truncate">{displayTitle}</h1>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {action != null && <div>{action}</div>}
        <SettingsMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
