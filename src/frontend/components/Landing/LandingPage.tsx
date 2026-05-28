import { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import type { CommunityCardSummary, Design } from "@statusline/shared/types";
import { Link } from "../../router";
import { api } from "../../lib/api";
import { HeroStatusline } from "./HeroStatusline";
import { TemplateGallery } from "./TemplateGallery";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import { AnimatedPreview } from "../Preview/AnimatedPreview";
import { StaticPreview } from "../Preview/StaticPreview";

/**
 * Landing page for the Claude Code Statusline Builder.
 *
 * Sections (top → bottom):
 *  1. Hero: editorial H1 + sub-headline + <HeroStatusline /> marquee.
 *  2. Templates: H2 + <TemplateGallery />.
 *  3. "How it works" 3-column step list.
 *
 * The open-source / GitHub callout and final CTA both live in the global
 * <Footer />, so they're intentionally absent here.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <AmbientGlow />

      <main className="max-w-6xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-24 md:pt-32 pb-24 md:pb-32">
          <TypewriterHeadline />

          <p className="mt-6 text-[17px] md:text-[18px] text-[#8A8A86] max-w-[60ch] leading-relaxed">
            Drag-and-drop builder for the bar at the bottom of your Claude
            Code. Save it, share it, install it with one terminal command.
          </p>

          <p className="mt-4 text-[15px] md:text-[16px] text-[#8A8A86] max-w-[60ch] leading-relaxed">
            New here? Read{" "}
            <Link
              href="/how-to-make-a-claude-code-statusline"
              className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] transition-colors hover:decoration-white/50"
            >
              How to make a Claude Code statusline
            </Link>
            , or{" "}
            <Link
              href="/community"
              className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] transition-colors hover:decoration-white/50"
            >
              browse Claude Code statusline examples
            </Link>{" "}
            published by the community.
          </p>

          <div className="mt-12">
            <HeroStatusline />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/builder"
              className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#E8E8E6] px-5 py-3 text-[14px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Start from scratch
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/community"
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#161618] px-5 py-3 text-[14px] text-[#E8E8E6] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] hover:border-white/[0.12]"
            >
              Browse community
              <CaretRight size={14} weight="bold" />
            </Link>
          </div>
        </section>

        {/* Templates */}
        <section className="py-24 md:py-32 border-t border-white/[0.06]">
          <div className="flex items-end justify-between gap-6 mb-12">
            <h2
              className="font-serif text-3xl md:text-4xl text-[#E8E8E6] tracking-tight"
              style={{
                fontFamily:
                  "var(--font-serif, 'Instrument Serif', Georgia, serif)",
              }}
            >
              Templates.
            </h2>
            <p className="text-[14px] text-[#8A8A86] max-w-[40ch] text-right">
              Fork any of them in the builder.
            </p>
          </div>
          <TemplateGallery />
        </section>

        {/* Featured community designs */}
        <FeaturedDesigns />

        {/* Element guides — programmatic SEO landing pages, one per element */}
        <section className="py-24 md:py-32 border-t border-white/[0.06]">
          <div className="flex items-end justify-between gap-6 mb-12">
            <h2
              className="font-serif text-3xl md:text-4xl text-[#E8E8E6] tracking-tight"
              style={{
                fontFamily:
                  "var(--font-serif, 'Instrument Serif', Georgia, serif)",
              }}
            >
              Element guides.
            </h2>
            <p className="text-[14px] text-[#8A8A86] max-w-[40ch] text-right">
              Short explainers for the most common Claude Code statusline
              elements.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ElementGuideLink
              href="/claude-code-statusline-git-branch"
              title="Git branch"
              body="Show the active branch in the statusline."
              design={ELEMENT_DESIGNS.gitBranch}
              startOffsetMs={0}
            />
            <ElementGuideLink
              href="/claude-code-statusline-token-usage"
              title="Token usage"
              body="Render context-window usage as a bar or percent."
              design={ELEMENT_DESIGNS.tokenUsage}
              startOffsetMs={700}
            />
            <ElementGuideLink
              href="/claude-code-statusline-cost"
              title="Cost"
              body="Track session cost in USD with configurable precision."
              design={ELEMENT_DESIGNS.cost}
              startOffsetMs={1400}
            />
            <ElementGuideLink
              href="/claude-code-statusline-model"
              title="Model name"
              body="Pin the active Claude model to the terminal."
              design={ELEMENT_DESIGNS.model}
              startOffsetMs={2100}
            />
            <ElementGuideLink
              href="/claude-code-statusline-duration"
              title="Session duration"
              body="Display elapsed time, human or HH:MM:SS."
              design={ELEMENT_DESIGNS.duration}
              startOffsetMs={2800}
            />
            <ElementGuideLink
              href="/claude-code-statusline-rate-limit"
              title="Rate limit"
              body="Visualize 5-hour and 7-day rate-limit usage."
              design={ELEMENT_DESIGNS.rateLimit}
              startOffsetMs={3500}
            />
          </ul>
        </section>

        {/* How it works */}
        <section className="py-24 md:py-32 border-t border-white/[0.06]">
          <h2
            className="font-serif text-3xl md:text-4xl text-[#E8E8E6] tracking-tight"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            How it works.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            <Step
              number="01."
              title="Design"
              body="Drag elements onto the canvas. Style them. Watch the preview render in real time."
            />
            <Step
              number="02."
              title="Save"
              body="One click to save and share. Publish to the community when you're ready."
            />
            <Step
              number="03."
              title="Install"
              body="Paste one command into your terminal. Works on macOS, Linux, and Windows."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

