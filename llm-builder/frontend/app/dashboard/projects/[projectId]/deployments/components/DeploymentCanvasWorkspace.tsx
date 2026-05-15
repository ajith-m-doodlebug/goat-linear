"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { apiRequest } from "@/lib/api";
import { projectApi } from "@/lib/projectApi";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { Button } from "@/app/components/ui/Button";
import {
  buildPipelineGraph,
  mergeNodePositions,
  normalizeLoadedNodes,
  serializeCanvasState,
  type RetrievalMode,
} from "./deploymentCanvas/graph";
import { DeploymentFlowProvider, type CanvasField, type IntentMapperOption } from "./deploymentCanvas/FlowContext";
import { pipelineNodeTypes } from "./deploymentCanvas/PipelineNode";

type Deployment = {
  id: string;
  name: string;
  model_id: string;
  knowledge_base_id: string | null;
  intent_mapper_id: string | null;
  prompt_template_id: string | null;
  canvas_state?: { nodes?: Node[]; edges?: Edge[] } | null;
};

type Opt = { id: string; name: string };

async function fetchModelsForPicker(projectId: string): Promise<Opt[]> {
  if (!projectId) return [];
  const raw = await apiRequest<Array<{ id: string; name: string }>>(projectApi(projectId, "models"));
  return raw.map((m) => ({ id: m.id, name: m.name }));
}

function pipelineBody(
  name: string,
  modelId: string,
  retrieval: RetrievalMode,
  kbId: string,
  imId: string,
  promptTemplateId: string,
) {
  const kbOut = retrieval === "none" ? null : kbId || null;
  const imOut = retrieval === "kb_mapper" ? imId || null : null;
  return {
    name: name.trim(),
    model_id: modelId,
    knowledge_base_id: kbOut,
    intent_mapper_id: imOut,
    prompt_template_id: promptTemplateId || null,
  };
}

function optLabel(list: Opt[], id: string, fallback: string) {
  if (!id) return fallback;
  return list.find((x) => x.id === id)?.name ?? fallback;
}

type Props = {
  projectId: string;
  deploymentId: string | null;
};

