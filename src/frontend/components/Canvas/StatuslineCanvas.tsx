import { Fragment } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDesignStore } from "../../store/designStore";
import {
  CANVAS_ROOT_DROPPABLE,
  SkeletonChip,
  canvasDragId,
  useInsertionPreview,
} from "../../hooks/useDnd";
import { ElementChip } from "./ElementChip";

export function StatuslineCanvas() {
  const elements = useDesignStore((s) => s.design.elements);
  const { isOver, setNodeRef } = useDroppable({ id: CANVAS_ROOT_DROPPABLE });
  const { pending } = useInsertionPreview();

  const sortableIds = elements.map((el) => canvasDragId(el.id));
  const empty = elements.length === 0;

  return (
    <section className="flex flex-col gap-3" aria-label="Statusline canvas">
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
