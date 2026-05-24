import { useCallback, useEffect, useMemo, useRef } from "react";
import { Cube, Trash } from "@phosphor-icons/react";
import type {
  AnsiStyle,
  ConditionExpr,
  Element,
  ElementType,
} from "../../../shared/types";
import { useDesignStore } from "../../store/designStore";
import StyleEditor from "./StyleEditor";
import Collapsible from "./Collapsible";

import StaticTextFields from "./fields/StaticTextFields";
import ModelFields from "./fields/ModelFields";
import CwdFields from "./fields/CwdFields";
import GitBranchFields from "./fields/GitBranchFields";
import GitStatusFields from "./fields/GitStatusFields";
import LinesAddedFields from "./fields/LinesAddedFields";
import LinesRemovedFields from "./fields/LinesRemovedFields";
import ContextPctFields from "./fields/ContextPctFields";
import ContextBarFields from "./fields/ContextBarFields";
import CostFields from "./fields/CostFields";
import SessionDurationFields from "./fields/SessionDurationFields";
import GlyphFields from "./fields/GlyphFields";
import SeparatorFields from "./fields/SeparatorFields";
import RotatorFields from "./fields/RotatorFields";
import SegmentSplitFields from "./fields/SegmentSplitFields";

const TYPE_LABEL: Record<ElementType, string> = {
  static: "Static text",
  model: "Model",
  cwd: "Current directory",
  gitBranch: "Git branch",
  gitStatus: "Git status",
  linesAdded: "Lines added",
  linesRemoved: "Lines removed",
  contextPct: "Context %",
  contextBar: "Context bar",
  cost: "Cost",
  sessionDuration: "Session duration",
  glyph: "Glyph",
  separator: "Separator",
  rotator: "Rotator",
  segmentSplit: "Segment split",
};

const TYPE_DESCRIPTION: Record<ElementType, string> = {
  static: "Literal text rendered as-is.",
  model: "Active Claude model name.",
  cwd: "Current working directory.",
  gitBranch: "Current git branch name.",
  gitStatus: "Working-tree status (clean / dirty).",
  linesAdded: "Total lines added this session.",
  linesRemoved: "Total lines removed this session.",
  contextPct: "Context window usage percentage.",
  contextBar: "Visual meter of context usage.",
  cost: "Session cost in USD.",
  sessionDuration: "Time since session start.",
  glyph: "Decorative Unicode glyph or emoji.",
  separator: "Visual divider between elements.",
  rotator: "Cycles through items on a clock.",
  segmentSplit: "Splits a field on a delimiter into styled segments.",
};

const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]";
const labelClass = "text-xs uppercase tracking-wider text-[var(--color-text-muted)]";

/**
 * Returns a stable patch function that batches calls into one
 * `updateElement` call per animation frame. This keeps high-frequency
 * inputs (sliders, hex typing) from spamming the history stack and
 * re-rendering on every keystroke.
 */
function useBatchedPatch(id: string | null) {
  const updateElement = useDesignStore((s) => s.updateElement);
  const pending = useRef<Partial<Element> | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (id && pending.current) {
        updateElement(id, pending.current);
        pending.current = null;
      }
    },
    [id, updateElement],
  );

  return useCallback(
    (patch: Partial<Element>) => {
      if (!id) return;
      pending.current = { ...(pending.current ?? {}), ...patch };
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const next = pending.current;
        pending.current = null;
        if (next) updateElement(id, next);
      });
    },
    [id, updateElement],
  );
}

export default function InspectorPanel() {
  const element = useDesignStore((s) =>
    s.selectedId ? s.design.elements.find((e) => e.id === s.selectedId) ?? null : null,
  );
  const removeElement = useDesignStore((s) => s.removeElement);

  const onPatch = useBatchedPatch(element?.id ?? null);

  return (
    <aside
      aria-label="Element inspector"
      className="flex h-full flex-col gap-4"
    >
      <div className="px-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        Inspector
      </div>

      {!element ? (
        <EmptyState />
      ) : (
        <ElementEditor
          element={element}
          onPatch={onPatch}
          onDelete={() => removeElement(element.id)}
        />
      )}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center text-[var(--color-text-muted)]">
      <Cube size={32} weight="bold" className="opacity-40" />
      <p className="text-sm">Select an element to edit</p>
    </div>
  );
}

