import { CaretRight } from "@phosphor-icons/react";
import { Link } from "../../router";
import { HeroStatusline } from "./HeroStatusline";
import { TemplateGallery } from "./TemplateGallery";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import { BrandArt } from "../Brand/BrandArt";

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
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#161618] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
            <ClaudeCodeLogo size={12} />
            Optimized for Claude Code
          </div>
          <BrandArt size="md" className="text-[#E8E8E6] mb-8" />
          <h1
            className="font-serif text-5xl md:text-6xl text-[#E8E8E6] leading-[1.05] tracking-tight max-w-[18ch]"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Design your Claude Code statusline.
          </h1>
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
