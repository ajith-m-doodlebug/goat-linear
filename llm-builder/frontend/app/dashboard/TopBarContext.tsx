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

/**
 * Call from a page to set the top bar title and primary action. Clears on unmount.
 * Do not put `action` in deps (it's a new React node every render). Pass a single
 * dependency when the action depends on state (e.g. showForm) so we re-sync when it changes.
 * Array length must stay fixed, so we use one optional dep, not a spread.
 */
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
  "/dashboard/knowledge": "Knowledge",
  "/dashboard/models": "Models",
  "/dashboard/deployments": "Deployments",
  "/dashboard/chat": "Chat",
  "/dashboard/prompts": "Prompts",
  "/dashboard/rag-configs": "Chunking & Embedding",
};

export function getTitleFromPathname(pathname: string): string {
  return pathnameToTitle[pathname] ?? "Dashboard";
}
