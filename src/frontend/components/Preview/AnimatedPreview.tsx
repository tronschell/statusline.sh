import { useEffect, useRef, useState } from "react";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { Design } from "@statusline/shared/types";
import { galleryMock } from "../../../shared/animatedMocks";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "./AnsiToHtml";

export interface AnimatedPreviewProps {
  design: Design;
  className?: string;
  /**
   * Per-card offset so adjacent template cards don't tick on the exact same
   * frame. Pass a stable value (e.g. the card index times 137ms).
   */
  startOffsetMs?: number;
  /** rough render cap — defaults to ~12fps which is plenty for a status bar. */
  frameIntervalMs?: number;
}

/**
 * Looping preview that pauses when offscreen, hidden, or the user prefers
 * reduced motion. Animates `galleryMock` through branch / model / mode
 * rotations and a sine-tweened context bar.
 *
 * Rendering cost: one renderToAnsi + one AnsiToHtml parse per visible card
 * per frame. At the default 80ms throttle and 14 cards that's ~175 renders/s
 * worst-case (all in viewport). IntersectionObserver keeps offscreen cards
 * idle, so the steady-state cost as the user scrolls is usually 2-4 cards.
 */
export function AnimatedPreview({
  design,
  className,
  startOffsetMs = 0,
  frameIntervalMs = 80,
}: AnimatedPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ansi, setAnsi] = useState<string>(() =>
    safeRender(design, galleryMock(DEFAULT_MOCK_STDIN, startOffsetMs)),
  );

  // Pause flags: each component independently sets one of these refs based on
  // browser state, then the tick loop ANDs them together to decide whether to
  // advance `t`. Keeping them as refs avoids re-renders / loop restarts.
  const visibleRef = useRef(false);
  const docVisibleRef =
    useRef(typeof document === "undefined" || !document.hidden);
  const reducedMotionRef = useRef(false);
  const designRef = useRef(design);
  designRef.current = design;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    reducedMotionRef.current = mq.matches;
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    // Some legacy browsers use addListener / removeListener.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener?.(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener?.(onChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      docVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === "undefined") {
      visibleRef.current = true;
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === host) visibleRef.current = e.isIntersecting;
        }
      },
      { threshold: 0.05 },
    );
    io.observe(host);
    return () => io.disconnect();
  }, []);

  // rAF tick loop. Started once on mount; refs above control whether to
  // advance / re-render each tick.
  useEffect(() => {
    let rafId = 0;
    let cancelled = false;
    let elapsed = startOffsetMs;
    let lastNow: number | null = null;
    let lastEmit = 0;

    const raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb: FrameRequestCallback): number =>
            setTimeout(() => cb(Date.now()), 16) as unknown as number;
    const caf =
      typeof cancelAnimationFrame !== "undefined"
        ? cancelAnimationFrame
        : (id: number): void =>
            clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = lastNow == null ? 0 : Math.max(0, now - lastNow);
      lastNow = now;

      const shouldAdvance =
        visibleRef.current && docVisibleRef.current && !reducedMotionRef.current;
      if (shouldAdvance) elapsed += dt;

      if (shouldAdvance && now - lastEmit >= frameIntervalMs) {
        lastEmit = now;
        setAnsi(safeRender(designRef.current, galleryMock(DEFAULT_MOCK_STDIN, elapsed)));
      }
      rafId = raf(tick);
    };
    rafId = raf(tick);
    return () => {
      cancelled = true;
      caf(rafId);
    };
  }, [startOffsetMs, frameIntervalMs]);

  // Whenever the design itself changes (e.g. parent passes a new template),
  // immediately re-render at the current elapsed time. Cheap, no rAF needed.
  useEffect(() => {
    setAnsi(safeRender(design, galleryMock(DEFAULT_MOCK_STDIN, startOffsetMs)));
    // We only need this to trigger on design changes; startOffsetMs is stable
    // and intentionally excluded so it doesn't cause a flash on every card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  return (
    <div ref={hostRef}>
      <TerminalFrame className={className}>
        <div className="whitespace-pre">
          <AnsiToHtml ansi={ansi} />
        </div>
      </TerminalFrame>
    </div>
  );
}

function safeRender(
  design: Design,
  mock: typeof DEFAULT_MOCK_STDIN,
): string {
  try {
    return renderToAnsi(design, mock);
  } catch (e) {
    return `[render error: ${e instanceof Error ? e.message : String(e)}]`;
  }
}
