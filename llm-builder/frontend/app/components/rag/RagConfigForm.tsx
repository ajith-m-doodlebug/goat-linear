"use client";

export type RagConfigFormValues = {
  chunk_strategy: string;
  chunk_size: number;
  chunk_overlap: number;
  embedding_model: string;
  embedding_query_prefix: string;
};

export const CHUNK_STRATEGIES = [
  { id: "fixed", label: "Fixed size (sentence-aware)" },
  { id: "paragraph", label: "By paragraph" },
  { id: "sentence", label: "By sentence" },
  { id: "recursive", label: "Recursive (section-aware)" },
] as const;

export const EMBEDDING_MODELS = [
  { id: "all-MiniLM-L6-v2", label: "MiniLM (fast)" },
  { id: "all-mpnet-base-v2", label: "MPNet (balanced)" },
  { id: "BAAI/bge-small-en-v1.5", label: "BGE Small" },
  { id: "BAAI/bge-base-en-v1.5", label: "BGE Base" },
  { id: "intfloat/e5-small-v2", label: "E5 Small" },
  { id: "intfloat/e5-base-v2", label: "E5 Base" },
] as const;

export function RagConfigForm({
  value,
  onChange,
  showPresetDropdown,
  presets,
  presetId,
  onPresetChange,
}: {
  value: RagConfigFormValues;
  onChange: (v: RagConfigFormValues) => void;
  showPresetDropdown?: boolean;
  presets?: { id: string; name: string; config: Record<string, unknown> }[];
  presetId?: string;
  onPresetChange?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {showPresetDropdown && presets && presets.length > 0 && (
        <div>
          <label className="label">Use preset</label>
          <select
            value={presetId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id && onPresetChange) {
                onPresetChange(id);
                const p = presets.find((x) => x.id === id);
                if (p?.config) {
                  const c = p.config as Record<string, unknown>;
                  onChange({
                    chunk_strategy: (c.chunk_strategy as string) || "fixed",
                    chunk_size: typeof c.chunk_size === "number" ? c.chunk_size : 512,
                    chunk_overlap: typeof c.chunk_overlap === "number" ? c.chunk_overlap : 50,
                    embedding_model: (c.embedding_model as string) || "all-MiniLM-L6-v2",
                    embedding_query_prefix: (c.embedding_query_prefix as string) ?? "",
                  });
                }
              }
            }}
            className="input"
          >
            <option value="">None (set manually)</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-3">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Chunking</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Strategy</label>
            <select
              value={value.chunk_strategy}
              onChange={(e) => onChange({ ...value, chunk_strategy: e.target.value })}
              className="input"
            >
              {CHUNK_STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Chunk size</label>
            <input
              type="number"
              min={64}
              max={2048}
              value={value.chunk_size}
              onChange={(e) => onChange({ ...value, chunk_size: parseInt(e.target.value, 10) || 512 })}
              className="input"
            />
            <p className="text-xs text-slate-500 mt-0.5">Characters (or sentences for sentence strategy)</p>
          </div>
          <div>
            <label className="label">Overlap</label>
            <input
              type="number"
              min={0}
              max={value.chunk_size}
              value={value.chunk_overlap}
              onChange={(e) => onChange({ ...value, chunk_overlap: parseInt(e.target.value, 10) || 0 })}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Embedding</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Model</label>
            <select
              value={value.embedding_model}
              onChange={(e) => onChange({ ...value, embedding_model: e.target.value })}
              className="input"
            >
              {EMBEDDING_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Query prefix (optional, for E5/BGE)</label>
            <input
              type="text"
              placeholder='e.g. "query: " or leave empty'
              value={value.embedding_query_prefix}
              onChange={(e) => onChange({ ...value, embedding_query_prefix: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
