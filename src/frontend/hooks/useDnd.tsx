import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  type DragMoveEvent,
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
 * at on drop, in [0, elements.length]. `rowIndex` is which visual row (0-based,
 * counting from the top deck) the skeleton should render inside; `null` means
 * "append below the last row in a new strip" (used only for drops past the
 * vertical end of the canvas, never for inline drops at the end of a row).
 */
export interface PendingInsert {
  type: ElementType;
  index: number;
  rowIndex: number | null;
}

/**
 * Result returned by a canvas-registered pointer→index resolver.
 * `index` is the flat-array slot; `rowIndex` is the visual deck the
 * skeleton belongs to (null = trailing new deck).
 */
export interface InsertionResolution {
  index: number;
  rowIndex: number | null;
}

export type InsertionResolver = (
  pointerX: number,
  pointerY: number,
) => InsertionResolution | null;

interface InsertionPreviewValue {
  pending: PendingInsert | null;
  registerResolver(resolver: InsertionResolver | null): () => void;
}

const InsertionPreviewContext = createContext<InsertionPreviewValue>({
  pending: null,
  registerResolver: () => () => {},
});

/**
 * Subscribe to the shared insertion-preview state. Both `StatuslineCanvas`
 * and `LivePreview` use this to render the same skeleton marker so a drop
 * over either surface gives consistent placement feedback.
 */
export function useInsertionPreview(): {
  pending: PendingInsert | null;
} {
  const ctx = useContext(InsertionPreviewContext);
  return { pending: ctx.pending };
}

/**
 * Surfaces (canvas, live preview) register a pointer→insertion-index resolver
 * here. The provider calls every registered resolver on each drag move using
 * the live cursor position derived from the activator event + delta; the first
 * resolver to return a non-null result wins. Resolvers must return null when
 * the pointer is outside their surface so others get a chance. This bypasses
 * dnd-kit's collision-based side computation, which is rect-of-dragged-item
 * driven and misfires for wide chips, multi-row layouts, and fast cross-row
 * drags.
 */
export function useRegisterInsertionResolver(resolver: InsertionResolver | null): void {
  const { registerResolver } = useContext(InsertionPreviewContext);
  useEffect(() => {
    if (!resolver) return;
    const cleanup = registerResolver(resolver);
    return cleanup;
  }, [resolver, registerResolver]);
}

/**
 * Fallback pointer reconstruction from dnd-kit's activator + delta. Only used
 * before the first live pointermove has fired (the brief window between
 * onDragStart and the next pointermove). `delta` is `scrollAdjustedTranslate`
 * — translate plus the scroll delta of the active node's scrollable ancestors
 * — so this value can be off by tens of pixels when a scrolled palette
 * <aside> is the active node's ancestor and `scrollableAncestors` flips as
 * the cursor crosses droppable boundaries. The live pointer tracker
 * (`livePointerRef` in DndProvider) is the authoritative source once a move
 * has happened.
 */
