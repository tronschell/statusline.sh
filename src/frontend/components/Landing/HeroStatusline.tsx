import { useEffect, useMemo, useRef, useState } from "react";
import { CaretRight, Pause, Play } from "@phosphor-icons/react";
import { renderToAnsi } from "../../../compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "../../../shared/mockStdin";
import { getTemplate } from "../../../shared/templates";
import type {
  AnsiStyle,
  Design,
  Element,
  TemplateMeta,
} from "../../../shared/types";
import { goToBuilder } from "../../lib/navigate";
import { useAnimatedMock } from "../../hooks/useAnimatedMock";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import { TerminalFrame } from "../Layout/TerminalFrame";

const TICK_MS = 1400;
const MORPH_FADE_MS = 520;
// Every Nth tick, shuffle the entire element order instead of morphing a single
// slot. ~5 → roughly every 7s the bar fully rearranges.
const SHUFFLE_EVERY = 5;

// Variant pools per slot. Each variant is a partial Element merged on top of
// the verbose-dev baseline element with the same id, so the surrounding
// elements stay stable while one slot mutates in place.
type Slot =
  | "vd_model"
  | "vd_dir"
  | "vd_branch"
  | "vd_la"
  | "vd_lr"
  | "vd_bar"
  | "vd_cost"
  | "vd_dur";

type Variant = Partial<Element> & { style?: AnsiStyle };

const VARIANTS: Record<Slot, Variant[]> = {
  vd_model: [
    { style: { bold: true, fg: { kind: "ansi16", index: 14 } }, suffix: " " },
    { style: { bold: true, fg: { kind: "ansi16", index: 13 } }, suffix: " " },
    { style: { bold: true, fg: { kind: "ansi16", index: 11 } }, suffix: " " },
    { style: { dim: true, fg: { kind: "ansi16", index: 15 } }, suffix: " · " },
  ],
  vd_dir: [
    { style: { fg: { kind: "ansi16", index: 7 } }, suffix: " " },
    { style: { italic: true, fg: { kind: "ansi16", index: 15 } }, suffix: " " },
    { style: { dim: true, fg: { kind: "ansi16", index: 8 } }, suffix: " " },
  ],
  vd_branch: [
    {
      style: { italic: true, fg: { kind: "ansi16", index: 13 } },
      prefix: " ",
      suffix: " ",
    },
    {
      style: { bold: true, fg: { kind: "ansi16", index: 10 } },
      prefix: " ",
      suffix: " ",
    },
    {
      style: { italic: true, fg: { kind: "ansi16", index: 11 } },
      prefix: "(",
      suffix: ") ",
    },
  ],
  vd_la: [
    { style: { fg: { kind: "ansi16", index: 10 } }, prefix: "+", suffix: " " },
    { style: { bold: true, fg: { kind: "ansi16", index: 10 } }, prefix: "▲", suffix: " " },
    { style: { fg: { kind: "ansi16", index: 10 } }, prefix: "+", suffix: "/" },
  ],
  vd_lr: [
    { style: { fg: { kind: "ansi16", index: 9 } }, prefix: "-", suffix: " " },
    { style: { bold: true, fg: { kind: "ansi16", index: 9 } }, prefix: "▼", suffix: " " },
    { style: { fg: { kind: "ansi16", index: 9 } }, prefix: "-", suffix: " " },
  ],
  vd_bar: [
    {
      style: { fg: { kind: "ansi16", index: 11 } },
      prefix: "[",
      suffix: "] ",
    },
    {
      style: { fg: { kind: "ansi16", index: 14 } },
      prefix: "▏",
      suffix: "▕ ",
    },
    {
      style: { fg: { kind: "ansi16", index: 10 } },
      prefix: "⟨",
      suffix: "⟩ ",
    },
  ],
  vd_cost: [
    { style: { fg: { kind: "ansi16", index: 3 } }, suffix: " " },
    { style: { fg: { kind: "ansi16", index: 11 } }, prefix: "$", suffix: " " },
    { style: { dim: true, fg: { kind: "ansi16", index: 7 } }, prefix: "$", suffix: " " },
  ],
  vd_dur: [
    { style: { dim: true, fg: { kind: "ansi16", index: 8 } } },
    { style: { italic: true, fg: { kind: "ansi16", index: 8 } } },
    { style: { dim: true, fg: { kind: "ansi16", index: 15 } } },
  ],
};

const SLOTS = Object.keys(VARIANTS) as Slot[];

const BASELINE: Design = (() => {
  const tpl: TemplateMeta | undefined = getTemplate("verbose-dev");
  if (!tpl) {
    // Defensive: should never fire — verbose-dev is shipped in TEMPLATES.
    return { version: 1, name: "Verbose Dev", elements: [] };
  }
  return structuredClone(tpl.design);
})();

function applyOverrides(
  base: Design,
  overrides: Partial<Record<Slot, Variant>>,
): Design {
  return {
    ...base,
    elements: base.elements.map((el) => {
      const slot = el.id as Slot;
      const ov = overrides[slot];
      if (!ov) return el;
      // Merge top-level fields (style/prefix/suffix). Cast keeps type narrow.
      return { ...el, ...ov, style: ov.style ?? el.style } as Element;
    }),
  };
}

function pickRandom<T>(items: ReadonlyArray<T>, exclude?: T): T {
  if (items.length === 1) return items[0]!;
  for (let i = 0; i < 6; i++) {
    const c = items[Math.floor(Math.random() * items.length)]!;
    if (c !== exclude) return c;
  }
  return items[0]!;
}

