"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type TopBarState = {
  title: string | null;
  action: ReactNode;
};

const defaultState: TopBarState = { title: null, action: null };

const TopBarContext = createContext<{
  title: string | null;
  action: ReactNode;
  setTopBar: (title: string | null, action: ReactNode) => void;
}>({
  ...defaultState,
  setTopBar: () => {},
});

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TopBarState>(defaultState);
  const setTopBar = useCallback((title: string | null, action: ReactNode) => {
    setState({ title, action });
  }, []);
  return (
    <TopBarContext.Provider value={{ ...state, setTopBar }}>
      {children}
    </TopBarContext.Provider>
  );
}

export function useTopBar(title: string | null, action?: ReactNode, actionDep?: unknown) {
  const { setTopBar } = useContext(TopBarContext);
  useEffect(() => {
    setTopBar(title, action ?? null);
    return () => setTopBar(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- action is intentionally omitted (new ref every render)
  }, [title, setTopBar, actionDep]);
}

export function useTopBarState() {
  return useContext(TopBarContext);
}

const pathnameToTitle: Record<string, string> = {
  "/dashboard": "Home",
  "/dashboard/projects": "Projects",
  "/dashboard/host-models": "Host Models",
  "/dashboard/users": "Users",
};

const projectSegmentTitle: Record<string, string> = {
  "": "Home",
  knowledge: "Knowledge",
  "intent-mapper": "Intent Mapper",
  models: "Models",
  deployments: "Deployments",
  chat: "Chat",
  prompts: "Prompts",
  "rag-configs": "Chunking & Embedding",
  help: "Help & features",
  users: "Users",
  "host-models": "Host Models",
};

export function getTitleFromPathname(pathname: string): string {
  if (pathnameToTitle[pathname]) return pathnameToTitle[pathname]!;
  if (pathname.includes("/deployments/new/canvas")) return "New deployment";
  const m = pathname.match(/^\/dashboard\/projects\/([^/]+)(?:\/([\w-]+))?/);
  if (m) {
    const seg = m[2] ?? "";
    if (pathname.includes("/canvas")) return "Deployment canvas";
    return projectSegmentTitle[seg] ?? "Project";
  }
  return "Dashboard";
}
