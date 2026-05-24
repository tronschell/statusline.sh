import { Plus, Trash, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import type {
  AnsiStyle,
  Element,
  ElementRef,
  SegmentStyle,
} from "../../../../shared/types";
import { useDesignStore } from "../../../store/designStore";
import StyleEditor from "../StyleEditor";
import {
  type FieldsProps,
  captionClass,
  inputClass,
  labelClass,
} from "./common";

type SegmentSplitElement = Extract<Element, { type: "segmentSplit" }>;

const SOURCE_KINDS: { value: ElementRef["kind"]; label: string }[] = [
  { value: "field", label: "Field" },
  { value: "literal", label: "Literal" },
  { value: "element", label: "Element" },
];

function defaultSource(kind: ElementRef["kind"]): ElementRef {
  switch (kind) {
    case "literal":
      return { kind: "literal", text: "" };
    case "field":
      return { kind: "field", path: "workspace.git_worktree" };
    case "element":
      return { kind: "element", refId: "" };
  }
}

export default function SegmentSplitFields({
  element,
  onPatch,
}: FieldsProps<SegmentSplitElement>) {
  const allElements = useDesignStore((s) => s.design.elements);
  const otherElements = allElements.filter((e) => e.id !== element.id);

  const setSource = (s: ElementRef) =>
    onPatch({ source: s } as Partial<Element>);
  const setDelimiter = (d: string) =>
    onPatch({ delimiter: d } as Partial<Element>);
  const setJoinWith = (v: string) =>
    onPatch({ joinWith: v === "" ? undefined : v } as Partial<Element>);

  const setSegments = (next: SegmentStyle[]) =>
    onPatch({ segments: next } as Partial<Element>);

  const addSegment = () => {
    setSegments([...element.segments, { style: {} }]);
  };

  const removeSegment = (idx: number) => {
    if (element.segments.length <= 1) return;
    setSegments(element.segments.filter((_, i) => i !== idx));
  };

  const updateSegment = (idx: number, patch: Partial<SegmentStyle>) => {
    setSegments(
      element.segments.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  };

  const moveSegment = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= element.segments.length) return;
    const next = element.segments.slice();
    const a = next[idx]!;
    const b = next[j]!;
    next[idx] = b;
    next[j] = a;
    setSegments(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Delimiter</label>
        <input
          type="text"
          value={element.delimiter}
          onChange={(e) => setDelimiter(e.target.value)}
          className={inputClass}
          placeholder="/"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Join with</label>
        <input
          type="text"
          value={element.joinWith ?? ""}
          onChange={(e) => setJoinWith(e.target.value)}
          className={inputClass}
          placeholder={element.delimiter || "(uses delimiter)"}
        />
        <p className={captionClass}>
          Optional. Defaults to the delimiter when empty.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Source</label>
        <div className="flex gap-1 rounded-[4px] bg-[#1C1C1F] border border-white/[0.06] p-1">
          {SOURCE_KINDS.map((k) => {
            const active = element.source.kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => setSource(defaultSource(k.value))}
                className={`flex-1 rounded-[3px] px-2 py-1 text-xs uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-[#2A2A2D] text-[#E8E8E6]"
                    : "text-[#8A8A86] hover:text-[#E8E8E6]"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>

        {element.source.kind === "field" && (
          <input
            type="text"
            value={element.source.path}
            onChange={(e) =>
              setSource({ kind: "field", path: e.target.value })
            }
            className={inputClass}
            placeholder="workspace.git_worktree"
          />
        )}
        {element.source.kind === "literal" && (
          <input
            type="text"
            value={element.source.text}
            onChange={(e) =>
              setSource({ kind: "literal", text: e.target.value })
            }
            className={inputClass}
            placeholder="feature/auth-refactor"
          />
        )}
        {element.source.kind === "element" && (
          <select
            value={element.source.refId}
            onChange={(e) =>
              setSource({ kind: "element", refId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">— pick an element —</option>
            {otherElements.map((el) => (
              <option key={el.id} value={el.id}>
                {el.type} ({el.id})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className={labelClass}>Segments</label>
          <button
            type="button"
            onClick={addSegment}
            className="flex items-center gap-1 rounded-[4px] bg-[#1C1C1F] border border-white/[0.06] px-2 py-1 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98]"
          >
            <Plus size={12} weight="bold" />
            Add segment
          </button>
        </div>

        {element.segments.map((seg, i) => (
          <SegmentRow
            key={i}
            index={i}
            segment={seg}
            canRemove={element.segments.length > 1}
            canMoveUp={i > 0}
            canMoveDown={i < element.segments.length - 1}
            onUpdate={(patch) => updateSegment(i, patch)}
            onRemove={() => removeSegment(i)}
            onMove={(dir) => moveSegment(i, dir)}
          />
        ))}

        <p className={captionClass}>
          The last segment styles all overflow indexes — e.g., split
          {" "}<code className="rounded bg-[#1C1C1F] px-1">a/b/c/d</code> on
          {" "}<code className="rounded bg-[#1C1C1F] px-1">/</code> with 3
          segments will use segment 0 for <code className="rounded bg-[#1C1C1F] px-1">a</code>,
          segment 1 for <code className="rounded bg-[#1C1C1F] px-1">b</code>,
          and segment 2 for both <code className="rounded bg-[#1C1C1F] px-1">c</code> and
          {" "}<code className="rounded bg-[#1C1C1F] px-1">d</code>.
        </p>
      </div>
    </div>
  );
}

function SegmentRow({
  index,
  segment,
  canRemove,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMove,
}: {
  index: number;
  segment: SegmentStyle;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (patch: Partial<SegmentStyle>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const setStyle = (s: AnsiStyle) => onUpdate({ style: s });
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-white/[0.06] bg-[#1C1C1F] p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-[#8A8A86]">
          Segment {index}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            title="Move up"
            className="rounded-[3px] p-1 text-[#8A8A86] transition-colors disabled:opacity-30 hover:text-[#E8E8E6]"
          >
            <ArrowUp size={12} weight="bold" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            title="Move down"
            className="rounded-[3px] p-1 text-[#8A8A86] transition-colors disabled:opacity-30 hover:text-[#E8E8E6]"
          >
            <ArrowDown size={12} weight="bold" />
          </button>
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            title="Remove segment"
            className="rounded-[3px] p-1 text-[#8A8A86] transition-colors disabled:opacity-30 hover:text-[#E89B9E]"
          >
            <Trash size={12} weight="bold" />
          </button>
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass}>Prefix</label>
          <input
            type="text"
            value={segment.prefix ?? ""}
            onChange={(e) =>
              onUpdate({ prefix: e.target.value === "" ? undefined : e.target.value })
            }
            className={inputClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass}>Suffix</label>
          <input
            type="text"
            value={segment.suffix ?? ""}
            onChange={(e) =>
              onUpdate({ suffix: e.target.value === "" ? undefined : e.target.value })
            }
            className={inputClass}
          />
        </div>
      </div>

      <StyleEditor
        title={`Segment ${index} style`}
        style={segment.style}
        onChange={setStyle}
      />
    </div>
  );
}
