import { MarkerType, type Edge, type Node } from "@xyflow/react";

export type PipelineKind = "deployment" | "knowledge_base" | "intent_mapper" | "prompt" | "model";

export type PipelineNodeData = {
  kind: PipelineKind;
  displayLabel: string;
  /** Secondary line (e.g. selected resource name) */
  detail?: string;
};

const NODE_TYPE = "pipeline" as const;

const LANE_X = 200;

const STACK_GAP = 64;
const TOP_INSET = 24;
const H_DEP = 136;
const H_KB = 176;
const H_IM = 176;
const H_PROMPT = 176;
const H_MODEL = 176;

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, markerEnd: { type: MarkerType.ArrowClosed } };
}

function pipelineNode(
  id: string,
  y: number,
  kind: PipelineKind,
  displayLabel: string,
  detail?: string,
): Node {
  return {
    id,
    type: NODE_TYPE,
    position: { x: LANE_X, y },
    data: { kind, displayLabel, detail } satisfies PipelineNodeData,
    style: { width: 300 },
  };
}

export type RetrievalMode = "none" | "kb" | "kb_mapper";

export function buildPipelineGraph(params: {
  deploymentName: string;
  retrieval: RetrievalMode;
  kbLabel: string;
  imLabel: string;
  modelLabel: string;
  promptLabel: string;
}): { nodes: Node[]; edges: Edge[] } {
  const { deploymentName, retrieval, kbLabel, imLabel, modelLabel, promptLabel } = params;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let y = TOP_INSET;
  const yDep = y;
  y += H_DEP + STACK_GAP;

  nodes.push(pipelineNode("dep", yDep, "deployment", "Deployment", deploymentName || "Untitled"));

  let lastId = "dep";

  if (retrieval === "kb" || retrieval === "kb_mapper") {
    const yKb = y;
    y += H_KB + STACK_GAP;
    nodes.push(
      pipelineNode("kb", yKb, "knowledge_base", "Knowledge base", kbLabel || "— none selected —"),
    );
    edges.push(edge("e-dep-kb", "dep", "kb"));
    lastId = "kb";

    if (retrieval === "kb_mapper") {
      const yIm = y;
      y += H_IM + STACK_GAP;
      nodes.push(
        pipelineNode("im", yIm, "intent_mapper", "Mapper", imLabel || "— none selected —"),
      );
      edges.push(edge("e-kb-im", "kb", "im"));
      lastId = "im";
    }
  }

  const yPrompt = y;
  y += H_PROMPT + STACK_GAP;
  nodes.push(
    pipelineNode("prompt", yPrompt, "prompt", "Prompt", promptLabel || "Optional — pick in panel"),
  );
  edges.push(edge("e-up-prompt", lastId, "prompt"));

  const yModel = y;
  nodes.push(pipelineNode("model", yModel, "model", "Model", modelLabel || "Select in panel →"));
  edges.push(edge("e-prompt-model", "prompt", "model"));

  return { nodes, edges };
}

/** Merge saved positions; legacy single `src` node maps to the first of `kb` / `im` that lacks a saved position. */
export function mergeNodePositions(prev: Node[], next: Node[]): Node[] {
  const pos = new Map(prev.map((n) => [n.id, n.position]));
  const legacySrc = pos.get("src");
  let usedLegacySrc = false;
  return next.map((n) => {
    let p = pos.get(n.id);
    if (!p && legacySrc && !usedLegacySrc && (n.id === "kb" || n.id === "im")) {
      p = legacySrc;
      usedLegacySrc = true;
    }
    return p ? { ...n, position: p } : n;
  });
}

/** Strip for JSON persistence (no functions). */
export function serializeCanvasState(nodes: Node[], edges: Edge[]) {
  const slimNodes = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? "pipeline",
    position: n.position,
    data: {
      kind: (n.data as PipelineNodeData).kind,
      displayLabel: (n.data as PipelineNodeData).displayLabel,
      detail: (n.data as PipelineNodeData).detail,
    },
    style: n.style,
  }));
  return { nodes: slimNodes, edges };
}

export function normalizeLoadedNodes(raw: Node[] | undefined): Node[] | null {
  if (!raw?.length) return null;
  return raw.map((n) => ({
    ...n,
    type: n.type === "pipeline" || n.type === undefined ? "pipeline" : n.type,
    data:
      typeof n.data === "object" && n.data && "kind" in n.data
        ? migrateLegacyPipelineKind(n.data as PipelineNodeData, n.id)
        : {
            kind: inferKindFromLegacyId(n.id),
            displayLabel: String((n.data as { label?: string })?.label ?? n.id),
          },
  }));
}

function migrateLegacyPipelineKind(data: PipelineNodeData, _nodeId: string): PipelineNodeData {
  if ((data as { kind: string }).kind !== "retrieval") return data;
  const label = (data.displayLabel || "").toLowerCase();
  if (label.includes("intent") || label.includes("mapper")) {
    return { ...data, kind: "intent_mapper", displayLabel: "Mapper" };
  }
  return { ...data, kind: "knowledge_base", displayLabel: "Knowledge base" };
}

function inferKindFromLegacyId(id: string): PipelineKind {
  if (id === "dep") return "deployment";
  if (id === "kb") return "knowledge_base";
  if (id === "im") return "intent_mapper";
  if (id === "src") return "knowledge_base";
  if (id === "prompt") return "prompt";
  if (id === "model") return "model";
  return "deployment";
}
