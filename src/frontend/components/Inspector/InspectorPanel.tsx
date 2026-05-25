import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import type {
  AnsiStyle,
  ConditionExpr,
  Element,
  ElementType,
} from "@statusline/shared/types";
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
import ContextTokensFields from "./fields/ContextTokensFields";
import CostFields from "./fields/CostFields";
import SessionDurationFields from "./fields/SessionDurationFields";
import GlyphFields from "./fields/GlyphFields";
import SeparatorFields from "./fields/SeparatorFields";
import RotatorFields from "./fields/RotatorFields";
import SegmentSplitFields from "./fields/SegmentSplitFields";
import ThinkingEffortFields from "./fields/ThinkingEffortFields";
import OutputStyleFields from "./fields/OutputStyleFields";
import FastModeFields from "./fields/FastModeFields";
import SpacerFields from "./fields/SpacerFields";
import ThemePresets from "./ThemePresets";

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
  contextTokens: "Context tokens",
  rateLimit5hPct: "5-hour limit %",
  rateLimit5hBar: "5-hour limit bar",
  rateLimit7dPct: "7-day limit %",
  rateLimit7dBar: "7-day limit bar",
  cost: "Cost",
  sessionDuration: "Session duration",
  glyph: "Glyph",
  separator: "Separator",
  rotator: "Rotator",
  segmentSplit: "Segment split",
  thinkingEffort: "Thinking effort",
  outputStyle: "Output style",
  fastMode: "Fast mode",
  lineBreak: "Line break",
  spacer: "Spacer",
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
  contextTokens: "Token counts: used / total / remaining.",
  rateLimit5hPct: "Claude.ai 5-hour rate limit usage percentage.",
  rateLimit5hBar: "Visual meter of 5-hour rate limit usage.",
  rateLimit7dPct: "Claude.ai 7-day rate limit usage percentage.",
  rateLimit7dBar: "Visual meter of 7-day rate limit usage.",
  cost: "Session cost in USD.",
  sessionDuration: "Time since session start.",
  glyph: "Decorative Unicode glyph or emoji.",
  separator: "Visual divider between elements.",
  rotator: "Cycles through items on a clock.",
  segmentSplit: "Splits a field on a delimiter into styled segments.",
  thinkingEffort: "Effort level when extended thinking is on.",
  outputStyle: "Active output style (e.g. explanatory).",
  fastMode: "Badge shown when fast mode is enabled.",
  lineBreak: "Starts a new deck (multi-line statusline).",
  spacer: "Fixed-width gap or flex spacer that pushes following elements right.",
};

const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]";
const labelClass = "text-xs uppercase tracking-wider text-[var(--color-text-muted)]";
const sectionHeading =
  "px-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]";

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
      // Spread + cast: the union of partial element variants is no longer
      // structurally narrowable once a shared discriminator-like key
      // (`mode`) appears in two variants with disjoint literal sets
      // (cwd vs spacer). The runtime invariant — patches only ever touch
      // properties for the currently-selected element type — is enforced
      // by the callers, not by this accumulator.
      pending.current = { ...(pending.current ?? {}), ...patch } as Partial<Element>;
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

  const [themesOpen, setThemesOpen] = useState(false);
  const themesPanelId = useId();

  return (
    <aside
      aria-label="Element inspector"
      className="flex h-full flex-col"
    >
      <Toolbar
        themesOpen={themesOpen}
        themesPanelId={themesPanelId}
        onToggleThemes={() => setThemesOpen((v) => !v)}
      />

      {themesOpen && (
        <div id={themesPanelId} className="px-3 pb-4">
          <ThemePresets onClose={() => setThemesOpen(false)} />
        </div>
      )}

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

function Toolbar({
  themesOpen,
  themesPanelId,
  onToggleThemes,
}: {
  themesOpen: boolean;
  themesPanelId: string;
  onToggleThemes: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 px-3 pt-4 pb-3">
      <button
        type="button"
        onClick={onToggleThemes}
        aria-expanded={themesOpen}
        aria-controls={themesPanelId}
        className={
          themesOpen
            ? "rounded-full border border-[var(--color-text)] bg-[var(--color-text)] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-canvas)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
            : "rounded-full border border-[var(--color-border)] bg-transparent px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:border-white/20 hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
        }
      >
        Themes
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h2 className="editorial m-0 text-2xl leading-tight text-[var(--color-text)]">
        Nothing selected.
      </h2>
      <p className="m-0 max-w-[18rem] text-sm text-[var(--color-text-muted)]">
        Pick an element on the canvas to edit it.
      </p>
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
    <div className="flex flex-col gap-8 pb-6">
      <IdentitySection
        type={element.type}
        label={TYPE_LABEL[element.type]}
        description={TYPE_DESCRIPTION[element.type]}
        id={element.id}
        onDelete={onDelete}
      />

      <section className="flex flex-col gap-3">
        <h3 className={`m-0 ${sectionHeading}`}>Content</h3>
        <TypeFields element={element} onPatch={onPatch} />
        <div className="px-3">
          <LayoutFields element={element} onPatch={onPatch} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={`m-0 ${sectionHeading}`}>Appearance</h3>
        <div className="px-3">
          <StyleEditor
            style={element.style}
            onChange={setStyle}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={`m-0 ${sectionHeading}`}>Visibility</h3>
        <div className="px-3">
          <VisibilitySection element={element} onPatch={onPatch} />
        </div>
      </section>
    </div>
  );
}

function IdentitySection({
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
    <header className="flex items-start justify-between gap-3 px-3">
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="editorial m-0 text-xl leading-tight text-[var(--color-text)]">
          {label}
        </h2>
        <span className="text-[12px] leading-snug text-[var(--color-text-muted)]">
          {description}
        </span>
        <div className="flex min-w-0 items-center gap-2 pt-0.5">
          <span className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text)]">
            {type}
          </span>
          <span
            className="truncate font-mono text-[10px] text-[var(--color-text-muted)] opacity-70"
            title={`Element id: ${id}`}
          >
            {id}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        className="flex shrink-0 items-center gap-1.5 rounded-[4px] border border-[var(--color-border)] bg-transparent px-2.5 py-1.5 text-xs uppercase tracking-wider text-[var(--color-text-muted)] transition-colors hover:border-[#3A1F21] hover:bg-[#1A1112] hover:text-[#E89B9E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E89B9E]/40"
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
    case "rateLimit5hPct":
    case "rateLimit7dPct":
      return <ContextPctFields element={element} onPatch={onPatch} />;
    case "contextBar":
    case "rateLimit5hBar":
    case "rateLimit7dBar":
      return <ContextBarFields element={element} onPatch={onPatch} />;
    case "contextTokens":
      return <ContextTokensFields element={element} onPatch={onPatch} />;
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
    case "thinkingEffort":
      return <ThinkingEffortFields element={element} onPatch={onPatch} />;
    case "outputStyle":
      return <OutputStyleFields element={element} onPatch={onPatch} />;
    case "fastMode":
      return <FastModeFields element={element} onPatch={onPatch} />;
    case "spacer":
      return <SpacerFields element={element} onPatch={onPatch} />;
    case "lineBreak":
      return null;
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
        <p className="m-0 text-[11px] text-[var(--color-text-muted)]">
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
      title="Condition"
      variant="flush"
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
          className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs uppercase tracking-wider text-[var(--color-text)] transition-transform hover:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
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
