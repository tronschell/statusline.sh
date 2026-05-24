import { Fragment, useEffect, useState } from "react";
import {
  useDroppable,
  useDndMonitor,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ElementType } from "../../../shared/types";
import { useDesignStore } from "../../store/designStore";
import { canvasDragId } from "../../hooks/useDnd";
import { ELEMENT_ICONS, ELEMENT_LABELS } from "../Palette/ElementPalette";
import { ElementChip } from "./ElementChip";

const DROPPABLE_ID = "canvas:__root__";
const PALETTE_PREFIX = "palette:";
const CANVAS_PREFIX = "canvas:";

interface PendingInsert {
  type: ElementType;
  /** Insertion index in the elements array, in [0, elements.length]. */
  index: number;
}

/**
 * Decide whether the cursor's projected position is past the center of the
 * hovered chip — if so the new element should land AFTER the chip, not
 * before. This is what makes dragging in from either side feel correct
 * (iPhone-style) instead of always slotting on the left.
 */
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

export function StatuslineCanvas() {
  const elements = useDesignStore((s) => s.design.elements);
  const addElementAt = useDesignStore((s) => s.addElementAt);
  const { isOver, setNodeRef } = useDroppable({ id: DROPPABLE_ID });
  const [pending, setPending] = useState<PendingInsert | null>(null);

  useDndMonitor({
    onDragOver(e: DragOverEvent) {
      const activeId = e.active?.id;
      if (typeof activeId !== "string" || !activeId.startsWith(PALETTE_PREFIX)) {
        if (pending !== null) setPending(null);
        return;
      }
      const type = activeId.slice(PALETTE_PREFIX.length) as ElementType;
      const overId = e.over?.id;
      if (typeof overId !== "string") {
        if (pending !== null) setPending(null);
        return;
      }
      if (overId === DROPPABLE_ID) {
        const next: PendingInsert = { type, index: elements.length };
        if (pending?.index !== next.index || pending?.type !== type) {
          setPending(next);
        }
        return;
      }
      if (overId.startsWith(CANVAS_PREFIX)) {
        const targetElementId = overId.slice(CANVAS_PREFIX.length);
        const hovered = elements.findIndex((el) => el.id === targetElementId);
        if (hovered < 0) return;
        const idx = computeInsertSide(e, hovered);
        if (pending?.index !== idx || pending?.type !== type) {
          setPending({ type, index: idx });
        }
      }
    },
    onDragEnd(e: DragEndEvent) {
      const activeId = e.active?.id;
      if (typeof activeId === "string" && activeId.startsWith(PALETTE_PREFIX)) {
        const type = activeId.slice(PALETTE_PREFIX.length) as ElementType;
        // Only insert if drop landed inside a canvas droppable. If pending is
        // null at this point the user dropped outside; abort.
        if (pending && e.over) {
          addElementAt(type, pending.index);
        }
      }
      setPending(null);
    },
    onDragCancel() {
      setPending(null);
    },
  });

  const sortableIds = elements.map((el) => canvasDragId(el.id));
  const empty = elements.length === 0;

  return (
    <section
      className="flex flex-col gap-3"
      aria-label="Statusline canvas"
    >
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs uppercase tracking-wider text-[#8A8A86]">
          Canvas
        </h2>
        <span className="text-[11px] text-[#8A8A86]">
          {elements.length} {elements.length === 1 ? "element" : "elements"}
        </span>
      </div>

      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={[
            "min-h-[88px] rounded-[10px] p-4 transition-colors duration-200",
            empty
              ? "border border-dashed border-white/[0.1] bg-transparent"
              : "border border-white/[0.06] bg-[#161618]",
            isOver ? "border-[#8FB8DA]/50 bg-[#1C1C1F]" : "",
          ].join(" ")}
        >
          {empty && !pending ? (
            <div className="h-full min-h-[56px] flex items-center justify-center text-[13px] text-[#8A8A86]">
              Drag elements here
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {elements.map((el, i) => (
                <Fragment key={el.id}>
                  {pending && pending.index === i ? (
                    <SkeletonChip type={pending.type} />
                  ) : null}
                  <ElementChip element={el} />
                </Fragment>
              ))}
              {pending && pending.index >= elements.length ? (
                <SkeletonChip type={pending.type} />
              ) : null}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SkeletonChip({ type }: { type: ElementType }) {
  // Slide-open animation: start collapsed, expand to natural width on the
  // next frame so flex siblings smoothly shift instead of snapping.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const Icon = ELEMENT_ICONS[type];
  const label = ELEMENT_LABELS[type] ?? type;

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden transition-[max-width,opacity] duration-200 ease-out"
      style={{
        maxWidth: open ? 220 : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <div className="inline-flex items-center gap-2 pl-2.5 pr-2.5 py-1.5 rounded-[8px] border border-dashed border-[#8FB8DA]/55 bg-[#8FB8DA]/[0.07] text-[12px] text-[#8FB8DA] whitespace-nowrap">
        <Icon size={13} weight="bold" />
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
}