function ElementEditor({
  element,
  onPatch,
  onDelete,
}: {
  element: Element;
  onPatch: (p: Partial<Element>) => void;
  onDelete: () => void;
}) {
  const setStyle = (s: AnsiStyle) => onPatch({ style: s } as Partial<Element>);

  return (
    <div className="flex flex-col gap-5">
      <Header
        type={element.type}
        label={TYPE_LABEL[element.type]}
        description={TYPE_DESCRIPTION[element.type]}
        id={element.id}
        onDelete={onDelete}
      />

      <TypeFields element={element} onPatch={onPatch} />

      <StyleEditor style={element.style} onChange={setStyle} />

      <Collapsible title="Layout" defaultOpen={false}>
        <LayoutFields element={element} onPatch={onPatch} />
      </Collapsible>

      <VisibilitySection element={element} onPatch={onPatch} />
    </div>
  );
}

function Header({
  type,
  label,
  description,
  id,
  onDelete,
}: {
  type: ElementType;
  label: string;
  description: string;
  id: string;
  onDelete: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-2 px-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 text-base text-[var(--color-text)]">{label}</h2>
        <span className="text-[11px] leading-snug text-[var(--color-text-muted)]">
          {description}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)] opacity-70" title={`Element id: ${id}`}>
          {type} · {id}
        </span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        className="flex shrink-0 items-center gap-1 rounded-[4px] border border-white/[0.06] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs uppercase tracking-wider text-[var(--color-text)] transition-colors hover:border-[#3A1F21] hover:text-[#E89B9E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E89B9E]/40"
      >
        <Trash size={12} weight="bold" />
        Delete
      </button>
    </header>
  );
}

function TypeFields({
  element,
  onPatch,
}: {
  element: Element;
  onPatch: (p: Partial<Element>) => void;
}) {
  const body = renderTypeBody(element, onPatch);
  if (!body) return null;
  return <div className="px-3">{body}</div>;
}

function renderTypeBody(
  element: Element,
  onPatch: (p: Partial<Element>) => void,
) {
  switch (element.type) {
    case "static":
      return <StaticTextFields element={element} onPatch={onPatch} />;
    case "model":
      return <ModelFields element={element} onPatch={onPatch} />;
    case "cwd":
      return <CwdFields element={element} onPatch={onPatch} />;
    case "gitBranch":
      return <GitBranchFields element={element} onPatch={onPatch} />;
    case "gitStatus":
      return <GitStatusFields element={element} onPatch={onPatch} />;
    case "linesAdded":
      return <LinesAddedFields element={element} onPatch={onPatch} />;
    case "linesRemoved":
      return <LinesRemovedFields element={element} onPatch={onPatch} />;
    case "contextPct":
      return <ContextPctFields element={element} onPatch={onPatch} />;
    case "contextBar":
      return <ContextBarFields element={element} onPatch={onPatch} />;
    case "cost":
      return <CostFields element={element} onPatch={onPatch} />;
    case "sessionDuration":
      return <SessionDurationFields element={element} onPatch={onPatch} />;
    case "glyph":
      return <GlyphFields element={element} onPatch={onPatch} />;
    case "separator":
      return <SeparatorFields element={element} onPatch={onPatch} />;
    case "rotator":
      return <RotatorFields element={element} onPatch={onPatch} />;
    case "segmentSplit":
      return <SegmentSplitFields element={element} onPatch={onPatch} />;
  }
}

