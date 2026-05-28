import { useEffect, useMemo, useState } from "react";
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

  const paused = isHovered || isPaused;
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
    if (templates.length < 2) return;
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
  }, [phase, paused, templates.length]);

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
            <span className="ml-2 text-[#8A8A86]/60">
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

/**
 * Soft animated glow that sits behind the terminal frame. Four colored
 * blobs sweep slowly from left to right on independent timelines; each one
 * also morphs its border-radius to drift between organic shapes. The
 * radial mask + SVG fractal-noise overlay together feather the edges and
 * dither away dark-mode gradient banding.
 */
function HeroGlow() {
  return (
    <div
      aria-hidden
      className="hero-glow absolute -inset-x-24 -inset-y-20 -z-10 pointer-events-none overflow-hidden"
    >
      <span className="hero-glow-blob hero-glow-blob--a" />
      <span className="hero-glow-blob hero-glow-blob--b" />
      <span className="hero-glow-blob hero-glow-blob--c" />
      <span className="hero-glow-blob hero-glow-blob--d" />
      <span className="hero-glow-noise" />
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