const HEADLINE_PRE = "Design your";
const HEADLINE_LINE1 = "Claude Code";
// The trailing word is a stable stem plus a suffix that the headline edits in
// place after the intro types out. Suffixes cycle: "statusline" → "status line"
// → "status bar" → "statusbar" → (loop). Each transition deletes the current
// suffix one char at a time (like the delete key) and types the next.
const HEADLINE_STEM = "status";
const HEADLINE_SUFFIXES = ["line", " line", " bar", "bar"] as const;
const HEADLINE_LINE2 = HEADLINE_STEM + HEADLINE_SUFFIXES[0]; // "statusline"
const HEADLINE_TOTAL =
  HEADLINE_PRE.length + 1 + HEADLINE_LINE1.length + HEADLINE_LINE2.length;
const TYPE_INTERVAL_MS = 55;
const DELETE_INTERVAL_MS = 42;
const SUFFIX_HOLD_MS = 1600;

type CyclePhase = "hold" | "deleting" | "typing";

function TypewriterHeadline() {
  const [count, setCount] = useState(0);
  const [spins, setSpins] = useState(0);
  const done = count >= HEADLINE_TOTAL;

  // Suffix-cycling state, active only once the intro typing has finished.
  const [sufIdx, setSufIdx] = useState(0);
  const [sufChars, setSufChars] = useState(HEADLINE_SUFFIXES[0].length);
  const [phase, setPhase] = useState<CyclePhase>("hold");
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeSuffix = HEADLINE_SUFFIXES[sufIdx] ?? "";

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Intro typing: reveal the whole headline up through "statusline".
  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(
      () => setCount((c) => c + 1),
      TYPE_INTERVAL_MS,
    );
    return () => window.clearTimeout(id);
  }, [count, done]);

  // Suffix cycle: hold → delete the suffix to the stem → type the next suffix.
  useEffect(() => {
    if (!done || reducedMotion) return;
    if (phase === "hold") {
      const id = window.setTimeout(() => setPhase("deleting"), SUFFIX_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "deleting") {
      if (sufChars === 0) {
        setSufIdx((i) => (i + 1) % HEADLINE_SUFFIXES.length);
        setPhase("typing");
        return;
      }
      const id = window.setTimeout(
        () => setSufChars((c) => c - 1),
        DELETE_INTERVAL_MS,
      );
      return () => window.clearTimeout(id);
    }
    // typing
    if (sufChars >= activeSuffix.length) {
      setPhase("hold");
      return;
    }
    const id = window.setTimeout(
      () => setSufChars((c) => c + 1),
      TYPE_INTERVAL_MS,
    );
    return () => window.clearTimeout(id);
  }, [done, reducedMotion, phase, sufChars, activeSuffix.length]);

  const preTyped = HEADLINE_PRE.slice(0, Math.min(count, HEADLINE_PRE.length));
  const showLogo = count > HEADLINE_PRE.length;
  const line1Start = HEADLINE_PRE.length + 1;
  const line1Typed = HEADLINE_LINE1.slice(
    0,
    Math.max(0, Math.min(count - line1Start, HEADLINE_LINE1.length)),
  );
  const line2Start = line1Start + HEADLINE_LINE1.length;
  const showBreak = count >= line2Start;
  // Before the intro finishes, reveal "statusline" character by character. After
  // it finishes, render the stem plus however much of the active suffix is
  // currently typed/deleted.
  const line2Typed = done
    ? HEADLINE_STEM + activeSuffix.slice(0, sufChars)
    : HEADLINE_LINE2.slice(0, Math.max(0, count - line2Start));

  return (
    <h1
      className="font-serif text-5xl md:text-6xl text-[#E8E8E6] leading-[1.05] tracking-tight min-h-[2.2em]"
      style={{
        fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
      }}
    >
      <span
        aria-label={`${HEADLINE_PRE} ${HEADLINE_LINE1} ${HEADLINE_LINE2}.`}
      >
        {preTyped}
        {showLogo && (
          <button
            type="button"
            onClick={() => setSpins((s) => s + 1)}
            aria-label="Spin the Claude Code logo"
            className="inline-flex items-center align-middle mx-2 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <span
              className="inline-flex"
              style={{
                transform: `rotate(${spins * 360}deg)`,
                transition: "transform 800ms ease-in-out",
              }}
            >
              <ClaudeCodeLogo size={44} />
            </span>
          </button>
        )}
        {line1Typed}
        {showBreak && <br />}
        {line2Typed}
        {done && <span className="period-blink">.</span>}
      </span>
    </h1>
  );
}

