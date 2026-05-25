import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Copy, Trash } from "@phosphor-icons/react";
import { useDesignStore } from "../../store/designStore";
import { useUiStore } from "../../store/uiStore";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { ClaudeStdin, Design, Element } from "@statusline/shared/types";
import {
  PREVIEW_ROOT_DROPPABLE,
  SkeletonChip,
  previewDropId,
  useInsertionPreview,
  useRegisterInsertionResolver,
  type InsertionResolver,
} from "../../hooks/useDnd";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "./AnsiToHtml";
import { MockStdinEditor } from "./MockStdinEditor";
import { ContextMenu } from "../ContextMenu/ContextMenu";

function parseMock(json: string): ClaudeStdin {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ClaudeStdin;
    }
  } catch {
    // fall through
  }
  return DEFAULT_MOCK_STDIN;
}

function singleElementDesign(d: Design, el: Element): Design {
  return { ...d, elements: [el] };
}

/**
 * Pointer-aware insertion resolver for the mock-terminal surface. Mirrors the
 * canvas algorithm: group rendered spans into visual lines by Y, find the line
 * containing the pointer (or nearest), then closest-seam math in X. Returns
 * the element index where a new chip should be spliced. `rowIndex` is null
 * because the preview render path ignores it.
 */
function resolvePreviewInsertion(
  rootEl: HTMLElement,
  pieces: ReadonlyArray<{ id: string; ansi: string }>,
  pointerX: number,
  pointerY: number,
): { index: number; rowIndex: number | null } | null {
  const rootRect = rootEl.getBoundingClientRect();
  const bleed = 6;
  const inside =
    pointerX >= rootRect.left - bleed &&
    pointerX <= rootRect.right + bleed &&
    pointerY >= rootRect.top - bleed &&
    pointerY <= rootRect.bottom + bleed;
  if (!inside) return null;

  if (pieces.length === 0) return { index: 0, rowIndex: null };

  // Build id → rect once. Spans missing from the DOM (empty ansi) are skipped.
  const nodes = rootEl.querySelectorAll<HTMLElement>("[data-preview-id]");
  const rectById = new Map<string, DOMRect>();
  nodes.forEach((node) => {
    const id = node.dataset["previewId"];
    if (id) rectById.set(id, node.getBoundingClientRect());
  });

  type Sp = {
    pieceIdx: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  const spans: Sp[] = [];
  pieces.forEach((p, i) => {
    const r = rectById.get(p.id);
    if (!r) return;
    spans.push({
      pieceIdx: i,
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
    });
  });

  if (spans.length === 0) return { index: pieces.length, rowIndex: null };

  // Visual-line grouping. Common case: one line. Multi-line covers terminals
  // that wrap or contain a literal newline in the rendered output.
  type Line = { spans: Sp[]; top: number; bottom: number };
  const lines: Line[] = [];
  let cur: Line | null = null;
  for (const s of spans) {
    if (!cur || s.top >= cur.bottom - 1) {
      cur = { spans: [s], top: s.top, bottom: s.bottom };
      lines.push(cur);
    } else {
      cur.spans.push(s);
      cur.top = Math.min(cur.top, s.top);
      cur.bottom = Math.max(cur.bottom, s.bottom);
    }
  }

  let chosen: Line | null = null;
  for (const line of lines) {
    if (pointerY >= line.top && pointerY <= line.bottom) {
      chosen = line;
      break;
    }
  }
  if (!chosen) {
    let bestDist = Infinity;
    for (const line of lines) {
      const c = (line.top + line.bottom) / 2;
      const d = Math.abs(pointerY - c);
      if (d < bestDist) {
        bestDist = d;
        chosen = line;
      }
    }
    if (!chosen) return { index: pieces.length, rowIndex: null };
    const last = lines[lines.length - 1]!;
    const lastHeight = Math.max(last.bottom - last.top, 16);
    if (pointerY > last.bottom + Math.max(8, lastHeight * 0.5)) {
      return { index: pieces.length, rowIndex: null };
    }
  }

  const seams = chosen.spans.slice().sort((a, b) => a.left - b.left);
  let bestSeam = 0;
  let bestDist = Math.abs(pointerX - seams[0]!.left);
  for (let k = 1; k < seams.length; k++) {
    const seamX = (seams[k - 1]!.right + seams[k]!.left) / 2;
    const d = Math.abs(pointerX - seamX);
    if (d < bestDist) {
      bestDist = d;
      bestSeam = k;
    }
  }
  const trailingX = seams[seams.length - 1]!.right;
  const trailingDist = Math.abs(pointerX - trailingX);
  if (trailingDist < bestDist) bestSeam = seams.length;

  const insertAt =
    bestSeam < seams.length
      ? seams[bestSeam]!.pieceIdx
      : seams[seams.length - 1]!.pieceIdx + 1;
  return { index: insertAt, rowIndex: null };
}

interface PreviewSpanProps {
  id: string;
  ansi: string;
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (clientX: number, clientY: number) => void;
}

/**
 * One rendered element inside the mock terminal. Registered as a droppable
 * so palette drags can compute insertion side relative to its rect — the
 * preview now feels just like the canvas as a drop target.
 */
function PreviewSpan({
  id,
  ansi,
  isSelected,
  onSelect,
  onContextMenu,
}: PreviewSpanProps) {
  const { setNodeRef } = useDroppable({ id: previewDropId(id) });
  return (
    <span
      ref={setNodeRef}
      data-preview-id={id}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY);
      }}
      title="Click to select · Right-click for actions"
      className={`cursor-pointer rounded-sm transition-colors ${
        isSelected
          ? "outline outline-1 outline-[#8FB8DA]/70 bg-[#8FB8DA]/[0.06]"
          : "hover:bg-white/[0.04]"
      }`}
    >
      <AnsiToHtml ansi={ansi} />
    </span>
  );
}

