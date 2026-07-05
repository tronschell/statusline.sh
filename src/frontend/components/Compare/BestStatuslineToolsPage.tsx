import { useMemo } from "react";
import { CaretRight, CheckCircle, Minus } from "@phosphor-icons/react";
import { Link } from "../../router";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { Design } from "@statusline/shared/types";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import {
  BEST_TOOLS_FAQS,
  STATUSLINE_DIFFERENTIATOR,
  STATUSLINE_TOOLS,
  type ComparisonCell,
} from "./tools";

/**
 * `/best-claude-code-statusline` — an honest roundup of the Claude Code
 * statusline landscape (ccstatusline, claude-powerline, CCometixLine, ccusage)
 * that positions statusline.sh on its genuine differentiator: the only
 * web-based visual builder with a live browser preview and a shareable
 * community gallery.
 *
 * The crawlable prose equivalent lives in `static-content/staticContent.ts`
 * (BEST_TOOLS_CONTENT); both draw their copy from `./tools.ts` so the page and
 * the prerendered shell stay honest and in step.
 */

// A feature-rich sample line for the hero preview — rendered with the same
// interpreter that powers the in-builder preview and the installed scripts.
const SHOWCASE_DESIGN: Design = {
  version: 1,
  name: "Comparison showcase",
  elements: [
    {
      id: "model",
      type: "model",
      style: { bold: true, fg: { kind: "ansi16", index: 15 } },
      suffix: "  ",
    },
    {
      id: "cwd",
      type: "cwd",
      mode: "basename",
      style: { fg: { kind: "ansi16", index: 12 } },
      suffix: " ",
    },
    {
      id: "on",
      type: "separator",
      text: "on ",
      style: { fg: { kind: "ansi16", index: 8 } },
    },
    {
      id: "branch",
      type: "gitBranch",
      style: { fg: { kind: "ansi16", index: 2 }, bold: true },
      suffix: "  ",
    },
    {
      id: "ctx",
      type: "contextBar",
      width: 10,
      filledChar: "█",
      emptyChar: "░",
      colorMode: "percentage",
      style: {},
      suffix: " ",
    },
    {
      id: "cost",
      type: "cost",
      precision: 2,
      style: { fg: { kind: "ansi16", index: 11 }, bold: true },
      prefix: "$",
    },
  ],
};

const RELATED_LINKS: { href: string; label: string }[] = [
  { href: "/builder", label: "Open the visual builder" },
  { href: "/community", label: "Browse the community gallery" },
  {
    href: "/how-to-make-a-claude-code-statusline",
    label: "How to make a Claude Code statusline",
  },
  { href: "/claude-code-statusline-cost", label: "Add a cost display" },
  { href: "/claude-code-statusline-token-usage", label: "Add token usage" },
  { href: "/claude-code-statusline-rate-limit", label: "Add rate-limit bars" },
];

