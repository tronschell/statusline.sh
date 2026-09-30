import { useEffect, useMemo, useRef, useState } from "react";
import { CaretRight, Pause, Play } from "@phosphor-icons/react";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import { getTemplate } from "@statusline/shared/templates";
import type { Design, TemplateMeta } from "@statusline/shared/types";
import { goToBuilder } from "../../lib/navigate";
import { useAnimatedMock } from "../../hooks/useAnimatedMock";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import { TerminalFrame } from "../Layout/TerminalFrame";

// How long each example holds on screen before it swipes away, plus the two
// transition phase durations. EXIT_MS / ENTER_MS must match the CSS animation
// durations below or the swap will flash.
const DWELL_MS = 4200;
const EXIT_MS = 560;
const ENTER_MS = 460;

// Curated rotation of shipped templates. verbose-dev leads (it's the one the
// hero used to be stuck on); the list deliberately mixes single-line and
// multi-line (two-line-cockpit, triptych) designs so the swipe handles both.
const CYCLE_TEMPLATE_IDS = [
  "verbose-dev",
  "pastel-dashboard",
  "two-line-cockpit",
  "neon-pulse",
  "triptych",
  "powerline",
] as const;

type Phase = "idle" | "exiting" | "entering";

/**
 * Hero terminal that cycles through example templates.
 *
 * Each example renders live (the mock data drifts via `useAnimatedMock`), and
 * on a fixed cadence the whole bar swipes off to the right, then the next
 * template fades in. Multi-line templates are handled natively: the rendered
 * ANSI keeps its newlines and `whitespace-pre` lays them out, while the stage
 * reserves a stable min-height so the frame doesn't jump between 1- and
 * 2-line designs.
 */