/**
 * One live, self-animating statusline per element-guide card. Each design is a
 * single-element snippet themed to that guide, rendered through
 * `AnimatedPreview` so the underlying field drifts on its own — the branch
 * rotates, the context bar fills, cost ramps, the model name swaps, duration
 * ticks up, and the rate-limit bar sweeps.
 */
const ELEMENT_DESIGNS = {
  gitBranch: {
    version: 1,
    name: "Git branch",
    elements: [
      { id: "gb_lbl", type: "static", text: "on", style: { dim: true, fg: { kind: "ansi16", index: 8 } }, suffix: " " },
      { id: "gb", type: "gitBranch", style: { bold: true, fg: { kind: "ansi16", index: 5 } } },
    ],
  },
  tokenUsage: {
    version: 1,
    name: "Token usage",
    elements: [
      { id: "tu_lbl", type: "static", text: "ctx", style: { dim: true, fg: { kind: "ansi16", index: 8 } }, suffix: " " },
      { id: "tu_bar", type: "contextBar", width: 12, filledChar: "█", emptyChar: "░", colorMode: "absolute", style: { fg: { kind: "ansi16", index: 2 } } },
      { id: "tu_pct", type: "contextPct", colorMode: "percentage", style: { fg: { kind: "ansi16", index: 7 } }, prefix: " ", suffix: "%" },
    ],
  },
  cost: {
    version: 1,
    name: "Cost",
    elements: [
      { id: "co_lbl", type: "static", text: "cost", style: { dim: true, fg: { kind: "ansi16", index: 8 } }, suffix: " " },
      { id: "co", type: "cost", precision: 2, style: { bold: true, fg: { kind: "ansi16", index: 2 } } },
    ],
  },
  model: {
    version: 1,
    name: "Model name",
    elements: [
      { id: "mo_g", type: "glyph", char: "✦", style: { fg: { kind: "ansi16", index: 13 } }, suffix: " " },
      { id: "mo", type: "model", style: { bold: true, fg: { kind: "ansi16", index: 6 } } },
    ],
  },
  duration: {
    version: 1,
    name: "Session duration",
    elements: [
      { id: "du_lbl", type: "static", text: "up", style: { dim: true, fg: { kind: "ansi16", index: 8 } }, suffix: " " },
      { id: "du", type: "sessionDuration", format: "hms", style: { fg: { kind: "ansi16", index: 4 } } },
    ],
  },
  rateLimit: {
    version: 1,
    name: "Rate limit",
    elements: [
      { id: "rl_lbl", type: "static", text: "5h", style: { dim: true, fg: { kind: "ansi16", index: 8 } }, suffix: " " },
      { id: "rl_bar", type: "rateLimit5h", variant: "bar", width: 10, filledChar: "█", emptyChar: "░", style: { fg: { kind: "ansi16", index: 3 } } },
      { id: "rl_pct", type: "rateLimit5h", variant: "pct", width: 0, filledChar: "█", emptyChar: "░", style: { fg: { kind: "ansi16", index: 7 } }, prefix: " ", suffix: "%" },
    ],
  },
} satisfies Record<string, Design>;