export function BestStatuslineToolsPage() {
  const ansi = useMemo(
    () => renderToAnsi(SHOWCASE_DESIGN, DEFAULT_MOCK_STDIN),
    [],
  );

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <main className="mx-auto max-w-5xl px-6 py-20 md:px-8 md:py-28">
        {/* Hero */}
        <section className="max-w-4xl">
          <div className="mb-6 inline-flex rounded-[999px] border border-white/[0.08] bg-[#161618] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Comparison &middot; 2026
          </div>
          <h1
            className="font-serif text-4xl leading-[1.04] tracking-[-0.035em] text-[#E8E8E6] md:text-6xl"
            style={{
              fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Best Claude Code Statusline Tools (2026)
          </h1>
          <p className="mt-7 max-w-[68ch] text-[16px] leading-relaxed text-[#A8A8A4] md:text-[18px]">
            The Claude Code statusline (also written status line, or the status
            bar at the bottom of the terminal) has a small, healthy ecosystem of
            tools. Here is an honest look at the popular ones —{" "}
            <span className="text-[#E8E8E6]">ccstatusline</span>,{" "}
            <span className="text-[#E8E8E6]">claude-powerline</span>,{" "}
            <span className="text-[#E8E8E6]">CCometixLine</span>, and{" "}
            <span className="text-[#E8E8E6]">ccusage</span> — and where{" "}
            <span className="text-[#E8E8E6]">statusline.sh</span> fits.
          </p>
          <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-[#8A8A86]">
            {STATUSLINE_DIFFERENTIATOR}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/builder"
              title="Claude Code Statusline Builder"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-5 py-3 text-[14px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Build one in your browser
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

        {/* Live preview */}
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
            A statusline designed in statusline.sh, rendered with the same
            interpreter that powers the in-builder preview and the installed
            bash and PowerShell scripts.
          </p>
        </section>

        {/* Comparison table */}
        <section className="mt-16 border-t border-white/[0.06] pt-12">
          <SectionHeading title="At a glance" />
          <div className="mt-8 overflow-x-auto rounded-[10px] border border-white/[0.08]">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[#161618] text-[#8A8A86]">
                  <Th className="sticky left-0 bg-[#161618]">Tool</Th>
                  <Th>Type</Th>
                  <Th>Install</Th>
                  <Th>Visual builder</Th>
                  <Th>Live browser preview</Th>
                  <Th>Shareable gallery</Th>
                  <Th>Windows / PowerShell</Th>
                  <Th>Powerline</Th>
                  <Th>Cost / usage</Th>
                </tr>
              </thead>
              <tbody>
                {STATUSLINE_TOOLS.map((tool) => (
                  <tr
                    key={tool.name}
                    className={
                      "border-t border-white/[0.06] " +
                      (tool.isUs ? "bg-white/[0.03]" : "")
                    }
                  >
                    <Td
                      className={
                        "sticky left-0 font-medium " +
                        (tool.isUs
                          ? "bg-[#17170F] text-[#E8E8E6]"
                          : "bg-[#0E0E10] text-[#E8E8E6]")
                      }
                    >
                      {tool.name}
                    </Td>
                    <Td className="text-[#A8A8A4]">{tool.type}</Td>
                    <CellTd cell={tool.install} />
                    <CellTd cell={tool.visualBuilder} />
                    <CellTd cell={tool.browserPreview} />
                    <CellTd cell={tool.gallery} />
                    <CellTd cell={tool.windows} />
                    <CellTd cell={tool.powerline} />
                    <CellTd cell={tool.cost} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-[#6F6F6B]">
            Competitor capabilities are summarized from each project&rsquo;s
            general positioning and evolve over time — check a tool&rsquo;s own
            docs for the latest. &ldquo;Runs via Node&rdquo; means the tool works
            wherever Node is installed, including Windows.
          </p>
        </section>

        {/* Per-tool prose */}
        <section className="mt-16 border-t border-white/[0.06] pt-12">
          <SectionHeading title="The tools, one by one" />
          <div className="mt-8 grid gap-4">
            {STATUSLINE_TOOLS.map((tool) => (
              <article
                key={tool.name}
                className={
                  "rounded-[10px] border p-6 " +
                  (tool.isUs
                    ? "border-white/[0.16] bg-[#161610]"
                    : "border-white/[0.08] bg-[#161618]")
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[17px] font-medium text-[#E8E8E6]">
                    {tool.name}
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
                    {tool.type}
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#A8A8A4]">
                  {tool.blurb}
                </p>
                {tool.isUs && (
                  <Link
                    href="/builder"
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[#E8E8E6] no-underline transition-colors hover:text-white"
                  >
                    Open the builder
                    <CaretRight size={12} weight="bold" />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Which should you pick */}
        <section className="mt-16 border-t border-white/[0.06] pt-12">
          <SectionHeading title="Which should you pick?" />
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#A8A8A4]">
            <p>
              If you want to design a statusline visually, preview it live, and
              install it with one command — without writing shell scripts or
              editing settings.json by hand — start with statusline.sh. It is
              also the only option that gives you a shareable link and a
              community gallery to fork from, and it ships a first-class Windows
              PowerShell installer.
            </p>
            <p>
              If you would rather stay in the terminal, the alternatives are
              excellent. Choose ccstatusline for an interactive CLI
              configurator, claude-powerline for the segmented powerline look,
              CCometixLine for a fast native binary, and ccusage when cost and
              usage analytics are what you care about most.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 border-t border-white/[0.06] pt-12">
          <SectionHeading title="Frequently asked" />
          <div className="mt-6 space-y-6">
            {BEST_TOOLS_FAQS.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-[15px] font-medium text-[#E8E8E6]">
                  {faq.question}
                </h3>
                <p className="mt-2 max-w-[72ch] text-[14px] leading-relaxed text-[#8A8A86]">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Keep exploring */}
        <section className="mt-16 border-t border-white/[0.06] pt-12">
          <h2
            className="font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6] md:text-3xl"
            style={{
              fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Keep exploring
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {RELATED_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between rounded-[10px] border border-white/[0.08] bg-[#161618] px-4 py-3 text-[14px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
                >
                  <span>{link.label}</span>
                  <CaretRight size={14} weight="bold" className="text-[#8A8A86]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-16 rounded-[10px] border border-white/[0.08] bg-[#161618] p-8 md:p-10">
          <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
            No install to try it
          </div>
          <h2
            className="mt-4 font-serif text-2xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-3xl"
            style={{
              fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Design your Claude Code statusline in the browser.
          </h2>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-[#8A8A86]">
            Drag elements onto a canvas, preview the exact terminal output live,
            and install with one command on macOS, Linux, or Windows.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/builder"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-4 py-2.5 text-[13px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Open the builder
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

function SectionHeading({ title }: { title: string }) {
  return (
    <h2
      className="font-serif text-2xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
      style={{
        fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
      }}
    >
      {title}
    </h2>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={
        "whitespace-nowrap px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] " +
        (className ?? "")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={"whitespace-nowrap px-4 py-3 align-middle " + (className ?? "")}>
      {children}
    </td>
  );
}

function CellTd({ cell }: { cell: ComparisonCell }) {
  if (cell.kind === "yes") {
    return (
      <Td className="text-[#9CC09F]">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle size={14} weight="fill" className="shrink-0" />
          {cell.text}
        </span>
      </Td>
    );
  }
  if (cell.kind === "no") {
    return (
      <Td className="text-[#6F6F6B]">
        <span className="inline-flex items-center gap-1.5">
          <Minus size={14} weight="bold" className="shrink-0" />
          {cell.text}
        </span>
      </Td>
    );
  }
  return <Td className="text-[#A8A8A4]">{cell.text}</Td>;
}

export default BestStatuslineToolsPage;
