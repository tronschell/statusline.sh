import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useDesignStore } from "../store/designStore";
import type { ElementType } from "../../shared/types";
import {
  ELEMENT_ICONS,
  ELEMENT_LABELS,
} from "../components/Palette/ElementPalette";

const PALETTE_PREFIX = "palette:";
const CANVAS_PREFIX = "canvas:";

export function paletteDragId(type: ElementType): string {
  return `${PALETTE_PREFIX}${type}`;
}

export function canvasDragId(elementId: string): string {
  return `${CANVAS_PREFIX}${elementId}`;
}

type ActiveDrag =
  | { kind: "palette"; type: ElementType }
  | { kind: "canvas"; id: string };

function parseDragId(
  raw: string | number | undefined | null,
): ActiveDrag | null {
  if (typeof raw !== "string") return null;
  if (raw.startsWith(PALETTE_PREFIX)) {
    return {
      kind: "palette",
      type: raw.slice(PALETTE_PREFIX.length) as ElementType,
    };
  }
  if (raw.startsWith(CANVAS_PREFIX)) {
    return { kind: "canvas", id: raw.slice(CANVAS_PREFIX.length) };
  }
  return null;
}

export interface DndProviderProps {
  children: ReactNode;
}

export function DndProvider({ children }: DndProviderProps) {
  const reorder = useDesignStore((s) => s.reorder);
  const elements = useDesignStore((s) => s.design.elements);
  const [active, setActive] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent): void {
    setActive(parseDragId(event.active.id as string));
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActive(null);
    const activeParsed = parseDragId(event.active.id as string);
    if (!activeParsed) return;

    // Palette inserts are handled by StatuslineCanvas via useDndMonitor so it
    // can use the cursor-position-aware insertion index. We only handle the
    // canvas-to-canvas reorder here.
    if (activeParsed.kind === "palette") return;

    if (!event.over) return;
    const overParsed = parseDragId(event.over.id as string);
    if (!overParsed || overParsed.kind !== "canvas") return;
    if (overParsed.id === activeParsed.id) return;

    const els = useDesignStore.getState().design.elements;
    const fromIdx = els.findIndex((el) => el.id === activeParsed.id);
    const toIdx = els.findIndex((el) => el.id === overParsed.id);
    if (fromIdx === -1 || toIdx === -1) return;
    reorder(fromIdx, toIdx);
  }

  function handleDragCancel(): void {
    setActive(null);
  }

  let overlay: ReactNode = null;
  if (active?.kind === "palette") {
    const Icon = ELEMENT_ICONS[active.type];
    const label = ELEMENT_LABELS[active.type] ?? active.type;
    overlay = (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border border-[#8FB8DA]/60 bg-[#1C1C1F] text-[12px] text-[#E8E8E6] shadow-lg shadow-black/40 cursor-grabbing pointer-events-none">
        <Icon size={14} weight="bold" />
        <span className="font-medium">{label}</span>
      </div>
    );
  } else if (active?.kind === "canvas") {
    const el = elements.find((e) => e.id === active.id);
    if (el) {
      const Icon = ELEMENT_ICONS[el.type];
      const label = ELEMENT_LABELS[el.type] ?? el.type;
      overlay = (
        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] border border-[#8FB8DA]/60 bg-[#1C1C1F] text-[12px] text-[#E8E8E6] shadow-lg shadow-black/40 cursor-grabbing pointer-events-none">
          <Icon size={13} weight="bold" />
          <span className="font-medium">{label}</span>
        </div>
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay
        dropAnimation={{
          duration: 180,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}
      >
        {overlay}
      </DragOverlay>
    </DndContext>
  );
}
