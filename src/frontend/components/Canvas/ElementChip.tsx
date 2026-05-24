import type { MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash } from "@phosphor-icons/react";
import type { Element, ElementType } from "../../../shared/types";
import { colorToCss } from "../../../shared/ansi";
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
  rateLimit5hPct: "5h %",
  rateLimit5hBar: "5h bar",
  rateLimit7dPct: "7d %",
  rateLimit7dBar: "7d bar",
  cost: "Cost",
  sessionDuration: "Duration",
  glyph: "Glyph",
  separator: "Sep",
  rotator: "Rotator",
  segmentSplit: "Split…",
};

function previewFor(el: Element): string | null {
  if (el.type === "static") return el.text;
  if (el.type === "separator") return el.text;
  if (el.type === "glyph") return el.char;
  if (el.type === "rotator") return el.items.join("");
  return null;
}

function truncate(s: string, max = 14): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export interface ElementChipProps {
  element: Element;
}

export function ElementChip({ element }: ElementChipProps) {
  const selectedId = useDesignStore((s) => s.selectedId);
  const select = useDesignStore((s) => s.select);
  const removeElement = useDesignStore((s) => s.removeElement);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className={[
        "group relative inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-[8px]",
        "bg-[#1C1C1F] text-[#E8E8E6] text-[12px] cursor-grab active:cursor-grabbing",
        "transition-colors duration-200",
        isSelected
          ? "border border-[#8FB8DA]"
          : "border border-white/[0.06] hover:border-white/[0.12]",
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