function LayoutFields({
  element,
  onPatch,
}: {
  element: Element;
  onPatch: (p: Partial<Element>) => void;
}) {
  const setPrefix = (v: string) =>
    onPatch({ prefix: v === "" ? undefined : v } as Partial<Element>);
  const setSuffix = (v: string) =>
    onPatch({ suffix: v === "" ? undefined : v } as Partial<Element>);
  const setMax = (v: string) => {
    if (v === "") {
      onPatch({ maxLength: undefined } as Partial<Element>);
      return;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(1, Math.min(200, Math.round(n)));
    onPatch({ maxLength: clamped } as Partial<Element>);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="layout-prefix">Prefix</label>
          <input
            id="layout-prefix"
            type="text"
            value={element.prefix ?? ""}
            onChange={(e) => setPrefix(e.target.value)}
            className={inputClass}
            placeholder="(none)"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="layout-suffix">Suffix</label>
          <input
            id="layout-suffix"
            type="text"
            value={element.suffix ?? ""}
            onChange={(e) => setSuffix(e.target.value)}
            className={inputClass}
            placeholder="(none)"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="layout-max">Max length</label>
        <input
          id="layout-max"
          type="number"
          min={1}
          max={200}
          value={element.maxLength ?? ""}
          onChange={(e) => setMax(e.target.value)}
          className={inputClass}
          placeholder="No limit"
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          Truncates the rendered value to this many characters.
        </p>
      </div>
    </div>
  );
}

const OPS: { value: ConditionExpr["op"]; label: string }[] = [
  { value: "exists", label: "exists" },
  { value: "eq", label: "==" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
];

function VisibilitySection({
  element,
  onPatch,
}: {
  element: Element;
  onPatch: (p: Partial<Element>) => void;
}) {
  const enabled = element.showWhen !== undefined;
  const current = element.showWhen;
  const op: ConditionExpr["op"] = current?.op ?? "exists";
  const field = current?.field ?? "";
  const value: string | number | undefined = useMemo(() => {
    if (!current) return undefined;
    if (current.op === "exists") return undefined;
    return current.value;
  }, [current]);

  const writeCondition = (next: ConditionExpr | undefined) =>
    onPatch({ showWhen: next } as Partial<Element>);

  const enable = () => {
    if (!enabled) {
      writeCondition({ field: field || "", op: "exists" } as ConditionExpr);
    }
  };
  const disable = () => writeCondition(undefined);

  const setField = (v: string) => {
    if (op === "exists") writeCondition({ field: v, op: "exists" });
    else writeCondition({ field: v, op, value: value ?? "" });
  };
  const setOp = (nextOp: ConditionExpr["op"]) => {
    if (nextOp === "exists") writeCondition({ field, op: "exists" });
    else writeCondition({ field, op: nextOp, value: value ?? "" });
  };
  const setValue = (v: string) => {
    if (op === "exists") return;
    writeCondition({ field, op, value: v });
  };

  return (
    <Collapsible
      title="Visibility"
      summary={
        enabled ? (
          <span className="rounded-full bg-[#1E2A36] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#8FB8DA]">
            Active
          </span>
        ) : undefined
      }
      defaultOpen={enabled}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">
          Render this element only when a condition is met.
        </span>
        <button
          type="button"
          onClick={enabled ? disable : enable}
          className="rounded-[4px] border border-white/[0.06] bg-[var(--color-surface-2)] px-2 py-1 text-xs uppercase tracking-wider text-[var(--color-text)] transition-transform hover:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
        >
          {enabled ? "Clear" : "Enable"}
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="vis-field">Field path</label>
            <input
              id="vis-field"
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              className={inputClass}
              placeholder="workspace.git_worktree"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={labelClass} htmlFor="vis-op">Op</label>
              <select
                id="vis-op"
                value={op}
                onChange={(e) => setOp(e.target.value as ConditionExpr["op"])}
                className={inputClass}
              >
                {OPS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {op !== "exists" && (
              <div className="flex flex-1 flex-col gap-1.5">
                <label className={labelClass} htmlFor="vis-value">Value</label>
                <input
                  id="vis-value"
                  type="text"
                  value={value === undefined ? "" : String(value)}
                  onChange={(e) => setValue(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </>
      )}
    </Collapsible>
  );
}
