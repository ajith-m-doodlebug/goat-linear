"use client";

import { createContext, useContext, type RefObject } from "react";

export type CanvasField = "name" | "retrieval" | "kb" | "intent" | "prompt" | "model";

export type PipelineOption = { id: string; name: string };

export type IntentMapperOption = PipelineOption & { knowledge_base_id: string };

export type RetrievalMode = "none" | "kb" | "kb_mapper";

export type DeploymentFlowContextValue = {
  deploymentName: string;
  setDeploymentName: (v: string) => void;
  retrieval: RetrievalMode;
  setRetrieval: (v: RetrievalMode) => void;
  kbId: string;
  setKbId: (v: string) => void;
  imId: string;
  setImId: (v: string) => void;
  modelId: string;
  setModelId: (v: string) => void;
  promptId: string;
  setPromptId: (v: string) => void;
  models: PipelineOption[];
  kbs: PipelineOption[];
  /** Full mapper list (includes knowledge_base_id for filtering on canvas). */
  ims: IntentMapperOption[];
  prompts: PipelineOption[];
  /** e.g. `/dashboard/projects/{id}` for Add links */
  projectBase: string;
  focusField: (field: CanvasField) => void;
  asideScrollRef: RefObject<HTMLDivElement | null>;
};

const DeploymentFlowContext = createContext<DeploymentFlowContextValue | null>(null);

export function DeploymentFlowProvider({
  value,
  children,
}: {
  value: DeploymentFlowContextValue;
  children: React.ReactNode;
}) {
  return <DeploymentFlowContext.Provider value={value}>{children}</DeploymentFlowContext.Provider>;
}

export function useDeploymentFlow() {
  const v = useContext(DeploymentFlowContext);
  if (!v) throw new Error("useDeploymentFlow outside DeploymentFlowProvider");
  return v;
}
