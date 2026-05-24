import { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { Link } from "../../router";
import { HeroStatusline } from "./HeroStatusline";
import { TemplateGallery } from "./TemplateGallery";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";

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
              Eight starting points. Fork any of them in the builder.
            </p>
          </div>
          <TemplateGallery />
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
const HEADLINE_LINE2 = "statusline";
const HEADLINE_TOTAL =
  HEADLINE_PRE.length + 1 + HEADLINE_LINE1.length + HEADLINE_LINE2.length;
const TYPE_INTERVAL_MS = 55;

function TypewriterHeadline() {
  const [count, setCount] = useState(0);
  const [spins, setSpins] = useState(0);
  const done = count >= HEADLINE_TOTAL;

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(
      () => setCount((c) => c + 1),
      TYPE_INTERVAL_MS,
    );
    return () => window.clearTimeout(id);
  }, [count, done]);

  const preTyped = HEADLINE_PRE.slice(0, Math.min(count, HEADLINE_PRE.length));
  const showLogo = count > HEADLINE_PRE.length;
  const line1Start = HEADLINE_PRE.length + 1;
  const line1Typed = HEADLINE_LINE1.slice(
    0,
    Math.max(0, Math.min(count - line1Start, HEADLINE_LINE1.length)),
  );
  const line2Start = line1Start + HEADLINE_LINE1.length;
  const showBreak = count >= line2Start;
  const line2Typed = HEADLINE_LINE2.slice(0, Math.max(0, count - line2Start));

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
