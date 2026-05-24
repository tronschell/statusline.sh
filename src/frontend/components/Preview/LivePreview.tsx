import { useEffect, useMemo, useState } from "react";
import { useDesignStore } from "../../store/designStore";
import { useUiStore } from "../../store/uiStore";
import { renderToAnsi } from "../../../compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "../../../shared/mockStdin";
import type { ClaudeStdin, Design, Element } from "../../../shared/types";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "./AnsiToHtml";
import { MockStdinEditor } from "./MockStdinEditor";

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

export function LivePreview() {
  const design = useDesignStore((s) => s.design);
  const selectedId = useDesignStore((s) => s.selectedId);
  const select = useDesignStore((s) => s.select);
  const mockStdinJson = useUiStore((s) => s.mockStdinJson);

  const hasRotator = useMemo(
    () => design.elements.some((e) => e.type === "rotator"),
    [design.elements],
  );

  // Lightweight ticker: only runs while a rotator exists. Bumping `tick`
  // forces the memo below to recompute, which re-evaluates the rotator's
  // clock-driven index. Min interval across rotators caps refresh rate.
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

  const empty = pieces.every((p) => p.ansi.length === 0);

  return (
    <div>
      <TerminalFrame>
        {empty ? (
          <span className="text-[#8A8A86] italic">
            Add elements to build your statusline.
          </span>
        ) : (
          <span className="font-mono whitespace-pre">
            {pieces.map((p) => {
              if (p.ansi.length === 0) return null;
              const isSelected = selectedId === p.id;
              return (
                <span
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(p.id);
                    }
                  }}
                  title="Click to select element"
                  className={`cursor-pointer rounded-sm transition-colors ${
                    isSelected
                      ? "outline outline-1 outline-[#8FB8DA]/70 bg-[#8FB8DA]/[0.06]"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <AnsiToHtml ansi={p.ansi} />
                </span>
              );
            })}
          </span>
        )}
      </TerminalFrame>
      <MockStdinEditor />
    </div>
  );
}
