import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { inputClass, labelClass } from "./fields/common";

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
import RateLimitFields from "./fields/RateLimitFields";
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
  rateLimit5h: "5-hour rate limit",
  rateLimit7d: "7-day rate limit",
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
  rateLimit5h: "Claude.ai 5-hour rate limit (percentage or bar).",
  rateLimit7d: "Claude.ai 7-day rate limit (percentage or bar).",
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

const sectionHeading =
  "text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]";

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

  return (
    <aside
      aria-label="Element inspector"
      className="flex h-full flex-col px-4 pb-10 pt-1 sm:px-6 lg:pt-5"
    >
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
    <div className="flex flex-col gap-3 pt-2 lg:pt-4">
      <h2 className="m-0 font-serif text-[26px] leading-none tracking-tight text-[#F2F2F0]">
        Nothing selected.
      </h2>
      <p className="m-0 max-w-[26ch] text-[13px] leading-relaxed text-[#8A8A86]">
        Pick an element in the preview or on the canvas to edit it.
      </p>
      <dl className="m-0 mt-5 flex flex-col divide-y divide-white/[0.06] border-y border-white/[0.06] text-[12px] text-[#6F6F6B]">
        {[
          ["Move", "Alt + arrows"],
          ["Remove", "Delete"],
          ["Undo", "Cmd/Ctrl + Z"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2">
            <dt>{k}</dt>
            <dd className="m-0 font-mono text-[11px] text-[#8A8A86]">{v}</dd>
          </div>
        ))}
      </dl>
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
    <div className="flex flex-col gap-8">
      <IdentitySection
        label={TYPE_LABEL[element.type]}
        description={TYPE_DESCRIPTION[element.type]}
        onDelete={onDelete}
      />

      <section className="flex flex-col gap-4 border-t border-white/[0.06] pt-6">
        <h3 className={`m-0 ${sectionHeading}`}>Content</h3>
        <TypeFields element={element} onPatch={onPatch} />
        <LayoutFields element={element} onPatch={onPatch} />
      </section>

      <section className="flex flex-col gap-4 border-t border-white/[0.06] pt-6">
        <h3 className={`m-0 ${sectionHeading}`}>Appearance</h3>
        <StyleEditor
          style={element.style}
          onChange={setStyle}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-white/[0.06] pt-6">
        <h3 className={`m-0 ${sectionHeading}`}>Visibility</h3>
        <VisibilitySection element={element} onPatch={onPatch} />
      </section>
    </div>
  );
}

function IdentitySection({
  label,
  description,
  onDelete,
}: {
  label: string;
  description: string;
  onDelete: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3 pt-2 lg:pt-0">
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="m-0 font-serif text-[26px] leading-none tracking-tight text-[#F2F2F0]">
          {label}
        </h2>
        <span className="text-[13px] leading-snug text-[#8A8A86]">
          {description}
        </span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        className="-mr-2 flex shrink-0 items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-[#8A8A86] transition-colors hover:bg-[#E89B9E]/10 hover:text-[#E89B9E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E89B9E]/40"
      >
        <Trash size={13} weight="bold" />
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
  return <div>{body}</div>;
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
    case "contextTokens":
      return <ContextTokensFields element={element} onPatch={onPatch} />;
    case "rateLimit5h":
    case "rateLimit7d":
      return <RateLimitFields element={element} onPatch={onPatch} />;
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
      <div className="grid grid-cols-2 gap-4">
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
        <p className="m-0 text-[12px] text-[#6F6F6B]">
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
          <span className="text-[11px] uppercase tracking-[0.12em] text-[#8FB8DA]">
            Active
          </span>
        ) : undefined
      }
      defaultOpen={enabled}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-[#6F6F6B]">
          Render this element only when a condition is met.
        </span>
        <button
          type="button"
          onClick={enabled ? disable : enable}
          className="shrink-0 text-[13px] text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] transition-colors hover:decoration-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
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

          <div className="flex gap-4">
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
