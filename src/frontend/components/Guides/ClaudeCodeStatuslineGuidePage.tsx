import {
  CaretRight,
  CheckCircleIcon,
  DownloadSimple,
  Minus,
  PaintBrushBroad,
  Plus,
  SlidersHorizontal,
  SquaresFour,
  TerminalWindow,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ANSI16_HEX, styleToSgr } from "@statusline/shared/ansi";
import { DEFAULT_MOCK_STDIN, MOCK_PRESETS } from "@statusline/shared/mockStdin";
import { getTemplate } from "@statusline/shared/templates";
import type { AnsiStyle, ClaudeStdin, Design } from "@statusline/shared/types";
import { Link } from "../../router";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import { StaticPreview } from "../Preview/StaticPreview";
import cardDesign from "./assets/card-design.webp";
import cardPreview from "./assets/card-preview.webp";
import cardInstall from "./assets/card-install.webp";

const settingsJson = `{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}`;

const manualScript = `#!/usr/bin/env bash
input=$(cat)
model=$(echo "$input" | jq -r '.model.display_name')
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
printf "\\033[1m%s\\033[0m  %s" "$model" "\${cwd##*/}"`;

export function ClaudeCodeStatuslineGuidePage() {
  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <GuideStyles />
      <main className="mx-auto max-w-5xl px-6 py-20 md:px-8 md:py-28">
        <Reveal as="section" className="max-w-4xl">
          <div className="mb-6 inline-flex rounded-[999px] border border-white/[0.08] bg-[#161618] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Claude Code guide
          </div>
          <h1
            className="font-serif text-5xl leading-[1.02] tracking-[-0.035em] text-[#E8E8E6] md:text-7xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            How to make a
            <ClaudeCodeLogo
              size={44}
              title="Claude Code"
              className="mx-2 inline-flex align-middle md:h-[58px] md:w-[58px]"
            />
            Claude Code status line.
          </h1>
          <p className="mt-7 max-w-[68ch] text-[17px] leading-relaxed text-[#A8A8A4] md:text-[18px]">
            Claude Code calls the bottom bar a statusline. Many people search
            for it as a status line or status bar. Either way, it is a command
            that reads Claude Code session JSON and prints styled terminal text.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/builder"
              title="Claude Code Statusline Builder"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-5 py-3 text-[14px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Claude Code statusline builder
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/community"
              title="Community-published Claude Code statusline designs"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-[#161618] px-5 py-3 text-[14px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
            >
              See real examples
            </Link>
          </div>
          <p className="mt-6 max-w-[68ch] text-[14px] leading-relaxed text-[#8A8A86]">
            Prefer to learn by example?{" "}
            <Link
              href="/community"
              className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
            >
              Browse community-published Claude Code statusline designs
            </Link>{" "}
            and fork any of them into the builder.
          </p>
        </Reveal>

        <Reveal as="section" className="mt-20 grid gap-5 md:grid-cols-3">
          <SummaryCard
            label="01"
            title="Design"
            body="Choose model, directory, git branch, cost, context usage, separators, glyphs, and ANSI styles."
            image={cardDesign}
            panDelayMs={0}
          />
          <SummaryCard
            label="02"
            title="Preview"
            body="See the exact terminal output before installing anything into your Claude Code settings."
            image={cardPreview}
            panDelayMs={-6000}
          />
          <SummaryCard
            label="03"
            title="Install"
            body="Generate a bash or PowerShell installer that updates settings.json without replacing your other keys."
            image={cardInstall}
            panDelayMs={-12000}
          />
        </Reveal>

        <GuideSection title="What is a Claude Code statusline?">
          <p>
            A Claude Code statusline is an executable command configured in your
            Claude settings. Claude Code sends the command a JSON payload on
            stdin. The command prints one line of text to stdout, and Claude Code
            renders that text as the status area at the bottom of the terminal.
          </p>
          <p>
            That means a statusline can show useful session context like the
            active model, current folder, git branch, changed lines, token
            context, session duration, and estimated cost.
          </p>
        </GuideSection>

        <Reveal as="section" className="mt-20 border-t border-white/[0.06] pt-12">
          <SectionHeading
            eyebrow="Live, in your browser"
            title="See it in color."
          />
          <p className="mt-6 max-w-[68ch] text-[15px] leading-relaxed text-[#A8A8A4]">
            These are real statuslines rendered with the same engine that
            generates your installer — actual ANSI colors, not screenshots.
            Switch designs and session states to watch the colors respond to
            context usage, cost, and git state.
          </p>
          <ColorGallery />
        </Reveal>

        <GuideSection title="The manual way">
          <p>
            Manually building a Claude Code status line usually means writing a
            shell script, parsing JSON, printing ANSI escape codes, making the
            script executable, and then editing your Claude settings file.
          </p>
          <CodeBlock label="settings.json" code={settingsJson} />
          <CodeBlock label="statusline.sh" code={manualScript} />
          <p>
            This works, but it is easy to break quoting, ANSI colors, JSON field
            reads, or existing settings when editing by hand. The hardest part is
            usually the escape codes — try them below.
          </p>
        </GuideSection>

        <Reveal as="section" className="mt-16">
          <SectionHeading
            eyebrow="Interactive"
            title="Style a segment without escape codes."
          />
          <p className="mt-6 max-w-[68ch] text-[15px] leading-relaxed text-[#A8A8A4]">
            Toggle a style or pick a color and watch the segment re-render. The
            builder writes the ANSI escape sequence shown underneath for you, so
            you never type <code className="font-mono text-[#E8E8E6]">\e[</code>{" "}
            by hand.
          </p>
          <StyleLab />
        </Reveal>

        <GuideSection title="The visual way with statusline.sh">
          <p>
            statusline.sh lets you build the same command visually. Drag elements
            into place, style them, preview the result, and install the generated
            script when it looks right.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <ChecklistItem text="Build from scratch or start with a template." />
            <ChecklistItem text="Customize colors, labels, separators, and conditional visibility." />
            <ChecklistItem text="Preview with mock Claude Code session data." />
            <ChecklistItem text="Install on macOS, Linux, or Windows." />
            <ChecklistItem text="Share a design or fork a community example." />
            <ChecklistItem text="Keep existing Claude settings intact during install." />
          </div>
        </GuideSection>

        <GuideSection title="What can you customize?">
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<SlidersHorizontal size={18} weight="bold" />}
              tag="8 data sources"
              accent="#9CC09F"
              title="Session data"
              body="Add model name, working directory, git branch, changed lines, context percentage, cost, and elapsed session time."
            />
            <FeatureCard
              icon={<PaintBrushBroad size={18} weight="bold" />}
              tag="ANSI / 256 / RGB"
              accent="#C9A2E0"
              title="Terminal styling"
              body="Use bold, dim, italic, ANSI colors, 256-color values, and background colors without writing escape codes by hand."
            />
            <FeatureCard
              icon={<SquaresFour size={18} weight="bold" />}
              tag="Compose freely"
              accent="#9FC0D8"
              title="Layout"
              body="Compose text, separators, split segments, progress bars, and rotating labels into one compact terminal line."
            />
            <FeatureCard
              icon={<DownloadSimple size={18} weight="bold" />}
              tag="bash + PowerShell"
              accent="#D8C79F"
              title="Install path"
              body="Export a script and settings merge for bash or PowerShell so the same design can work across operating systems."
            />
          </div>
        </GuideSection>

        <FaqSection />

        <Reveal
          as="section"
          className="mt-20 rounded-[10px] border border-white/[0.08] bg-[#161618] p-8 md:p-10"
        >
          <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
            Ready to build
          </div>
          <h2
            className="mt-4 font-serif text-3xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Create your Claude Code statusline visually.
          </h2>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-[#8A8A86]">
            Start with a blank canvas, fork a template, or browse community
            examples to see how other developers structure their Claude Code
            status bar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/builder"
              title="Claude Code Statusline Builder"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-4 py-2.5 text-[13px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
            >
              Open the Claude Code statusline builder
              <CaretRight size={14} weight="bold" />
            </Link>
            <Link
              href="/community"
              title="Browse Claude Code statusline examples"
              className="inline-flex items-center rounded-[6px] border border-white/[0.08] px-4 py-2.5 text-[13px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-white/[0.02]"
            >
              Browse community-published statusline examples
            </Link>
          </div>
        </Reveal>

        <ContinueReading />
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Interactive: color gallery                                                  */
/* -------------------------------------------------------------------------- */

// Colorful templates that render with plain terminal glyphs (no Nerd Font
// dependency) — pulled from the shared TEMPLATES registry so the guide stays
// in lockstep with the builder.
const GALLERY_TEMPLATE_IDS = [
  "minimal",
  "verbose-dev",
  "pastel-dashboard",
  "vital-signs",
  "neon-pulse",
] as const;

const SESSION_PRESETS: { id: string; label: string; mock: ClaudeStdin }[] = [
  { id: "fresh", label: "Fresh start", mock: MOCK_PRESETS.fresh ?? DEFAULT_MOCK_STDIN },
  { id: "working", label: "Mid-session", mock: DEFAULT_MOCK_STDIN },
  { id: "deep", label: "Deep session", mock: MOCK_PRESETS.deep ?? DEFAULT_MOCK_STDIN },
];

function ColorGallery() {
  const templates = useMemo(
    () =>
      GALLERY_TEMPLATE_IDS.map((id) => getTemplate(id)).filter(
        (t): t is NonNullable<ReturnType<typeof getTemplate>> => Boolean(t),
      ),
    [],
  );
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "minimal");
  const [sessionId, setSessionId] = useState(SESSION_PRESETS[1]!.id);

  const active = templates.find((t) => t.id === templateId) ?? templates[0];
  const session =
    SESSION_PRESETS.find((s) => s.id === sessionId) ?? SESSION_PRESETS[1]!;

  if (!active) return null;

  return (
    <div className="mt-8 overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#161618]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
        <span className="mr-1 hidden font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B] sm:inline">
          Design
        </span>
        {templates.map((t) => (
          <Pill
            key={t.id}
            active={t.id === active.id}
            onClick={() => setTemplateId(t.id)}
          >
            {t.name}
          </Pill>
        ))}
      </div>

      <div className="p-5 md:p-6">
        <StaticPreview design={active.design} mock={session.mock} />
        <p className="mt-4 text-[13px] leading-relaxed text-[#8A8A86]">
          {active.description}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
            Session
          </span>
          {SESSION_PRESETS.map((s) => (
            <Pill
              key={s.id}
              active={s.id === session.id}
              onClick={() => setSessionId(s.id)}
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-5 py-3 md:px-6">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#8A8A86]">
          <TerminalWindow size={13} weight="bold" />
          Rendered from live mock session data
        </span>
        <Link
          href={`/builder?template=${active.id}`}
          title={`Open ${active.name} in the builder`}
          className="inline-flex items-center gap-1 text-[13px] text-[#E8E8E6]/85 no-underline transition-colors hover:text-[#E8E8E6]"
        >
          Fork this design
          <CaretRight size={12} weight="bold" />
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Interactive: ANSI style lab                                                 */
/* -------------------------------------------------------------------------- */

// Curated foreground palette (ANSI-16). Swatch colors come from the shared
// ANSI16_HEX map so they match exactly what the preview renders.
const SWATCHES: { index: number; label: string }[] = [
  { index: 6, label: "cyan" },
  { index: 4, label: "blue" },
  { index: 5, label: "magenta" },
  { index: 2, label: "green" },
  { index: 3, label: "yellow" },
  { index: 1, label: "red" },
  { index: 7, label: "white" },
  { index: 8, label: "gray" },
];

function StyleLab() {
  const [colorIndex, setColorIndex] = useState(6);
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [dim, setDim] = useState(false);
  const [underline, setUnderline] = useState(false);

  const style: AnsiStyle = useMemo(
    () => ({
      bold: bold || undefined,
      italic: italic || undefined,
      dim: dim || undefined,
      underline: underline || undefined,
      fg: { kind: "ansi16", index: colorIndex },
    }),
    [bold, italic, dim, underline, colorIndex],
  );

  // A small three-segment statusline: only the model segment is user-styled;
  // the rest stay fixed so the styled token reads against neutral context.
  const design: Design = useMemo(
    () => ({
      version: 1,
      name: "Style lab",
      elements: [
        { id: "lab_model", type: "static", text: "Opus 4.7", style, suffix: " " },
        {
          id: "lab_sep",
          type: "static",
          text: "·",
          style: { dim: true, fg: { kind: "ansi16", index: 8 } },
          prefix: " ",
          suffix: " ",
        },
        {
          id: "lab_dir",
          type: "static",
          text: "statusline-maker",
          style: { fg: { kind: "ansi16", index: 7 } },
          suffix: " ",
        },
        {
          id: "lab_branch",
          type: "static",
          text: "feature/auth-refactor",
          style: { italic: true, fg: { kind: "ansi16", index: 13 } },
        },
      ],
    }),
    [style],
  );

  // Display-friendly escape sequence for the styled segment.
  const escapeSeq = useMemo(() => {
    const open = styleToSgr(style).replace(//g, "\\e");
    return `${open}Opus 4.7\\e[0m`;
  }, [style]);

  return (
    <div className="mt-8 overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#161618]">
      <div className="p-5 md:p-6">
        <StaticPreview design={design} />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
            Style
          </span>
          <StyleKey active={bold} onClick={() => setBold((v) => !v)} bold>
            B
          </StyleKey>
          <StyleKey active={italic} onClick={() => setItalic((v) => !v)} italic>
            I
          </StyleKey>
          <StyleKey
            active={underline}
            onClick={() => setUnderline((v) => !v)}
            underline
          >
            U
          </StyleKey>
          <StyleKey active={dim} onClick={() => setDim((v) => !v)}>
            dim
          </StyleKey>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
            Color
          </span>
          {SWATCHES.map((sw) => {
            const isActive = sw.index === colorIndex;
            return (
              <button
                key={sw.index}
                type="button"
                onClick={() => setColorIndex(sw.index)}
                aria-label={sw.label}
                aria-pressed={isActive}
                title={sw.label}
                className={
                  "h-6 w-6 rounded-[6px] border transition-transform duration-150 ease-out hover:scale-[1.08] active:scale-95 " +
                  (isActive
                    ? "border-white/70 ring-1 ring-white/40"
                    : "border-white/[0.12]")
                }
                style={{ background: ANSI16_HEX[sw.index] }}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-black/30 px-5 py-3 md:px-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
          Generated escape sequence
        </div>
        <pre className="mt-2 overflow-x-auto font-mono text-[12px] leading-relaxed text-[#9CC09F]">
          <code>printf "{escapeSeq}"</code>
        </pre>
      </div>
    </div>
  );
}

function StyleKey({
  active,
  onClick,
  children,
  bold,
  italic,
  underline,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex h-7 min-w-[28px] items-center justify-center rounded-[6px] border px-2 font-mono text-[12px] transition-colors " +
        (active
          ? "border-white/30 bg-[#E8E8E6] text-[#0E0E10]"
          : "border-white/[0.1] bg-[#0E0E10] text-[#A8A8A4] hover:border-white/20 hover:text-[#E8E8E6]")
      }
      style={{
        fontWeight: bold ? 700 : undefined,
        fontStyle: italic ? "italic" : undefined,
        textDecoration: underline ? "underline" : undefined,
      }}
    >
      {children}
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center rounded-[999px] border px-3 py-1 text-[12px] transition-colors " +
        (active
          ? "border-white/20 bg-[#E8E8E6] text-[#0E0E10]"
          : "border-white/[0.1] bg-[#0E0E10] text-[#A8A8A4] hover:border-white/20 hover:text-[#E8E8E6]")
      }
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared CSS (card pan animation)                                             */
/* -------------------------------------------------------------------------- */

function GuideStyles() {
  return (
    <style>{`
      @keyframes guide-card-pan {
        0%   { transform: scale(1.2) translate3d(-2.5%, 0, 0); }
        100% { transform: scale(1.2) translate3d(2.5%, 0, 0); }
      }
      .card-pan {
        transform: scale(1.2);
        animation: guide-card-pan 26s cubic-bezier(0.37, 0, 0.63, 1) infinite alternate;
        will-change: transform;
      }
      @media (prefers-reduced-motion: reduce) {
        .card-pan { animation: none; }
      }
    `}</style>
  );
}

/* -------------------------------------------------------------------------- */
/* Scroll-entry reveal                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Fades a block in as it enters the viewport (translateY + opacity over a
 * gentle ease). Uses IntersectionObserver, respects prefers-reduced-motion,
 * and renders visible by default if the observer never fires.
 */
function Reveal({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "section";
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLElement>}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition:
          "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Static building blocks                                                      */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <>
      <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
        {eyebrow}
      </div>
      <h2
        className="mt-3 font-serif text-3xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
        style={{
          fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h2>
    </>
  );
}

/**
 * Forward-navigation block at the foot of the guide. Two cards: "Try the
 * builder" → /builder and "Browse examples" → /community. The anchor text is
 * keyword-rich on purpose — these are the two highest-value internal links a
 * reader of the guide can follow.
 */
function ContinueReading() {
  return (
    <Reveal as="section" className="mt-16 border-t border-white/[0.06] pt-12">
      <div className="text-[12px] uppercase tracking-[0.14em] text-[#8A8A86]">
        Continue reading
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/builder"
          title="Claude Code Statusline Builder"
          className="group flex flex-col gap-3 rounded-[10px] border border-white/[0.08] bg-[#161618] p-6 no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
            Try the builder
          </div>
          <h3
            className="font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6]"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Open the Claude Code statusline builder.
          </h3>
          <p className="text-[14px] leading-relaxed text-[#8A8A86]">
            Drag elements, style them, and generate a one-line installer for
            macOS, Linux, or Windows.
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#E8E8E6]">
            Start building
            <CaretRight size={12} weight="bold" />
          </div>
        </Link>

        <Link
          href="/community"
          title="Community-published Claude Code statusline designs"
          className="group flex flex-col gap-3 rounded-[10px] border border-white/[0.08] bg-[#161618] p-6 no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
            Browse examples
          </div>
          <h3
            className="font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6]"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            See real Claude Code statusline designs.
          </h3>
          <p className="text-[14px] leading-relaxed text-[#8A8A86]">
            Community-published statuslines you can preview, install with one
            command, or fork into the builder.
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#E8E8E6]">
            Browse community gallery
            <CaretRight size={12} weight="bold" />
          </div>
        </Link>
      </div>
    </Reveal>
  );
}

function SummaryCard({
  label,
  title,
  body,
  image,
  panDelayMs = 0,
}: {
  label: string;
  title: string;
  body: string;
  image: string;
  panDelayMs?: number;
}) {
  return (
    <article className="group relative isolate flex min-h-[248px] flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#161618] p-6 transition-colors hover:border-white/[0.16]">
      {/* Blurry, zoomed, slowly panning screenshot of the real app. The image
          is scaled well past the frame so the left↔right pan never reveals an
          edge; a dark gradient keeps the foreground text legible. */}
      <div
        aria-hidden
        className="card-pan pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.6] saturate-[1.2] transition-opacity duration-500 group-hover:opacity-[0.8]"
        style={{
          backgroundImage: `url(${image})`,
          filter: "blur(1px)",
          animationDelay: `${panDelayMs}ms`,
        }}
      />
      {/* Scrim is darkest at the top (where the label/title/body sit) and
          clears toward the bottom so the screenshot reads plainly there. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#0E0E10]/95 via-[#0E0E10]/70 to-[#0E0E10]/15"
      />
      <div className="font-mono text-[12px] text-[#8A8A86]">{label}</div>
      <h2
        className="mt-5 font-serif text-2xl tracking-[-0.03em] text-[#E8E8E6]"
        style={{
          fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[#A8A8A4]">{body}</p>
    </article>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal as="section" className="mt-20 border-t border-white/[0.06] pt-12">
      <h2
        className="font-serif text-3xl leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
        style={{
          fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
        }}
      >
        {title}
      </h2>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-[#A8A8A4]">
        {children}
      </div>
    </Reveal>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-black/30">
      <div className="border-b border-white/[0.06] px-4 py-2 font-mono text-[12px] text-[#8A8A86]">
        {label}
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[12px] leading-relaxed text-[#E8E8E6]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-[10px] border border-white/[0.06] bg-[#161618] p-4 text-[14px] leading-relaxed text-[#A8A8A4]">
      <CheckCircleIcon
        size={16}
        weight="bold"
        className="mt-0.5 shrink-0 text-[#9CC09F]"
      />
      <span>{text}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  tag,
  accent,
  title,
  body,
}: {
  icon: React.ReactNode;
  tag: string;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#161618] p-5 transition-colors hover:border-white/[0.16]">
      {/* Faint accent wash that warms on hover — keeps the grid from reading flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.06] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.14]"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/[0.08] bg-[#0E0E10]"
          style={{ color: accent }}
        >
          {icon}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6F6B]">
          {tag}
        </span>
      </div>
      <h3 className="mt-4 text-[15px] font-medium text-[#E8E8E6]">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#8A8A86]">{body}</p>
    </article>
  );
}

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Is it called a statusline or a status bar?",
    answer:
      "Claude Code documentation uses statusline. People often describe the same area as a status line or status bar because it sits at the bottom of the terminal.",
  },
  {
    question: "Do I need to edit settings.json manually?",
    answer:
      "No. The builder creates an installer that structurally merges the statusLine setting into your Claude settings while preserving other top-level keys.",
  },
  {
    question: "Does this work on Windows?",
    answer:
      "Yes. The builder can generate a PowerShell installer for Windows and a bash installer for macOS or Linux.",
  },
  {
    question: "Can I customize colors and segments?",
    answer:
      "Yes. You can add, remove, reorder, and style statusline elements visually, including ANSI colors and conditional elements.",
  },
  {
    question: "Can I share my Claude Code statusline?",
    answer:
      "Yes. You can publish a design to the community gallery and other users can preview or fork it into their own builder.",
  },
];

/**
 * FAQ as a single-open accordion. Boxes stripped, items separated by a
 * border-bottom only, with a sharp +/- toggle — per the minimalist-ui
 * accordion spec. First item opens by default.
 */
function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <GuideSection title="Frequently asked questions">
      <div className="-mt-1">
        {FAQS.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div key={faq.question} className="border-b border-white/[0.07]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-[#E8E8E6]"
              >
                <span className="text-[16px] font-medium text-[#E8E8E6]">
                  {faq.question}
                </span>
                <span className="shrink-0 text-[#8A8A86]">
                  {isOpen ? (
                    <Minus size={16} weight="bold" />
                  ) : (
                    <Plus size={16} weight="bold" />
                  )}
                </span>
              </button>
              <div
                className="grid transition-all duration-300 ease-out"
                style={{
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[72ch] pb-6 text-[14px] leading-relaxed text-[#8A8A86]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GuideSection>
  );
}

export default ClaudeCodeStatuslineGuidePage;