function getPointerFromEvent(
  activatorEvent: Event | null,
  delta: { x: number; y: number },
): { x: number; y: number } | null {
  if (!activatorEvent) return null;
  let startX: number | null = null;
  let startY: number | null = null;
  if ("clientX" in activatorEvent && "clientY" in activatorEvent) {
    const e = activatorEvent as MouseEvent;
    if (typeof e.clientX === "number" && typeof e.clientY === "number") {
      startX = e.clientX;
      startY = e.clientY;
    }
  } else if ("touches" in activatorEvent) {
    const t = (activatorEvent as TouchEvent).touches?.[0];
    if (t) {
      startX = t.clientX;
      startY = t.clientY;
    }
  }
  if (startX === null || startY === null) return null;
  return { x: startX + delta.x, y: startY + delta.y };
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
  const pendingRef = useRef<PendingInsert | null>(null);
  // Multiple surfaces (canvas + live preview) can each register their own
  // pointer-aware resolver. The first non-null result wins. Surfaces are
  // expected to return null when the pointer is outside their bounds, so
  // overlap in iteration order does not matter in practice.
  const resolversRef = useRef<Set<InsertionResolver>>(new Set());
  const rafRef = useRef<number | null>(null);
  // Authoritative pointer position during a drag. Tracked via a window-level
  // pointermove listener installed at dragStart and torn down at dragEnd. We
  // do NOT derive the pointer from dnd-kit's `event.delta` because that value
  // is `scrollAdjustedTranslate`, which adds the scroll delta of the active
  // node's scrollable ancestors. The palette is rendered inside a scrollable
  // <aside>; when the cursor crosses between the palette and the canvas
  // during a drag, `scrollableAncestors` flips and the scroll-adjustment
  // term spikes for a render, shifting our resolved drop index by the
  // palette's scrollTop. Reading clientX/clientY straight from the live
  // pointer event sidesteps the entire delta-arithmetic path.
  const livePointerRef = useRef<{ x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const registerResolver = useCallback<
    InsertionPreviewValue["registerResolver"]
  >((resolver) => {
    if (resolver) resolversRef.current.add(resolver);
    return () => {
      if (resolver) resolversRef.current.delete(resolver);
    };
  }, []);

  function runResolvers(pointer: { x: number; y: number } | null): InsertionResolution | null {
    if (!pointer) return null;
    for (const resolver of resolversRef.current) {
      const result = resolver(pointer.x, pointer.y);
      if (result) return result;
    }
    return null;
  }

  const previewValue = useMemo<InsertionPreviewValue>(
    () => ({ pending, registerResolver }),
    [pending, registerResolver],
  );

  function updatePending(next: PendingInsert | null) {
    pendingRef.current = next;
    setPending((prev) => {
      if (prev === next) return prev;
      if (prev === null || next === null) return next;
      if (
        prev.index === next.index &&
        prev.type === next.type &&
        prev.rowIndex === next.rowIndex
      ) {
        return prev;
      }
      return next;
    });
  }

  function clearPending() {
    if (pendingRef.current === null) return;
    pendingRef.current = null;
    setPending(null);
  }

  function handleDragStart(event: DragStartEvent): void {
    // Seed the live pointer with the activator coordinates so the very first
    // recompute (before any pointermove fires) has a non-null value to work
    // with. After the next move, the listener overwrites this with the real
    // viewport position.
    const activator = event.activatorEvent;
    if (activator && "clientX" in activator && "clientY" in activator) {
      const e = activator as MouseEvent;
      if (typeof e.clientX === "number" && typeof e.clientY === "number") {
        livePointerRef.current = { x: e.clientX, y: e.clientY };
      }
    }
    setActive(parseDragId(event.active.id as string));
  }

  /**
   * Pointer-driven side computation. Called on every move while a drag is
   * active. Both the canvas and the live-preview register pointer-aware
   * resolvers; the first one whose surface contains the pointer wins. The
   * over-id heuristic is a last-resort fallback for the rare case where
   * dnd-kit reports an over target but the pointer math fails (e.g. scroll
   * snapshot lag).
   *
   * `excludeId` is set for canvas-to-canvas drags so we can suppress the
   * skeleton at the dragged chip's own slot — inserting at `fromIdx` or
   * `fromIdx + 1` is a no-op, and rendering a placeholder right next to the
   * source chip just looks like a bug.
   */
  function recomputePending(
    type: ElementType,
    pointer: { x: number; y: number } | null,
    overId: string | number | null | undefined,
    excludeId: string | null,
  ): void {
    const els = useDesignStore.getState().design.elements;
    const fromIdx = excludeId
      ? els.findIndex((el) => el.id === excludeId)
      : -1;
    const isNoOp = (idx: number): boolean =>
      fromIdx !== -1 && (idx === fromIdx || idx === fromIdx + 1);

    // 1) Pointer-aware resolvers (the precise path).
    const resolved = runResolvers(pointer);
    if (resolved) {
      if (isNoOp(resolved.index)) {
        clearPending();
        return;
      }
      updatePending({ type, index: resolved.index, rowIndex: resolved.rowIndex });
      return;
    }

    // 2) Coarse over-id fallback only.
    if (typeof overId !== "string") {
      clearPending();
      return;
    }
    if (overId === CANVAS_ROOT_DROPPABLE || overId === PREVIEW_ROOT_DROPPABLE) {
      if (isNoOp(els.length)) {
        clearPending();
        return;
      }
      updatePending({ type, index: els.length, rowIndex: null });
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
    if (hovered < 0 || isNoOp(hovered)) {
      clearPending();
      return;
    }
    updatePending({ type, index: hovered, rowIndex: null });
  }

  function scheduleRecompute(event: DragMoveEvent | DragOverEvent): void {
    const activeId = event.active?.id;
    if (typeof activeId !== "string") {
      clearPending();
      return;
    }
    let type: ElementType | null = null;
    let excludeId: string | null = null;
    if (activeId.startsWith(PALETTE_PREFIX)) {
      type = activeId.slice(PALETTE_PREFIX.length) as ElementType;
    } else if (activeId.startsWith(CANVAS_PREFIX)) {
      const id = activeId.slice(CANVAS_PREFIX.length);
      const el = useDesignStore
        .getState()
        .design.elements.find((e) => e.id === id);
      if (el) {
        type = el.type;
        excludeId = id;
      }
    }
    if (!type) {
      clearPending();
      return;
    }
    const pointer =
      livePointerRef.current ??
      getPointerFromEvent(event.activatorEvent, event.delta);
    const overId = event.over?.id ?? null;
    const finalType = type;
    const finalExcludeId = excludeId;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recomputePending(finalType, pointer, overId, finalExcludeId);
    });
  }

  function handleDragMove(event: DragMoveEvent): void {
    scheduleRecompute(event);
  }

  function handleDragOver(event: DragOverEvent): void {
    scheduleRecompute(event);
  }

  function handleDragEnd(event: DragEndEvent): void {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const activeParsed = parseDragId(event.active.id as string);
    // Drain any pending recompute synchronously using the final event so the
    // drop index reflects the exact release position, not the last RAF tick.
    let dropPending = pendingRef.current;
    let finalResolved: InsertionResolution | null = null;
    if (activeParsed) {
      const pointer =
        livePointerRef.current ??
        getPointerFromEvent(event.activatorEvent, event.delta);
      finalResolved = runResolvers(pointer);
      if (finalResolved && activeParsed.kind === "palette") {
        dropPending = {
          type: activeParsed.type,
          index: finalResolved.index,
          rowIndex: finalResolved.rowIndex,
        };
      }
    }

    setActive(null);
    pendingRef.current = null;
    setPending(null);
    livePointerRef.current = null;

    if (!activeParsed) return;

    if (activeParsed.kind === "palette") {
      // Insert only when the drop happened over a surface RIGHT NOW: either
      // dnd-kit reports an over target, or one of our pointer resolvers
      // matched at the release coordinates. Without this, a stale pending
      // from earlier in the drag could cause a drop when the user released
      // outside any valid surface.
      if (dropPending && (event.over || finalResolved)) {
        addElementAt(activeParsed.type, dropPending.index);
      }
      return;
    }

    // Canvas-to-canvas reorder. Preview spans intentionally do NOT accept
    // chip reorders — that lives inside the SortableContext of the canvas.
    // Gate the resolver-driven path on `event.over` pointing at a canvas
    // surface; otherwise a chip dragged over the LivePreview's resolver
    // would silently trigger a reorder.
    const overId = typeof event.over?.id === "string" ? event.over.id : null;
    const overIsCanvas =
      overId !== null &&
      (overId === CANVAS_ROOT_DROPPABLE || overId.startsWith(CANVAS_PREFIX));
    if (!overIsCanvas) return;

    const els = useDesignStore.getState().design.elements;
    const fromIdx = els.findIndex((el) => el.id === activeParsed.id);
    if (fromIdx === -1) return;

    // Prefer the pointer resolver: it returns the SAME insertion index the
    // skeleton previewed, so the chip lands exactly where the user saw it.
    // The resolver index is into the pre-removal array, so translate it into
    // a post-removal target slot for `reorder`.
    if (finalResolved) {
      const rawIdx = finalResolved.index;
      if (rawIdx === fromIdx || rawIdx === fromIdx + 1) return;
      let toIdx = rawIdx > fromIdx ? rawIdx - 1 : rawIdx;
      toIdx = Math.max(0, Math.min(toIdx, els.length - 1));
      if (toIdx === fromIdx) return;
      reorder(fromIdx, toIdx);
      return;
    }

    // Fallback: dnd-kit's collision-based over-id. This path runs only when
    // the resolver couldn't place the pointer inside any registered surface
    // (e.g. release just outside the canvas with no live pointermove yet).
    const overParsed = parseDragId(overId);
    if (!overParsed || overParsed.kind !== "canvas") return;
    if (overParsed.id === activeParsed.id) return;
    const toIdx = els.findIndex((el) => el.id === overParsed.id);
    if (toIdx === -1) return;
    reorder(fromIdx, toIdx);
  }

  function handleDragCancel(): void {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActive(null);
    pendingRef.current = null;
    setPending(null);
    livePointerRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // While a drag is active, track the live pointer via a capture-phase
  // pointermove/pointerup listener on the window. Capture-phase runs before
  // dnd-kit's own document-bubble listener, so we always observe the
  // unmodified PointerEvent clientX/clientY. pointerup also updates the ref
  // so handleDragEnd sees the precise release position. See livePointerRef
  // declaration above for why we don't trust event.delta.
  useEffect(() => {
    if (!active) return;
    function onMove(e: PointerEvent) {
      livePointerRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onMove, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onMove, { capture: true });
    };
  }, [active]);

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
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <InsertionPreviewContext.Provider value={previewValue}>
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
 * preview to show where a palette item will land on drop. Renders at its
 * natural width immediately — no width animation. The earlier "slide-open"
 * effect caused neighbouring chip rects to keep shifting during a drag, which
 * made the seam math oscillate and the skeleton chase the cursor instead of
 * locking to it. A fade-in is kept (opacity only — no layout impact) so the
 * placeholder still feels like it appears rather than pops.
 */
export function SkeletonChip({ type }: { type: ElementType }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const Icon = ELEMENT_ICONS[type];
  const label = ELEMENT_LABELS[type] ?? type;

  // Line breaks render full-width in the canvas; the placeholder mirrors that
  // shape so the drop preview reads as the row divider it will become rather
  // than a tiny chip parked inside another row.
  if (type === "lineBreak") {
    return (
      <span
        aria-hidden="true"
        className="flex w-full items-center gap-2 px-2 py-1 rounded-[8px] border border-dashed border-[#8FB8DA]/60 bg-[#8FB8DA]/[0.07] text-[11px] text-[#8FB8DA] transition-opacity duration-150 ease-out"
        style={{ opacity: shown ? 1 : 0 }}
      >
        <Icon size={12} weight="bold" />
        <span className="font-medium uppercase tracking-wider">{label}</span>
        <span aria-hidden="true" className="flex-1 h-px bg-[#8FB8DA]/30" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[8px] border border-dashed border-[#8FB8DA]/60 bg-[#8FB8DA]/[0.07] text-[12px] text-[#8FB8DA] whitespace-nowrap align-middle transition-opacity duration-150 ease-out"
      style={{ opacity: shown ? 1 : 0 }}
    >
      <Icon size={13} weight="bold" />
      <span className="font-medium">{label}</span>
    </span>
  );
}
