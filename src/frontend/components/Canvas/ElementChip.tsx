import type { MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash } from "@phosphor-icons/react";
import type { Element, ElementType } from "@statusline/shared/types";
import { colorToCss } from "@statusline/shared/ansi";
import { useDesignStore } from "../../store/designStore";
import { canvasDragId } from "../../hooks/useDnd";
import { ELEMENT_ICONS } from "../Palette/ElementPalette";

const TYPE_LABEL: Record<ElementType, string> = {
  static: "Static",
  model: "Model",
  cwd: "CWD",
  gitBranch: "Branch",
  gitStatus: "Status",
  linesAdded: "Added",
  linesRemoved: "Removed",
  contextPct: "Ctx %",
  contextBar: "Bar",
  contextTokens: "Tokens",
  rateLimit5h: "5h limit",
  rateLimit7d: "7d limit",
  cost: "Cost",
  sessionDuration: "Duration",
  glyph: "Glyph",
  separator: "Sep",
  rotator: "Rotator",
  segmentSplit: "Split…",
  thinkingEffort: "Effort",
  outputStyle: "Style",
  fastMode: "Fast",
  lineBreak: "↵ Line",
  spacer: "↔ Spacer",
};

function previewFor(el: Element): string | null {
  if (el.type === "static") return el.text;
  if (el.type === "separator") return el.text;
  if (el.type === "glyph") return el.char;
  if (el.type === "rotator") return el.items.join("");
  if (el.type === "fastMode") return el.text ?? "⚡fast";
  return null;
}

function truncate(s: string, max = 14): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export interface ElementChipProps {
  element: Element;
  onContextMenu?: (elementId: string, x: number, y: number) => void;
}

