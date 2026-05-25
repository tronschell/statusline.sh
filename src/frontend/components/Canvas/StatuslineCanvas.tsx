import { Fragment, useCallback, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Element } from "@statusline/shared/types";
import { useDesignStore } from "../../store/designStore";
import {
  CANVAS_ROOT_DROPPABLE,
  SkeletonChip,
  canvasDragId,
  useInsertionPreview,
  useRegisterInsertionResolver,
  type InsertionResolver,
} from "../../hooks/useDnd";
import { ElementChip } from "./ElementChip";

/**
 * Split a flat element list into stacked rows at each lineBreak boundary.
 * The lineBreak chip itself stays in the row it terminates so it renders
 * as a visual divider at the end of that deck. Each entry carries the
 * original flat-array index so insertion-preview skeletons line up.
 */
type IndexedElement = { el: Element; index: number };

function splitIntoRows(elements: ReadonlyArray<Element>): IndexedElement[][] {
  const rows: IndexedElement[][] = [[]];
  elements.forEach((el, index) => {
    rows[rows.length - 1]!.push({ el, index });
    if (el.type === "lineBreak") rows.push([]);
  });
  // Drop the trailing empty row when the last element is a lineBreak so we
  // do not render a phantom blank deck below it.
  if (rows.length > 1 && rows[rows.length - 1]!.length === 0) rows.pop();
  return rows;
}

/**
 * Compute the insertion index + visual row from a live pointer coordinate,
 * using each chip's measured rect. Drives both the preview skeleton and the
 * final drop position so they cannot diverge.
 *
 * Algorithm:
 *   1. If the pointer is outside the canvas root (with small bleed), return
 *      null — caller tries other resolvers / falls back to the over-id
 *      heuristic for non-canvas surfaces.
 *   2. Measure every chip and group them into VISUAL lines using their Y
 *      ranges. A logical row (delimited by `lineBreak`) can flex-wrap into
 *      several visual lines; seam math must operate within one visual line
 *      or hovering on the second wrapped line snaps to a chip on the first.
 *   3. Find the visual line whose vertical span contains the pointer; else
 *      snap to the closest one, or "append below" if the pointer is far past
 *      the last visual line.
 *   4. Within that visual line, find the seam whose midpoint is closest to
 *      the pointer's X. Seam k corresponds to flat index `chip[k].index` for
 *      k < n, or `chip[n-1].index + 1` for the trailing seam.
 *
 * Edge cases:
 *   - Empty canvas: returns {index: 0, rowIndex: 0}.
 *   - Empty deck between two lineBreaks: returns the slot just after the
 *     prior deck's last element.
 *   - `lineBreak` chips render full-width, so they always occupy their own
 *     visual line. Hovering on one inserts before it (= end of its deck).
 *   - When the trailing seam falls inside a deck that ends with a lineBreak,
 *     the splice at `lastChip.index + 1` lands at the lineBreak's slot and
 *     pushes it forward — so the new element stays in this deck.
 */