function shuffled<T>(arr: ReadonlyArray<T>): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function reshuffleOrder(prev: ReadonlyArray<string>): string[] {
  if (prev.length < 2) return prev.slice();
  // Try a few Fisher–Yates passes until the result actually differs from prev,
  // so a tick visibly rearranges. Falls back to a guaranteed swap of two
  // distinct indices.
  for (let attempt = 0; attempt < 4; attempt++) {
    const next = shuffled(prev);
    if (next.some((id, i) => id !== prev[i])) return next;
  }
  const next = prev.slice();
  const i = Math.floor(Math.random() * next.length);
  let j = Math.floor(Math.random() * next.length);
  while (j === i) j = Math.floor(Math.random() * next.length);
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}

/**
 * Verbose-Dev baseline that mutates one slot at a time on a fixed cadence.
 *
 * Each element is rendered separately so React can keep stable identity per
 * slot. When a slot's variant changes its `sig` flips, the keyed wrapper
 * remounts, and only THAT slot plays the swipe-down. Slots that didn't
 * change stay perfectly still — no re-animation of the whole bar.
 */
export function HeroStatusline() {
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [overrides, setOverrides] = useState<Partial<Record<Slot, Variant>>>(
    () => ({}),
  );
  const [lastSlot, setLastSlot] = useState<Slot | null>(null);
  const [order, setOrder] = useState<string[]>(() =>
    BASELINE.elements.map((e) => e.id),
  );
  // Bumped on every shuffle so all slot keys flip and React replays the
  // swipe-down on each element (not just the morphed one).
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const tickCountRef = useRef(0);

  const paused = isHovered || isPaused;
  const mock = useAnimatedMock({
    baseline: DEFAULT_MOCK_STDIN,
    paused,
    durationMs: 6000,
  });

  // Periodically morph one slot, and every SHUFFLE_EVERY-th tick reorder the
  // whole bar instead.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      tickCountRef.current += 1;
      if (tickCountRef.current % SHUFFLE_EVERY === 0) {
        setOrder((prev) => reshuffleOrder(prev));
        setShuffleNonce((n) => n + 1);
        setLastSlot(null);
        return;
      }
      setOverrides((prev) => {
        const slot = pickRandom(SLOTS, lastSlot ?? undefined);
        const currentVariant = prev[slot];
        const variant = pickRandom(VARIANTS[slot], currentVariant);
        setLastSlot(slot);
        return { ...prev, [slot]: variant };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused, lastSlot]);

  const design = useMemo(
    () => applyOverrides(BASELINE, overrides),
    [overrides],
  );

  // Render each element individually so per-slot remounts only re-animate
  // the changed piece. `sig` captures the merged element struct (style,
  // prefix, suffix, ...), so mock-only data changes don't flip the key.
  // Elements are emitted in `order`, which the shuffle tick rotates.
  const slotRenders = useMemo(() => {
    const byId = new Map(design.elements.map((el) => [el.id, el] as const));
    const out: { id: string; sig: string; ansi: string }[] = [];
    for (const id of order) {
      const el = byId.get(id);
      if (!el) continue;
      const sig = JSON.stringify(el);
      const subDesign: Design = { ...design, elements: [el] };
      out.push({ id: el.id, sig, ansi: safeRender(subDesign, mock) });
    }
    return out;
  }, [design, mock, order]);

  const onUseTemplate = () => {
    goToBuilder({ templateId: "verbose-dev" });
  };

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TerminalFrame className="w-full">
        <div className="relative h-[1.5em] overflow-hidden whitespace-nowrap">
          {slotRenders.map(({ id, sig, ansi }) => (
            <span
              key={`${id}-${sig}-${shuffleNonce}`}
              className="slot-swipe inline-block align-baseline"
              style={{ animationDuration: `${MORPH_FADE_MS}ms` }}
            >
              <AnsiToHtml ansi={ansi} />
            </span>
          ))}
        </div>
      </TerminalFrame>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[12px] text-[#8A8A86]">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            aria-label={isPaused ? "Resume morphing" : "Pause morphing"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8A8A86]/70 hover:text-[#E8E8E6] hover:bg-white/[0.04] transition-colors"
          >
            {isPaused ? (
              <Play size={11} weight="fill" />
            ) : (
              <Pause size={11} weight="fill" />
            )}
          </button>
          <span>
            <span className="text-[#E8E8E6]/80">Verbose Dev</span>
            <span className="ml-2 text-[#8A8A86]/60">
              {isPaused ? "(paused)" : "morphing live"}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onUseTemplate}
          className="inline-flex items-center gap-1 text-[13px] text-[#E8E8E6]/85 hover:text-[#E8E8E6] transition-colors"
        >
          Use this template
          <CaretRight size={12} weight="bold" />
        </button>
      </div>

      <style>{`
        @keyframes slot-swipe-down {
          0% {
            transform: translateY(-140%) scaleY(1.8);
            opacity: 0;
            filter: blur(8px);
          }
          35% {
            filter: blur(5px);
            opacity: 0.85;
          }
          70% {
            filter: blur(1.5px);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scaleY(1);
            opacity: 1;
            filter: blur(0);
          }
        }
        .slot-swipe {
          transform-origin: top center;
          animation-name: slot-swipe-down;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          animation-fill-mode: both;
          will-change: transform, opacity, filter;
        }
      `}</style>
    </div>
  );
}

function safeRender(design: Design, mock: typeof DEFAULT_MOCK_STDIN): string {
  try {
    return renderToAnsi(design, mock);
  } catch (e) {
    return `[render error: ${e instanceof Error ? e.message : String(e)}]`;
  }
}