function ElementGuideLink({
  href,
  title,
  body,
  design,
  startOffsetMs = 0,
}: {
  href: string;
  title: string;
  body: string;
  design: Design;
  startOffsetMs?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-2 rounded-[10px] border border-white/[0.06] bg-[#161618] p-5 no-underline transition-colors hover:border-white/[0.12] hover:bg-[#1C1C1F]"
      >
        <span className="text-[14px] font-medium text-[#E8E8E6]">{title}</span>
        <span className="text-[13px] text-[#8A8A86] leading-relaxed">
          {body}
        </span>
        {/* Live, self-animating example of this element. */}
        <div className="mt-2 overflow-hidden">
          <AnimatedPreview
            design={design}
            className="text-[11px]"
            startOffsetMs={startOffsetMs}
          />
        </div>
      </Link>
    </li>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="text-[13px] text-[#8A8A86] font-mono tracking-wider">
        {number}
      </div>
      <h3
        className="mt-3 font-serif text-2xl text-[#E8E8E6] tracking-tight"
        style={{
          fontFamily:
            "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h3>
      <p className="mt-3 text-[15px] text-[#8A8A86] leading-relaxed">
        {body}
      </p>
    </div>
  );
}

/**
 * Featured community designs. Renders 3-4 link cards that point at popular
 * community designs by name — useful internal-linking signal for search
 * crawlers (anchor text = design name) and a path into the gallery for
 * humans. Fails silent: if the fetch errors or returns 0, we render a single
 * static CTA pointing at /community rather than a broken section.
 */
function FeaturedDesigns() {
  const [items, setItems] = useState<CommunityCardSummary[] | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listCommunity({ sort: "popular", limit: 4 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
      })
      .catch(() => {
        if (cancelled) return;
        setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading: render nothing rather than a skeleton — keeps the landing page
  // calm. The section appears once data is back.
  if (items === null && !errored) return null;

  const designs = items ?? [];
  if (errored || designs.length === 0) {
    return (
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <h2
          className="font-serif text-3xl md:text-4xl text-[#E8E8E6] tracking-tight"
          style={{
            fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
          }}
        >
          Featured designs.
        </h2>
        <p className="mt-4 max-w-[52ch] text-[15px] text-[#8A8A86] leading-relaxed">
          <Link
            href="/community"
            className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] transition-colors hover:decoration-white/50"
          >
            Browse the Claude Code statusline community gallery
          </Link>{" "}
          to see designs published by other developers.
        </p>
      </section>
    );
  }

  return (
    <section className="py-24 md:py-32 border-t border-white/[0.06]">
      <div className="flex items-end justify-between gap-6 mb-12">
        <h2
          className="font-serif text-3xl md:text-4xl text-[#E8E8E6] tracking-tight"
          style={{
            fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
          }}
        >
          Featured designs.
        </h2>
        <p className="text-[14px] text-[#8A8A86] max-w-[40ch] text-right">
          Popular community-published Claude Code statuslines.{" "}
          <Link
            href="/community"
            className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
          >
            See all
          </Link>
          .
        </p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {designs.map((d) => (
          <li key={d.id}>
            <Link
              href={`/community/${d.slug}`}
              title={`${d.name} — Claude Code statusline by ${d.author_name ?? "anonymous"}`}
              className="group flex h-full flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#161618] no-underline transition-colors hover:border-white/[0.14] hover:bg-[#19191B]"
            >
              <div className="flex h-[100px] items-center justify-center overflow-hidden border-b border-white/[0.06] bg-[#0E0E10] px-4">
                <div className="w-full overflow-hidden">
                  <StaticPreview design={d.design} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <span className="truncate text-[14px] font-medium text-[#E8E8E6] group-hover:text-white">
                  {d.name}
                </span>
                <span className="text-[12px] text-[#8A8A86]">
                  by {d.author_name ?? "anonymous"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Subtle radial ambient gradient at the top of the page. Fixed so it stays
 * anchored to the hero region even on scroll. Below 0.05 opacity per spec.
 */
function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none -z-10"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232, 232, 230, 0.04), transparent 60%)",
      }}
    />
  );
}

export default LandingPage;
