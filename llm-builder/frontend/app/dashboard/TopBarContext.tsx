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
  "/dashboard/help": "Help & features",
  "/dashboard/knowledge": "Knowledge",
  "/dashboard/models": "Models",
  "/dashboard/host-models": "Host Models",
  "/dashboard/deployments": "Deployments",
  "/dashboard/chat": "Chat",
  "/dashboard/prompts": "Prompts",
  "/dashboard/rag-configs": "Chunking & Embedding",
  "/dashboard/users": "Users",
};

export function getTitleFromPathname(pathname: string): string {
  return pathnameToTitle[pathname] ?? "Dashboard";
}
