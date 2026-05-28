import { useMemo } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { Link } from "../../router";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import type { ProgrammaticPageConfig } from "./programmatic";

export interface ProgrammaticPageProps {
  config: ProgrammaticPageConfig;
}

/**
 * Shared layout for every programmatic SEO landing page (one URL per
 * statusline element). The same component renders all six topics —
 * each topic ships its content + sample design via `programmatic.ts`.
 *
 * The preview re-uses the in-browser interpreter (`renderToAnsi`) and
 * the ANSI-to-HTML renderer so users see byte-identical output to
 * what the bash / PowerShell installer will print.
 */
export function ProgrammaticPage({ config }: ProgrammaticPageProps) {
  const ansi = useMemo(
    () => renderToAnsi(config.sampleDesign, DEFAULT_MOCK_STDIN),
    [config.sampleDesign],
  );

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <main className="mx-auto max-w-4xl px-6 py-20 md:px-8 md:py-28">
        <section>
          <div className="mb-6 inline-flex rounded-[999px] border border-white/[0.08] bg-[#161618] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
            {config.eyebrow}
          </div>
          <h1
            className="font-serif text-4xl leading-[1.05] tracking-[-0.03em] text-[#E8E8E6] md:text-6xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            {config.h1}
          </h1>
          <p className="mt-7 max-w-[64ch] text-[16px] leading-relaxed text-[#A8A8A4] md:text-[18px]">
            {config.lede}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={config.ctaHref}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-5 py-3 text-[14px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              {config.ctaLabel}
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/community"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-[#161618] px-5 py-3 text-[14px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
            >
              Browse community designs
            </Link>
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-3 text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Live preview
          </div>
          <TerminalFrame>
            <span className="font-mono whitespace-pre leading-tight">
              <AnsiToHtml ansi={ansi} />
            </span>
          </TerminalFrame>
          <p className="mt-3 text-[12px] text-[#6F6F6B]">
            Rendered with the same interpreter that powers the in-builder
            preview and the installed bash and PowerShell scripts.
          </p>
        </section>

        {config.sections.map((section) => (
          <Section key={section.heading} title={section.heading}>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </Section>
        ))}

        <section className="mt-20 border-t border-white/[0.06] pt-12">
          <h2
            className="font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6] md:text-3xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Keep exploring
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {config.related.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between rounded-[10px] border border-white/[0.08] bg-[#161618] px-4 py-3 text-[14px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
                >
                  <span>{link.label}</span>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className="text-[#8A8A86]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 rounded-[10px] border border-white/[0.08] bg-[#161618] p-8 md:p-10">
          <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Ready to build
          </div>
          <h2
            className="mt-4 font-serif text-2xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-3xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Start your own Claude Code statusline.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-[#8A8A86]">
            Open the visual builder to drag elements onto a canvas, preview
            in real time, and install with a single terminal command.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={config.ctaHref}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-4 py-2.5 text-[13px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              {config.ctaLabel}
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/how-to-make-a-claude-code-statusline"
              className="inline-flex items-center rounded-[6px] border border-white/[0.08] px-4 py-2.5 text-[13px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-white/[0.02]"
            >
              Read the full guide
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 border-t border-white/[0.06] pt-10">
      <h2
        className="font-serif text-2xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-3xl"
        style={{
          fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[#A8A8A4]">
        {children}
      </div>
    </section>
  );
}

export default ProgrammaticPage;