export function LivePreview() {
  const design = useDesignStore((s) => s.design);
  const selectedId = useDesignStore((s) => s.selectedId);
  const select = useDesignStore((s) => s.select);
  const duplicateElement = useDesignStore((s) => s.duplicateElement);
  const removeElement = useDesignStore((s) => s.removeElement);
  const mockStdinJson = useUiStore((s) => s.mockStdinJson);
  const { pending } = useInsertionPreview();
  const { setNodeRef: setDroppableRootRef } = useDroppable({
    id: PREVIEW_ROOT_DROPPABLE,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      setDroppableRootRef(node);
    },
    [setDroppableRootRef],
  );

  const [menu, setMenu] = useState<{
    elementId: string;
    x: number;
    y: number;
  } | null>(null);

  const hasRotator = useMemo(
    () => design.elements.some((e) => e.type === "rotator"),
    [design.elements],
  );

  const minInterval = useMemo(() => {
    let m = Infinity;
    for (const el of design.elements) {
      if (el.type === "rotator" && el.pickMode === "cycle") {
        m = Math.min(m, el.intervalSeconds);
      } else if (el.type === "rotator" && el.pickMode === "random") {
        m = Math.min(m, 1);
      }
    }
    return Number.isFinite(m) ? Math.max(1, m as number) : 0;
  }, [design.elements]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasRotator || minInterval === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), minInterval * 1000);
    return () => clearInterval(id);
  }, [hasRotator, minInterval]);

  const pieces = useMemo(() => {
    const mock = parseMock(mockStdinJson);
    return design.elements.map((el) => {
      try {
        return { id: el.id, ansi: renderToAnsi(singleElementDesign(design, el), mock) };
      } catch (e) {
        return {
          id: el.id,
          ansi: `[err: ${e instanceof Error ? e.message : String(e)}]`,
        };
      }
    });
    // tick intentionally included so the memo re-runs each rotator tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, mockStdinJson, tick]);

  const resolver = useCallback<InsertionResolver>(
    (x, y) => {
      const root = rootRef.current;
      if (!root) return null;
      return resolvePreviewInsertion(root, pieces, x, y);
    },
    [pieces],
  );
  useRegisterInsertionResolver(resolver);

  const empty = pieces.every((p) => p.ansi.length === 0) && !pending;

  return (
    <div>
      <TerminalFrame>
        <div ref={setRootRef} className="block min-h-[1.5em]">
          {empty ? (
            <span className="text-[#8A8A86] italic">
              Add elements to build your statusline.
            </span>
          ) : (
            <div className="font-mono whitespace-pre leading-tight">
              {pieces.map((p, i) => {
                const showSkelHere = pending?.index === i;
                if (p.ansi.length === 0) {
                  return showSkelHere ? (
                    <SkeletonChip key={p.id} type={pending!.type} />
                  ) : null;
                }
                return (
                  <Fragment key={p.id}>
                    {showSkelHere ? <SkeletonChip type={pending!.type} /> : null}
                    <PreviewSpan
                      id={p.id}
                      ansi={p.ansi}
                      isSelected={selectedId === p.id}
                      onSelect={() => select(p.id)}
                      onContextMenu={(x, y) =>
                        setMenu({ elementId: p.id, x, y })
                      }
                    />
                  </Fragment>
                );
              })}
              {pending && pending.index >= pieces.length ? (
                <SkeletonChip type={pending.type} />
              ) : null}
            </div>
          )}
        </div>
      </TerminalFrame>
      <MockStdinEditor />

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Duplicate",
              Icon: Copy,
              onSelect: () => duplicateElement(menu.elementId),
            },
            {
              label: "Delete",
              Icon: Trash,
              destructive: true,
              onSelect: () => removeElement(menu.elementId),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
