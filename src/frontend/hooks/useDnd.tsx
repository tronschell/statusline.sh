import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useDesignStore } from "../store/designStore";
import type { ElementType } from "@statusline/shared/types";
import {
  ELEMENT_ICONS,
  ELEMENT_LABELS,
} from "../components/Palette/ElementPalette";

const PALETTE_PREFIX = "palette:";
const CANVAS_PREFIX = "canvas:";
const PREVIEW_PREFIX = "preview:";

export const CANVAS_ROOT_DROPPABLE = "canvas:__root__";
export const PREVIEW_ROOT_DROPPABLE = "preview:__root__";

export function paletteDragId(type: ElementType): string {
  return `${PALETTE_PREFIX}${type}`;
}

export function canvasDragId(elementId: string): string {
  return `${CANVAS_PREFIX}${elementId}`;
}

export function previewDropId(elementId: string): string {
  return `${PREVIEW_PREFIX}${elementId}`;
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

/**
 * Shape of the insertion-preview marker shown while a palette item is being
 * dragged. `index` is the slot in `design.elements` the new element will land
 * at on drop, in [0, elements.length].
 */
export interface PendingInsert {
  type: ElementType;
  index: number;
}

interface InsertionPreviewValue {
  pending: PendingInsert | null;
}

const InsertionPreviewContext = createContext<InsertionPreviewValue>({
  pending: null,
});

/**
 * Subscribe to the shared insertion-preview state. Both `StatuslineCanvas`
 * and `LivePreview` use this to render the same skeleton marker so a drop
 * over either surface gives consistent placement feedback.
 */
export function useInsertionPreview(): InsertionPreviewValue {
  return useContext(InsertionPreviewContext);
}

function computeInsertSide(
  event: DragOverEvent,
  hoveredIndex: number,
): number {
  const activeRect = event.active.rect.current.translated;
  const overRect = event.over?.rect;
  if (!activeRect || !overRect) return hoveredIndex;
  const activeCenterX = activeRect.left + activeRect.width / 2;
  const overCenterX = overRect.left + overRect.width / 2;
  return activeCenterX > overCenterX ? hoveredIndex + 1 : hoveredIndex;
}

export interface DndProviderProps {
  children: ReactNode;
}

export function DndProvider({ children }: DndProviderProps) {
  const reorder = useDesignStore((s) => s.reorder);
  const addElementAt = useDesignStore((s) => s.addElementAt);
  const elements = useDesignStore((s) => s.design.elements);
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [pending, setPending] = useState<PendingInsert | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function clearPending() {
    setPending((prev) => (prev === null ? prev : null));
  }

  function handleDragStart(event: DragStartEvent): void {
    setActive(parseDragId(event.active.id as string));
  }

  function handleDragOver(event: DragOverEvent): void {
    const activeId = event.active?.id;
    if (typeof activeId !== "string" || !activeId.startsWith(PALETTE_PREFIX)) {
      clearPending();
      return;
    }
    const type = activeId.slice(PALETTE_PREFIX.length) as ElementType;
    const overId = event.over?.id;
    if (typeof overId !== "string") {
      clearPending();
      return;
    }

    const els = useDesignStore.getState().design.elements;

    if (overId === CANVAS_ROOT_DROPPABLE || overId === PREVIEW_ROOT_DROPPABLE) {
      const nextIdx = els.length;
      setPending((prev) =>
        prev?.index === nextIdx && prev.type === type
          ? prev
          : { type, index: nextIdx },
      );
      return;
    }

    let targetId: string | null = null;
    if (overId.startsWith(CANVAS_PREFIX)) {
      targetId = overId.slice(CANVAS_PREFIX.length);
    } else if (overId.startsWith(PREVIEW_PREFIX)) {
      targetId = overId.slice(PREVIEW_PREFIX.length);
    }
    if (!targetId) {
      clearPending();
      return;
    }
    const hovered = els.findIndex((el) => el.id === targetId);
    if (hovered < 0) {
      clearPending();
      return;
    }
    const idx = computeInsertSide(event, hovered);
    setPending((prev) =>
      prev?.index === idx && prev.type === type ? prev : { type, index: idx },
    );
  }

  function handleDragEnd(event: DragEndEvent): void {
    const activeParsed = parseDragId(event.active.id as string);
    const currentPending = pending;
    setActive(null);
    setPending(null);

    if (!activeParsed) return;

    if (activeParsed.kind === "palette") {
      // Insert only if the drop landed inside a registered droppable AND we
      // had a valid pending preview. Otherwise the user dropped outside; abort.
      if (currentPending && event.over) {
        addElementAt(activeParsed.type, currentPending.index);
      }
      return;
    }

    // Canvas-to-canvas reorder. Preview spans intentionally do NOT accept
    // chip reorders — that lives inside the SortableContext of the canvas.
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
    setPending(null);
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
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <InsertionPreviewContext.Provider value={{ pending }}>
        {children}
      </InsertionPreviewContext.Provider>
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

/**
 * Dashed inline placeholder used by both the canvas and the mock-terminal
 * preview to show where a palette item will land on drop. Slides open from
 * zero width so flex siblings smoothly shift instead of snapping.
 */
export function SkeletonChip({ type }: { type: ElementType }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const Icon = ELEMENT_ICONS[type];
  const label = ELEMENT_LABELS[type] ?? type;

  return (
    <span
      aria-hidden="true"
      className="inline-block align-middle overflow-hidden transition-[max-width,opacity] duration-200 ease-out"
      style={{
        maxWidth: open ? 220 : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[8px] border border-dashed border-[#8FB8DA]/60 bg-[#8FB8DA]/[0.07] text-[12px] text-[#8FB8DA] whitespace-nowrap align-middle">
        <Icon size={13} weight="bold" />
        <span className="font-medium">{label}</span>
      </span>
    </span>
  );
}
