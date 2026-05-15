"use client";

import { memo, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PipelineNodeData } from "./graph";
import { useDeploymentFlow, type CanvasField } from "./FlowContext";

function stopFlowCapture(e: React.SyntheticEvent) {
  e.stopPropagation();
}

const controlWrapClass = "nodrag nopan space-y-2 mt-2";

const selectBase =
  "nodrag nopan text-xs rounded-[var(--radius)] border border-slate-200 bg-white px-2 py-1.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

const selectFullClass = `${selectBase} w-full`;

const selectRowClass = `${selectBase} min-w-0 flex-1`;

const addLinkClass =
  "nodrag nopan inline-flex shrink-0 items-center rounded-[var(--radius)] border border-brand-200 bg-brand-50 px-2 py-1.5 text-[10px] font-semibold text-brand-800 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-200 dark:hover:bg-brand-900/50";

function fieldForKind(kind: PipelineNodeData["kind"]): CanvasField | null {
  switch (kind) {
    case "deployment":
      return "name";
    case "knowledge_base":
      return "kb";
    case "intent_mapper":
      return "intent";
    case "prompt":
      return "prompt";
    case "model":
      return "model";
    default:
      return null;
  }
}

function SelectWithAdd({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex gap-2 items-center mt-1">
        {children}
        <Link href={href} className={addLinkClass} title={`Create new ${label}`} onPointerDown={stopFlowCapture} onClick={stopFlowCapture}>
          Add
        </Link>
      </div>
    </div>
  );
}

function PipelineNodeInner(props: NodeProps) {
  const data = props.data as PipelineNodeData;
  const ctx = useDeploymentFlow();
  const base = ctx.projectBase;

  const mappersForKb = useMemo(
    () => ctx.ims.filter((m) => m.knowledge_base_id === ctx.kbId),
    [ctx.ims, ctx.kbId],
  );

  const onBlockClick = () => {
    const f = fieldForKind(data.kind);
    if (f) ctx.focusField(f);
  };

  const isDeployment = data.kind === "deployment";
  const title = isDeployment ? "Deployment" : data.displayLabel;

  return (
    <div
      className="rounded-[var(--radius-lg)] border-2 border-slate-200 bg-white shadow-md px-4 py-3.5 text-left hover:border-brand-400 hover:shadow-lg transition-all dark:border-slate-600 dark:bg-slate-950"
      onClick={(e) => {
        if (data.kind === "deployment") return;
        if ((e.target as HTMLElement).closest?.(".nodrag")) return;
        e.stopPropagation();
        onBlockClick();
      }}
      role="group"
      aria-label={title}
    >
      {data.kind !== "deployment" && (
        <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      )}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{title}</p>
      {isDeployment ? (
        <div className="mt-1.5">
          <input
            className="nodrag nopan w-full text-sm font-semibold text-slate-900 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={ctx.deploymentName}
            onChange={(e) => ctx.setDeploymentName(e.target.value)}
            onClick={stopFlowCapture}
            onPointerDown={stopFlowCapture}
            placeholder="Deployment name"
          />
        </div>
      ) : data.kind === "knowledge_base" ? (
        <div className={controlWrapClass} onPointerDown={stopFlowCapture} onClick={stopFlowCapture}>
          <label className="text-[10px] text-slate-500 block font-medium">Knowledge base</label>
          <SelectWithAdd href={`${base}/knowledge`} label="knowledge base">
            <select className={selectRowClass} value={ctx.kbId} onChange={(e) => ctx.setKbId(e.target.value)}>
              <option value="">— Select —</option>
              {ctx.kbs.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </SelectWithAdd>
          {ctx.retrieval === "kb_mapper" && (
            <p className="text-[10px] text-slate-500 leading-snug pt-1">
              Pick the KB first, then choose a mapper for that KB in the next block.
            </p>
          )}
        </div>
      ) : data.kind === "intent_mapper" ? (
        <div className={controlWrapClass} onPointerDown={stopFlowCapture} onClick={stopFlowCapture}>
          <label className="text-[10px] text-slate-500 block font-medium">Intent mapper</label>
          {!ctx.kbId ? (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-[var(--radius)] px-2 py-2">
              Select a knowledge base in the previous block first.
            </p>
          ) : (
            <SelectWithAdd href={`${base}/intent-mapper`} label="intent mapper">
              <select className={selectRowClass} value={ctx.imId} onChange={(e) => ctx.setImId(e.target.value)}>
                <option value="">— Select —</option>
                {mappersForKb.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </SelectWithAdd>
          )}
        </div>
      ) : data.kind === "prompt" ? (
        <div className={controlWrapClass} onPointerDown={stopFlowCapture} onClick={stopFlowCapture}>
          <label className="text-[10px] text-slate-500 block font-medium">Template</label>
          <SelectWithAdd href={`${base}/prompts`} label="prompt">
            <select className={selectRowClass} value={ctx.promptId} onChange={(e) => ctx.setPromptId(e.target.value)}>
              <option value="">Default (no template)</option>
              {ctx.prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </SelectWithAdd>
        </div>
      ) : data.kind === "model" ? (
        <div className={controlWrapClass} onPointerDown={stopFlowCapture} onClick={stopFlowCapture}>
          <label className="text-[10px] text-slate-500 block font-medium">Model</label>
          <SelectWithAdd href={`${base}/models`} label="model">
            <select
              className={selectRowClass}
              value={ctx.modelId}
              onChange={(e) => ctx.setModelId(e.target.value)}
              disabled={!ctx.models.length}
            >
              <option value="">{ctx.models.length ? "— Select —" : "No models yet"}</option>
              {ctx.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </SelectWithAdd>
        </div>
      ) : (
        <p className="mt-0.5 text-xs text-slate-700 line-clamp-3 break-words">{data.detail || "—"}</p>
      )}
      <p className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed dark:border-slate-800">
        {isDeployment ? "Name only — pipeline lives in the blocks below" : "Edit here or in the side panel"}
      </p>
      {data.kind !== "model" && (
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
      )}
    </div>
  );
}

export const PipelineNode = memo(PipelineNodeInner);

export const pipelineNodeTypes = { pipeline: PipelineNode };