function CanvasFlow({
  projectBase,
  deploymentName,
  setDeploymentName,
  retrieval,
  setRetrieval,
  kbId,
  setKbId,
  imId,
  setImId,
  modelId,
  setModelId,
  promptId,
  setPromptId,
  models,
  kbs,
  ims,
  prompts,
  nodes,
  setNodes,
  onNodesChange,
  edges,
  setEdges,
  onEdgesChange,
  asideRef,
}: {
  projectBase: string;
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
  models: Opt[];
  kbs: Opt[];
  ims: IntentMapperOption[];
  prompts: Opt[];
  nodes: Node[];
  setNodes: ReturnType<typeof useNodesState<Node>>[1];
  onNodesChange: ReturnType<typeof useNodesState<Node>>[2];
  edges: Edge[];
  setEdges: ReturnType<typeof useEdgesState>[1];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  asideRef: React.RefObject<HTMLDivElement | null>;
}) {
  const focusField = useCallback(
    (field: CanvasField) => {
      const root = asideRef.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(`[data-canvas-field="${field}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const focusable = el?.querySelector<HTMLElement>("select, input, textarea");
      (focusable ?? el)?.focus();
    },
    [asideRef],
  );

  const flowValue = useMemo(
    () => ({
      projectBase,
      deploymentName,
      setDeploymentName,
      retrieval,
      setRetrieval,
      kbId,
      setKbId,
      imId,
      setImId,
      modelId,
      setModelId,
      promptId,
      setPromptId,
      models,
      kbs,
      ims,
      prompts,
      focusField,
      asideScrollRef: asideRef,
    }),
    [
      projectBase,
      deploymentName,
      setDeploymentName,
      retrieval,
      setRetrieval,
      kbId,
      setKbId,
      imId,
      setImId,
      modelId,
      setModelId,
      promptId,
      setPromptId,
      models,
      kbs,
      ims,
      prompts,
      focusField,
      asideRef,
    ],
  );

  const nodeTypes = useMemo(() => pipelineNodeTypes, []);

  return (
    <DeploymentFlowProvider value={flowValue}>
      <div className={`min-h-[480px] lg:min-h-[min(70vh,720px)] w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/20 overflow-hidden flex flex-col`}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            snapToGrid
            snapGrid={[16, 16]}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnScroll
            zoomOnScroll
            deleteKeyCode={null}
            className="flex-1 min-h-[480px]"
          >
            <MiniMap zoomable pannable />
            <Controls />
            <Background gap={16} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </DeploymentFlowProvider>
  );
}

export function DeploymentCanvasWorkspace({ projectId, deploymentId }: Props) {
  const router = useRouter();
  const isDraft = deploymentId === null;

  const [dep, setDep] = useState<Deployment | null>(null);
  const [deploymentName, setDeploymentName] = useState("Untitled deployment");
  const [models, setModels] = useState<Opt[]>([]);
  const [kbs, setKbs] = useState<Opt[]>([]);
  const [ims, setIms] = useState<IntentMapperOption[]>([]);
  const [prompts, setPrompts] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);

  const [modelId, setModelId] = useState("");
  const [kbId, setKbId] = useState("");
  const [imId, setImId] = useState("");
  const [promptId, setPromptId] = useState("");
  const [retrieval, setRetrieval] = useState<RetrievalMode>("none");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [testQ, setTestQ] = useState("");
  const [testOut, setTestOut] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asideRef = useRef<HTMLDivElement>(null);
  const canvasSnapshotRef = useRef<Node[] | null>(null);

  useTopBar(isDraft ? "New deployment" : dep?.name ? `Canvas · ${dep.name}` : "Deployment canvas", null, `${isDraft ? "draft" : dep?.id}-${projectId}`);

  const loadAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    canvasSnapshotRef.current = null;
    try {
      const [mods, kbList, imListRaw, prList] = await Promise.all([
        fetchModelsForPicker(projectId),
        apiRequest<Opt[]>(projectApi(projectId, "knowledge-bases")),
        apiRequest<IntentMapperOption[]>(projectApi(projectId, "intent-mappers")),
        apiRequest<Opt[]>(projectApi(projectId, "deployments/prompt-templates")),
      ]);
      setModels(mods);
      setKbs(kbList.map((x) => ({ id: x.id, name: x.name })));
      setIms(imListRaw);
      setPrompts(prList.map((x) => ({ id: x.id, name: x.name })));

      if (isDraft) {
        setDeploymentName("Untitled deployment");
        setRetrieval("none");
        setKbId("");
        setImId("");
        setPromptId("");
        setModelId(mods[0]?.id ?? "");
        setDep(null);
        canvasSnapshotRef.current = null;
      } else if (deploymentId) {
        const d2 = await apiRequest<Deployment>(projectApi(projectId, `deployments/${deploymentId}`));
        setDep(d2);
        setDeploymentName(d2.name);
        setModelId(d2.model_id);
        setPromptId(d2.prompt_template_id ?? "");
        if (d2.intent_mapper_id) {
          const imRow = imListRaw.find((x) => x.id === d2.intent_mapper_id);
          setKbId((d2.knowledge_base_id || imRow?.knowledge_base_id) ?? "");
          setImId(d2.intent_mapper_id);
          setRetrieval("kb_mapper");
        } else if (d2.knowledge_base_id) {
          setKbId(d2.knowledge_base_id);
          setImId("");
          setRetrieval("kb");
        } else {
          setKbId("");
          setImId("");
          setRetrieval("none");
        }
        const cs = d2.canvas_state;
        if (cs?.nodes?.length) {
          canvasSnapshotRef.current = normalizeLoadedNodes(cs.nodes as Node[]);
        }
      }
    } catch (e) {
      console.error(e);
      setError("Could not load canvas data.");
    } finally {
      setLoading(false);
    }
  }, [projectId, deploymentId, isDraft]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (retrieval !== "kb_mapper" || !imId) return;
    const im = ims.find((i) => i.id === imId);
    if (im && kbId && im.knowledge_base_id !== kbId) setImId("");
  }, [retrieval, kbId, imId, ims]);

  const graphParams = useMemo(
    () => ({
      deploymentName,
      retrieval,
      kbLabel: optLabel(kbs, kbId, "— none selected —"),
      imLabel: optLabel(ims, imId, "— none selected —"),
      modelLabel: optLabel(models, modelId, "— none selected —"),
      promptLabel: promptId ? optLabel(prompts, promptId, "Template") : "Default (no template)",
    }),
    [deploymentName, retrieval, kbId, imId, modelId, promptId, kbs, ims, models, prompts],
  );

  useLayoutEffect(() => {
    if (loading) return;
    const built = buildPipelineGraph(graphParams);
    setNodes((prev) => {
      const snap = canvasSnapshotRef.current;
      if (snap) {
        const merged = mergeNodePositions(snap, built.nodes);
        canvasSnapshotRef.current = null;
        return merged;
      }
      return mergeNodePositions(prev, built.nodes);
    });
    setEdges(built.edges);
  }, [loading, graphParams, setNodes, setEdges]);

  const saveCanvas = async () => {
    if (!projectId || isDraft || !deploymentId) return;
    setSaving(true);
    try {
      const { nodes: sn, edges: se } = serializeCanvasState(nodes, edges);
      await apiRequest(projectApi(projectId, `deployments/${deploymentId}`), {
        method: "PATCH",
        body: JSON.stringify({ canvas_state: { nodes: sn, edges: se } }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const savePipeline = async () => {
    if (!projectId || isDraft || !deploymentId || !dep) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: deploymentName.trim() || dep.name,
        model_id: modelId,
        prompt_template_id: promptId || null,
      };
      if (retrieval === "none") {
        body.knowledge_base_id = null;
        body.intent_mapper_id = null;
      } else if (retrieval === "kb") {
        body.knowledge_base_id = kbId || null;
        body.intent_mapper_id = null;
      } else {
        body.knowledge_base_id = kbId || null;
        body.intent_mapper_id = imId || null;
      }
      await apiRequest(projectApi(projectId, `deployments/${deploymentId}`), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const createDeployment = async () => {
    if (!projectId || !isDraft) return;
    if (!deploymentName.trim()) {
      setError("Enter a deployment name.");
      return;
    }
    if (!modelId) {
      setError("Link at least one model in this project (Models page) before creating a deployment.");
      return;
    }
    if (retrieval === "kb" && !kbId) {
      setError("Pick a knowledge base or switch retrieval.");
      return;
    }
    if (retrieval === "kb_mapper") {
      if (!kbId || !imId) {
        setError("Pick a knowledge base, then a mapper for that KB.");
        return;
      }
      const im = ims.find((i) => i.id === imId);
      if (im && im.knowledge_base_id !== kbId) {
        setError("The mapper must belong to the selected knowledge base.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiRequest<Deployment>(projectApi(projectId, "deployments"), {
        method: "POST",
        body: JSON.stringify(pipelineBody(deploymentName, modelId, retrieval, kbId, imId, promptId)),
      });
      const { nodes: sn, edges: se } = serializeCanvasState(nodes, edges);
      await apiRequest(projectApi(projectId, `deployments/${created.id}`), {
        method: "PATCH",
        body: JSON.stringify({ canvas_state: { nodes: sn, edges: se } }),
      });
      router.replace(`/dashboard/projects/${projectId}/deployments/${created.id}/canvas`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (tpl: "kb_prompt_model" | "kb_intent_prompt_model" | "model_only") => {
    if (tpl === "kb_prompt_model") {
      setRetrieval("kb");
      setImId("");
    } else if (tpl === "kb_intent_prompt_model") {
      setRetrieval("kb_mapper");
      setKbId("");
      setImId("");
    } else {
      setRetrieval("none");
      setKbId("");
      setImId("");
    }
  };

  const runTest = async () => {
    if (!projectId || !deploymentId || !testQ.trim()) return;
    try {
      const res = await apiRequest<{ response: string }>(projectApi(projectId, `deployments/${deploymentId}/run`), {
        method: "POST",
        body: JSON.stringify({ question: testQ.trim() }),
      });
      setTestOut(res.response);
    } catch (e) {
      setTestOut(e instanceof Error ? e.message : "Request failed");
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/dashboard/projects/${projectId}/deployments`}>
        <Button variant="secondary">← Deployments</Button>
      </Link>
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="secondary" type="button" onClick={() => applyTemplate("model_only")}>
          Template: Model only
        </Button>
        <Button variant="secondary" type="button" onClick={() => applyTemplate("kb_prompt_model")}>
          KB → Prompt → Model
        </Button>
        <Button variant="secondary" type="button" onClick={() => applyTemplate("kb_intent_prompt_model")}>
          KB + Mapper → Prompt → Model
        </Button>
      </div>
      {!isDraft && (
        <Button variant="primary" type="button" onClick={saveCanvas} disabled={saving}>
          Save layout
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isDraft && !dep) {
    return (
      <div className="space-y-4 text-center py-16">
        <p className="text-slate-600">Deployment not found or you don’t have access.</p>
        <Link href={`/dashboard/projects/${projectId}/deployments`}>
          <Button variant="secondary">← Back to deployments</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 -mx-1">
      {toolbar}

      {error && (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,320px)_1fr] gap-4 items-stretch flex-1 min-h-0">
        <aside
          ref={asideRef}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 space-y-4 shadow-[var(--shadow)] lg:max-h-[calc(100dvh-10rem)] overflow-y-auto order-2 lg:order-1"
        >
          <div data-canvas-field="name">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Deployment</h2>
            <label className="label">Name</label>
            <input
              type="text"
              className="input mb-3"
              value={deploymentName}
              onChange={(e) => setDeploymentName(e.target.value)}
              placeholder="e.g. Support bot"
            />
          </div>

          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline</h2>
            <div data-canvas-field="retrieval">
              <label className="label">Retrieval</label>
              <select
                className="input"
                value={retrieval}
                onChange={(e) => {
                  const v = e.target.value as RetrievalMode;
                  setRetrieval(v);
                  if (v === "none") {
                    setKbId("");
                    setImId("");
                  } else if (v === "kb") {
                    setImId("");
                  }
                }}
              >
                <option value="none">None</option>
                <option value="kb">Knowledge base only</option>
                <option value="kb_mapper">Knowledge base + Mapper</option>
              </select>
            </div>

            {(retrieval === "kb" || retrieval === "kb_mapper") && (
              <div data-canvas-field="kb">
                <label className="label">Knowledge base</label>
                <select className="input" value={kbId} onChange={(e) => setKbId(e.target.value)}>
                  <option value="">—</option>
                  {kbs.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {retrieval === "kb_mapper" && (
              <div data-canvas-field="intent">
                <label className="label">Mapper</label>
                <select
                  className="input"
                  value={imId}
                  onChange={(e) => setImId(e.target.value)}
                  disabled={!kbId}
                >
                  <option value="">{kbId ? "—" : "Pick a knowledge base first"}</option>
                  {ims
                    .filter((m) => m.knowledge_base_id === kbId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div data-canvas-field="model">
              <label className="label">Model</label>
              <select className="input" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!models.length}>
                <option value="">{models.length ? "Select model" : "No models in project"}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div data-canvas-field="prompt">
              <label className="label">Prompt (optional)</label>
              <select className="input" value={promptId} onChange={(e) => setPromptId(e.target.value)}>
                <option value="">—</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4 space-y-2">
            {isDraft ? (
              <Button variant="primary" type="button" className="w-full" onClick={createDeployment} disabled={saving}>
                {saving ? "Creating…" : "Create deployment"}
              </Button>
            ) : (
              <Button variant="primary" type="button" className="w-full" onClick={savePipeline} disabled={saving}>
                {saving ? "Saving…" : "Save pipeline"}
              </Button>
            )}
            <p className="text-[11px] text-slate-500 leading-snug">
              Canvas: Deployment → Knowledge base (when used) → Mapper (KB + Mapper mode) → Prompt → Model. Use{" "}
              <span className="font-medium">Add</span> to open the project page to create resources. Drag nodes; save layout keeps positions.
            </p>
          </div>

          {!isDraft && (
            <div className="border-t border-[var(--border)] pt-4 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Test</h2>
              <textarea
                className="input resize-y min-h-[88px]"
                value={testQ}
                onChange={(e) => setTestQ(e.target.value)}
                placeholder="Try a question…"
              />
              <Button variant="secondary" type="button" className="w-full" onClick={runTest}>
                Run test
              </Button>
              {testOut != null && (
                <pre className="text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/50 p-2 rounded-[var(--radius)] border border-[var(--border)] max-h-40 overflow-auto">
                  {testOut}
                </pre>
              )}
            </div>
          )}
        </aside>

        <div className="order-1 lg:order-2">
          <CanvasFlow
            projectBase={`/dashboard/projects/${projectId}`}
            deploymentName={deploymentName}
            setDeploymentName={setDeploymentName}
            retrieval={retrieval}
            setRetrieval={setRetrieval}
            kbId={kbId}
            setKbId={setKbId}
            imId={imId}
            setImId={setImId}
            modelId={modelId}
            setModelId={setModelId}
            promptId={promptId}
            setPromptId={setPromptId}
            models={models}
            kbs={kbs}
            ims={ims}
            prompts={prompts}
            nodes={nodes}
            setNodes={setNodes}
            onNodesChange={onNodesChange}
            edges={edges}
            setEdges={setEdges}
            onEdgesChange={onEdgesChange}
            asideRef={asideRef}
          />
        </div>
      </div>
    </div>
  );
}