export function HeroStatusline() {
  const templates = useMemo(
    () =>
      CYCLE_TEMPLATE_IDS.map((id) => getTemplate(id)).filter(
        (t): t is TemplateMeta => Boolean(t),
      ),
    [],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Honor prefers-reduced-motion: treat it exactly like a manual pause so both
  // the auto-cycle state machine and the live mock drift freeze.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const paused = isHovered || isPaused || reducedMotion;
  const mock = useAnimatedMock({
    baseline: DEFAULT_MOCK_STDIN,
    paused,
    durationMs: 6000,
  });

  const current: TemplateMeta | undefined = templates[index] ?? templates[0];

  // Transition state machine:
  //   idle --(dwell, unless paused)--> exiting
  //   exiting --(EXIT_MS, advance index)--> entering
  //   entering --(ENTER_MS)--> idle
  // The index only advances when we leave `exiting`, so the old template is
  // what swipes out and the new one is what fades in.
  useEffect(() => {
    // Reduced motion: never advance the state machine (the CSS swipe is
    // already suppressed below, so the current bar just holds).
    if (templates.length < 2 || reducedMotion) return;
    if (phase === "idle") {
      if (paused) return;
      const t = setTimeout(() => setPhase("exiting"), DWELL_MS);
      return () => clearTimeout(t);
    }
    if (phase === "exiting") {
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % templates.length);
        setPhase("entering");
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
    // entering
    const t = setTimeout(() => setPhase("idle"), ENTER_MS);
    return () => clearTimeout(t);
  }, [phase, paused, reducedMotion, templates.length]);

  const design: Design = current?.design ?? {
    version: 1,
    name: "Verbose Dev",
    elements: [],
  };
  const ansi = useMemo(() => safeRender(design, mock), [design, mock]);

  const onUseTemplate = () => {
    goToBuilder({ templateId: current?.id ?? "verbose-dev" });
  };

  const stageClass =
    "hero-stage" +
    (phase === "exiting"
      ? " hero-stage--out"
      : phase === "entering"
        ? " hero-stage--in"
        : "");
  const stageDuration = phase === "exiting" ? EXIT_MS : ENTER_MS;

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative isolate">
        <HeroGlow />
        <TerminalFrame className="w-full">
          {/* Clips the swipe so content disappears at the right edge instead
              of triggering the frame's horizontal scroll. min-height holds two
              lines so single-line designs don't shrink the frame. */}
          <div className="flex min-h-[3em] items-center overflow-hidden">
            <span
              className={stageClass}
              style={{ animationDuration: `${stageDuration}ms` }}
            >
              <AnsiToHtml ansi={ansi} />
            </span>
          </div>
        </TerminalFrame>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[12px] text-[#8A8A86]">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            aria-label={isPaused ? "Resume cycling" : "Pause cycling"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8A8A86]/70 hover:text-[#E8E8E6] hover:bg-white/[0.04] transition-colors"
          >
            {isPaused ? (
              <Play size={11} weight="fill" />
            ) : (
              <Pause size={11} weight="fill" />
            )}
          </button>
          <span>
            <span className="text-[#E8E8E6]/80">
              {current?.name ?? "Verbose Dev"}
            </span>
            <span className="ml-2 text-[#8A8A86]">
              {isPaused ? "(paused)" : "cycling live"}
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
        @keyframes hero-swipe-out {
          0% {
            transform: translateX(0) skewX(0deg);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: translateX(80%) skewX(-7deg);
            opacity: 0;
            filter: blur(7px);
          }
        }
        @keyframes hero-fade-in {
          0% {
            transform: translateX(-2%);
            opacity: 0;
            filter: blur(6px);
          }
          55% {
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
            filter: blur(0);
          }
        }
        .hero-stage {
          display: inline-block;
          transform-origin: left center;
          animation-fill-mode: both;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity, filter;
        }
        .hero-stage--out { animation-name: hero-swipe-out; }
        .hero-stage--in { animation-name: hero-fade-in; }
        @media (prefers-reduced-motion: reduce) {
          .hero-stage--out, .hero-stage--in { animation: none; }
        }
      `}</style>
    </div>
  );
}

// Bayer 4x4 ordered-dither thresholds (0..15), same as the pricing page glow.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CELL = 3; // CSS px per dither cell
// Blobs drift left → right on independent clocks: [rgb, period s, phase 0..1, y 0..1, rx, ry]
const BLOBS: [number[], number, number, number, number, number][] = [
  [[236, 124, 120], 32, 0, 0.35, 0.3, 0.32],
  [[110, 168, 232], 38, 0.25, 0.6, 0.32, 0.3],
  [[110, 200, 140], 34, 0.5, 0.4, 0.28, 0.34],
  [[222, 192, 90], 40, 0.75, 0.65, 0.3, 0.3],
];

/**
 * Animated glow behind the terminal frame, rendered as an ordered dither: four colored
 * gaussian blobs sweep across on their own clocks; their summed intensity is thresholded
 * against a Bayer matrix so the glow reads as a pixel-grain shader. The radial mask on
 * .hero-glow feathers the edges. Static under prefers-reduced-motion.
 */
function HeroGlow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 60) return;
      last = now;
      const img = ctx.createImageData(cols, rows);
      const t = still ? 12 : now / 1000;
      const state = BLOBS.map(([rgb, period, phase, cy, rx, ry]) => ({
        rgb,
        cx: -0.3 + 1.6 * ((t / period + phase) % 1),
        cy: cy + 0.06 * Math.sin(t / 5 + phase * 9),
        rx,
        ry,
      }));
      for (let y = 0; y < rows; y++) {
        const v = y / rows;
        for (let x = 0; x < cols; x++) {
          const u = x / cols;
          let sum = 0;
          let r = 0;
          let g = 0;
          let b = 0;
          for (const s of state) {
            const dx = (u - s.cx) / s.rx;
            const dy = (v - s.cy) / s.ry;
            const w = Math.exp(-(dx * dx + dy * dy) * 2);
            sum += w;
            r += s.rgb[0]! * w;
            g += s.rgb[1]! * w;
            b += s.rgb[2]! * w;
          }
          const level = Math.min(1, sum * 1.3);
          if (level > (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16) {
            const i = (y * cols + x) * 4;
            img.data[i] = r / sum;
            img.data[i + 1] = g / sum;
            img.data[i + 2] = b / sum;
            img.data[i + 3] = 200;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      if (still) cancelAnimationFrame(raf);
    };

    const size = () => {
      cancelAnimationFrame(raf);
      cols = Math.ceil(canvas.clientWidth / CELL);
      rows = Math.ceil(canvas.clientHeight / CELL);
      canvas.width = cols;
      canvas.height = rows;
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    size();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="hero-glow pointer-events-none absolute -inset-x-24 -inset-y-20 -z-10 h-[calc(100%+10rem)] w-[calc(100%+12rem)] [image-rendering:pixelated]"
    />
  );
}

function safeRender(design: Design, mock: typeof DEFAULT_MOCK_STDIN): string {
  try {
    return renderToAnsi(design, mock);
  } catch (e) {
    return `[render error: ${e instanceof Error ? e.message : String(e)}]`;
  }
}
