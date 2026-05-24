import { Fragment, useEffect, useMemo, useState } from "react";
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
  const { setNodeRef: setRootRef } = useDroppable({ id: PREVIEW_ROOT_DROPPABLE });

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
            <span className="font-mono whitespace-pre">
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
            </span>
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