export function ElementChip({ element, onContextMenu }: ElementChipProps) {
  const selectedId = useDesignStore((s) => s.selectedId);
  const select = useDesignStore((s) => s.select);
  const removeElement = useDesignStore((s) => s.removeElement);
  const lastAdd = useDesignStore((s) => s.lastAdd);

  // Freshly added chips mount with their animation class already present, so
  // the keyframes play once on first render. The just-added content chip
  // drops in; an auto-inserted separator reveals + glows a beat later.
  const animClass =
    lastAdd?.contentId === element.id
      ? "sl-anim-chip-drop"
      : lastAdd?.separatorId === element.id
        ? "sl-anim-sep-reveal"
        : "";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: canvasDragId(element.id) });

  const isSelected = selectedId === element.id;
  const swatchCss = colorToCss(element.style.fg, true);
  const preview = previewFor(element);
  const Icon = ELEMENT_ICONS[element.type];
  const isLineBreak = element.type === "lineBreak";
  const isFlexSpacer = element.type === "spacer" && element.mode === "flex";
  const isFixedSpacer = element.type === "spacer" && element.mode === "fixed";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as const;

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented) return;
    select(element.id);
  }

  function handleRemove(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    removeElement(element.id);
  }

  function handleContextMenu(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(element.id, e.clientX, e.clientY);
  }

  if (isFlexSpacer) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        data-element-id={element.id}
        data-element-type={element.type}
        aria-label="Flex spacer — pushes following elements toward the right edge"
        className={[
          "group relative flex-1 min-w-[60px] flex items-center gap-2 px-2 py-1 rounded-[8px]",
          "bg-white/[0.02] text-[#8A8A86] text-[11px] cursor-grab active:cursor-grabbing",
          "transition-colors duration-200",
          isSelected
            ? "border border-[#8FB8DA]"
            : "border border-dashed border-white/[0.08] hover:border-white/[0.16]",
          animClass,
        ].join(" ")}
      >
        <span className="font-mono text-[10px] shrink-0" aria-hidden="true">
          ←
        </span>
        <span
          aria-hidden="true"
          className="flex-1 h-px bg-white/[0.06]"
        />
        <Icon size={12} weight="bold" />
        <span
          aria-hidden="true"
          className="flex-1 h-px bg-white/[0.06]"
        />
        <span className="font-mono text-[10px] shrink-0" aria-hidden="true">
          →
        </span>
        <button
          type="button"
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-1 text-[#8A8A86] hover:text-[#E89B9E] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
          aria-label="Remove flex spacer"
        >
          <Trash size={12} weight="bold" />
        </button>
      </div>
    );
  }

  if (isFixedSpacer) {
    const ch =
      element.type === "spacer" && element.char && element.char.length > 0
        ? element.char.slice(0, 1)
        : " ";
    const w =
      element.type === "spacer" && typeof element.width === "number"
        ? element.width
        : 1;
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        data-element-id={element.id}
        data-element-type={element.type}
        aria-label={`Fixed spacer — ${w} char${w === 1 ? "" : "s"}`}
        title={`Fixed spacer · ${w}× ${ch === " " ? "space" : JSON.stringify(ch)}`}
        className={[
          "group relative inline-flex items-center gap-1.5 px-2 py-1.5 rounded-[8px]",
          "bg-[#1C1C1F] text-[#8A8A86] text-[11px] cursor-grab active:cursor-grabbing",
          "transition-colors duration-200",
          isSelected
            ? "border border-[#8FB8DA]"
            : "border border-white/[0.06] hover:border-white/[0.12]",
          animClass,
        ].join(" ")}
      >
        <Icon size={12} weight="bold" />
        <span className="font-mono text-[11px] text-[#E8E8E6]">
          {w}× {ch === " " ? "·" : ch}
        </span>
        <button
          type="button"
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-1 text-[#8A8A86] hover:text-[#E89B9E] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
          aria-label="Remove fixed spacer"
        >
          <Trash size={12} weight="bold" />
        </button>
      </div>
    );
  }

  if (isLineBreak) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        data-element-id={element.id}
        data-element-type={element.type}
        aria-label="Line break — new deck"
        className={[
          "group relative w-full flex items-center gap-2 px-2 py-1 rounded-[8px]",
          "bg-white/[0.02] text-[#8A8A86] text-[11px] cursor-grab active:cursor-grabbing",
          "transition-colors duration-200",
          isSelected
            ? "border border-[#8FB8DA]"
            : "border border-dashed border-white/[0.08] hover:border-white/[0.16]",
          animClass,
        ].join(" ")}
      >
        <span className="shrink-0" aria-hidden="true">
          <Icon size={12} weight="bold" />
        </span>
        <span className="font-medium uppercase tracking-wider">
          {TYPE_LABEL[element.type]}
        </span>
        <span
          aria-hidden="true"
          className="flex-1 h-px bg-white/[0.06]"
        />
        <button
          type="button"
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-1 text-[#8A8A86] hover:text-[#E89B9E] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
          aria-label="Remove line break"
        >
          <Trash size={12} weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      data-element-id={element.id}
      data-element-type={element.type}
      className={[
        "group relative inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-[8px]",
        "bg-[#1C1C1F] text-[#E8E8E6] text-[12px] cursor-grab active:cursor-grabbing",
        "transition-colors duration-200",
        isSelected
          ? "border border-[#8FB8DA]"
          : "border border-white/[0.06] hover:border-white/[0.12]",
        animClass,
      ].join(" ")}
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm border border-white/[0.08] shrink-0"
        style={{ background: swatchCss ?? "transparent" }}
        aria-hidden="true"
      />
      <span className="text-[#E8E8E6] shrink-0" aria-hidden="true">
        <Icon size={13} weight="bold" />
      </span>
      <span className="font-medium">{TYPE_LABEL[element.type]}</span>
      {preview !== null && (
        <span className="font-mono text-[11px] text-[#8A8A86] max-w-[100px] truncate">
          {truncate(preview)}
        </span>
      )}
      <button
        type="button"
        onClick={handleRemove}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-1 text-[#8A8A86] hover:text-[#E89B9E] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
        aria-label={`Remove ${TYPE_LABEL[element.type]} element`}
      >
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}