function resolveInsertion(
  rootEl: HTMLElement,
  rows: ReadonlyArray<ReadonlyArray<IndexedElement>>,
  totalElements: number,
  pointerX: number,
  pointerY: number,
): { index: number; rowIndex: number | null } | null {
  const rootRect = rootEl.getBoundingClientRect();
  const bleed = 8;
  const inside =
    pointerX >= rootRect.left - bleed &&
    pointerX <= rootRect.right + bleed &&
    pointerY >= rootRect.top - bleed &&
    pointerY <= rootRect.bottom + bleed;
  if (!inside) return null;

  if (rows.length === 0 || totalElements === 0) {
    return { index: 0, rowIndex: 0 };
  }

  // Build a lookup of measured chip rects keyed by flat index. Walk the rows
  // in order so the NodeList (in DOM order) matches the flat-array order even
  // when refs come and go during a drag.
  const chipNodes = rootEl.querySelectorAll<HTMLElement>("[data-element-id]");
  type ChipRect = { left: number; right: number; top: number; bottom: number };
  const rectByIndex = new Map<number, ChipRect>();
  let domIdx = 0;
  rows.forEach((row) => {
    row.forEach(({ index }) => {
      const node = chipNodes[domIdx++];
      if (!node) return;
      const r = node.getBoundingClientRect();
      rectByIndex.set(index, {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      });
    });
  });

  // Group every logical row's chips into VISUAL lines using Y-overlap. A new
  // visual line starts when a chip's top is at or below the current line's
  // bottom (1px tolerance for sub-pixel rounding). Each visual line carries
  // the logical-row index so we can drive the skeleton render after.
  type VisualLine = {
    chips: IndexedElement[];
    top: number;
    bottom: number;
    logicalRow: number;
    isEmptyDeck: boolean;
  };
  const visualLines: VisualLine[] = [];
  rows.forEach((row, rowIdx) => {
    if (row.length === 0) {
      // Empty deck between two lineBreaks. Synthesize a zero-height marker
      // line positioned just below the prior visual line so we can still
      // target it by Y. Real height comes from the row's wrapper gap.
      const prev = visualLines[visualLines.length - 1];
      const y = prev ? prev.bottom + 4 : rootRect.top + 4;
      visualLines.push({
        chips: [],
        top: y,
        bottom: y + 8,
        logicalRow: rowIdx,
        isEmptyDeck: true,
      });
      return;
    }
    let cur: VisualLine | null = null;
    for (const entry of row) {
      const r = rectByIndex.get(entry.index);
      if (!r) continue;
      if (!cur || r.top >= cur.bottom - 1) {
        cur = {
          chips: [entry],
          top: r.top,
          bottom: r.bottom,
          logicalRow: rowIdx,
          isEmptyDeck: false,
        };
        visualLines.push(cur);
      } else {
        cur.chips.push(entry);
        cur.top = Math.min(cur.top, r.top);
        cur.bottom = Math.max(cur.bottom, r.bottom);
      }
    }
  });

  if (visualLines.length === 0) {
    return { index: 0, rowIndex: 0 };
  }

  // Pick the visual line whose Y span contains the pointer, else nearest.
  let chosen: VisualLine | null = null;
  for (const line of visualLines) {
    if (pointerY >= line.top && pointerY <= line.bottom) {
      chosen = line;
      break;
    }
  }
  if (!chosen) {
    let bestLine: VisualLine | null = null;
    let bestDist = Infinity;
    for (const line of visualLines) {
      const center = (line.top + line.bottom) / 2;
      const d = Math.abs(pointerY - center);
      if (d < bestDist) {
        bestDist = d;
        bestLine = line;
      }
    }
    const lastLine = visualLines[visualLines.length - 1]!;
    const lastHeight = Math.max(lastLine.bottom - lastLine.top, 24);
    if (pointerY > lastLine.bottom + Math.max(12, lastHeight * 0.5)) {
      return { index: totalElements, rowIndex: null };
    }
    chosen = bestLine!;
  }

  if (chosen.isEmptyDeck) {
    // Drop into an empty deck between two lineBreaks.
    const prior = chosen.logicalRow > 0 ? rows[chosen.logicalRow - 1] : null;
    const insertAt =
      prior && prior.length > 0 ? prior[prior.length - 1]!.index + 1 : 0;
    return { index: insertAt, rowIndex: chosen.logicalRow };
  }

  // Non-lineBreak chips in THIS visual line form the seams. Within a visual
  // line a lineBreak (which is full-width) would be alone, handled below.
  const seams: Array<{ idx: number; left: number; right: number }> = [];
  for (const entry of chosen.chips) {
    if (entry.el.type === "lineBreak") continue;
    const r = rectByIndex.get(entry.index);
    if (!r) continue;
    seams.push({ idx: entry.index, left: r.left, right: r.right });
  }
  if (seams.length === 0) {
    // Visual line is a lone lineBreak chip. Insert before it = end of the
    // deck above it.
    const lb = chosen.chips[0]!;
    return { index: lb.index, rowIndex: chosen.logicalRow };
  }
  seams.sort((a, b) => a.left - b.left);

  // Seam k (0..seams.length): position relative to seams.
  //   k=0       → before first chip in line → flat index = seams[0].idx
  //   1..n-1    → between chip k-1 and chip k → flat index = seams[k].idx
  //   k=n       → after last chip in line  → flat index = seams[n-1].idx + 1
  let bestSeam = 0;
  let bestDist = Math.abs(pointerX - seams[0]!.left);
  for (let k = 1; k < seams.length; k++) {
    const seamX = (seams[k - 1]!.right + seams[k]!.left) / 2;
    const dist = Math.abs(pointerX - seamX);
    if (dist < bestDist) {
      bestDist = dist;
      bestSeam = k;
    }
  }
  const trailingX = seams[seams.length - 1]!.right;
  const trailingDist = Math.abs(pointerX - trailingX);
  if (trailingDist < bestDist) {
    bestSeam = seams.length;
  }

  const insertAt =
    bestSeam < seams.length
      ? seams[bestSeam]!.idx
      : seams[seams.length - 1]!.idx + 1;
  return { index: insertAt, rowIndex: chosen.logicalRow };
}

export function StatuslineCanvas() {
  const elements = useDesignStore((s) => s.design.elements);
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: CANVAS_ROOT_DROPPABLE,
  });
  const { pending } = useInsertionPreview();

  const rootRef = useRef<HTMLDivElement | null>(null);

  const sortableIds = elements.map((el) => canvasDragId(el.id));
  const empty = elements.length === 0;
  const rows = splitIntoRows(elements);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      setDroppableRef(node);
    },
    [setDroppableRef],
  );

  // Reads the latest layout each call — no need to invalidate on every chip
  // mutation since `getBoundingClientRect` is always live.
  const resolver = useCallback<InsertionResolver>(
    (x, y) => {
      const root = rootRef.current;
      if (!root) return null;
      return resolveInsertion(root, rows, elements.length, x, y);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, elements.length],
  );
  useRegisterInsertionResolver(resolver);

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
          ref={setRootRef}
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
          ) : empty && pending ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <SkeletonChip type={pending.type} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row, rowIdx) => {
                const showSkeletonInRow =
                  pending !== null && pending.rowIndex === rowIdx;
                // The seam can resolve to (a) a flat index that matches some
                // chip in this row (skeleton before that chip), or (b) the
                // slot just after the row's last chip (skeleton at row end).
                const skeletonBeforeIdx = showSkeletonInRow
                  ? row.find((entry) => entry.index === pending!.index)?.index
                  : undefined;
                const skeletonAtRowEnd =
                  showSkeletonInRow && skeletonBeforeIdx === undefined;

                return (
                  <div
                    key={
                      row.length > 0 ? row[0]!.el.id : `__row_${rowIdx}_empty`
                    }
                    className="flex flex-wrap items-center gap-2"
                  >
                    {row.length === 0 && showSkeletonInRow ? (
                      <SkeletonChip type={pending!.type} />
                    ) : null}
                    {row.map(({ el, index }) => (
                      <Fragment key={el.id}>
                        {showSkeletonInRow && skeletonBeforeIdx === index ? (
                          <SkeletonChip type={pending!.type} />
                        ) : null}
                        <ElementChip element={el} />
                      </Fragment>
                    ))}
                    {skeletonAtRowEnd ? (
                      <SkeletonChip type={pending!.type} />
                    ) : null}
                  </div>
                );
              })}
              {pending && pending.rowIndex === null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <SkeletonChip type={pending.type} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
