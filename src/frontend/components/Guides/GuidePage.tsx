/**
 * Renders a `GuidePageData` (see guideContent.ts). One component drives every
 * guide, so the pillar and the /statusline-command page cannot drift apart, and
 * the crawlable static shell (static-content/staticContent.ts) walks the same
 * data.
 */
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  Info,
  Lightbulb,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import { getTemplate } from "@statusline/shared/templates";
import { Link } from "../../router";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import {
  calloutLead,
  formatGuideDate,
  type GuideBlock,
  type GuideFigure,
  type GuidePageData,
} from "./guideContent";
import {
  BuilderLink,
  CodeBlock,
  GuideStyles,
  Inline,
  Pill,
  Reveal,
  SERIF,
  useReducedMotion,
} from "./guideUi";
import { GuideWidget } from "./guideWidgets";

type TemplateLike = NonNullable<ReturnType<typeof getTemplate>>;

const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-5 py-3 text-[14px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]";
const SECONDARY_BTN =
  "inline-flex items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-[#161618] px-5 py-3 text-[14px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]";

function templatesFor(ids: string[]): TemplateLike[] {
  return ids
    .map((id) => getTemplate(id))
    .filter((t): t is TemplateLike => Boolean(t));
}

/* -------------------------------------------------------------------------- */
/* Hero terminals                                                              */
/* -------------------------------------------------------------------------- */

const FAKE_SESSION_LINES = [
  "> add rate limiting to the login route",
  "  Reading src/routes/login.ts ...",
  "  Edited 2 files, ran the tests, all passing.",
];

function useAnsi(template: TemplateLike | undefined): string {
  return useMemo(
    () => (template ? renderToAnsi(template.design, DEFAULT_MOCK_STDIN) : ""),
    [template],
  );
}

/** Cycles through real templates, rendered live. Pauses on hover/focus and for reduced motion. */
function RotatingTerminal({ templateIds }: { templateIds: string[] }) {
  const templates = useMemo(() => templatesFor(templateIds), [templateIds]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || paused || templates.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % templates.length),
      3600,
    );
    return () => clearInterval(timer);
  }, [reduced, paused, templates.length]);

  const active = templates[index] ?? templates[0];
  const ansi = useAnsi(active);
  if (!active) return null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <TerminalFrame bodyClassName="px-5 py-5 text-[13px] md:text-[14px]">
        <div className="flex min-h-[132px] flex-col justify-between gap-6">
          <div className="text-[#6F6F6B]">
            {FAKE_SESSION_LINES.map((line) => (
              <div key={line} className="whitespace-pre">
                {line}
              </div>
            ))}
          </div>
          <div className="min-h-[2.6em] whitespace-pre border-t border-white/[0.06] pt-3">
            <AnsiToHtml ansi={ansi} />
          </div>
        </div>
      </TerminalFrame>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview design">
          {templates.map((t, i) => (
            <Pill key={t.id} active={i === index} onClick={() => setIndex(i)}>
              {t.name}
            </Pill>
          ))}
        </div>
        <BuilderLink
          templateId={active.id}
          title={`Open the ${active.name} template in the builder`}
          className="inline-flex items-center gap-1 text-[13px] text-[#E8E8E6]/85 no-underline transition-colors hover:text-[#E8E8E6]"
        >
          Fork {active.name} in the builder
          <CaretRight size={12} weight="bold" />
        </BuilderLink>
      </div>
      <p className="mt-2 text-[12px] text-[#6F6F6B]">
        Live render with sample session data. The lines above the bar are illustrative.
      </p>
    </div>
  );
}

/** Types a slash command, then shows the kind of bar such a script can print. */
function PromptTerminal({
  prompt,
  templateId,
}: {
  prompt: string;
  templateId: string;
}) {
  const template = getTemplate(templateId);
  const ansi = useAnsi(template);
  // Full text on the server / with reduced motion; typed out in the browser otherwise.
  const [count, setCount] = useState(() =>
    typeof window !== "undefined" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 0
      : prompt.length,
  );
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (count >= prompt.length) return;
    const timer = setTimeout(() => setCount((c) => c + 1), count === 0 ? 500 : 34);
    return () => clearTimeout(timer);
  }, [count, prompt.length, run]);

  const done = count >= prompt.length;
  return (
    <div>
      <TerminalFrame bodyClassName="px-5 py-5 text-[13px] md:text-[14px]">
        <div className="flex min-h-[176px] flex-col justify-between gap-6">
          <div>
            <div className="whitespace-pre-wrap break-words">
              <span className="text-[#d97757]">&gt; </span>
              <span>{prompt.slice(0, count)}</span>
              {done ? null : <span className="guide-blink text-[#E8E8E6]">|</span>}
            </div>
            {done ? (
              <div className="guide-rise mt-3 text-[#6F6F6B]">
                Claude writes the script and adds a statusLine entry to settings.json.
              </div>
            ) : null}
          </div>
          <div
            className={
              "min-h-[1.6em] whitespace-pre border-t border-white/[0.06] pt-3 transition-opacity duration-300 " +
              (done ? "opacity-100" : "opacity-25")
            }
          >
            <AnsiToHtml ansi={ansi} />
          </div>
        </div>
      </TerminalFrame>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[#6F6F6B]">
          Illustrative: Claude's wording varies. The bar is rendered live from the{" "}
          {template?.name ?? "sample"} template.
        </p>
        <button
          type="button"
          onClick={() => {
            setCount(0);
            setRun((r) => r + 1);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#A8A8A4] transition-colors hover:text-[#E8E8E6]"
        >
          <ArrowCounterClockwise size={12} weight="bold" />
          Replay
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table of contents                                                           */
/* -------------------------------------------------------------------------- */

function jumpTo(id: string, reduced: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  try {
    history.replaceState(null, "", `#${id}`);
  } catch {
    // Some embedded webviews forbid replaceState; scrolling already worked.
  }
}

function Toc({
  items,
  activeId,
}: {
  items: Array<{ id: string; title: string }>;
  activeId: string;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="guide-toc-list"
        className="flex w-full items-center justify-between rounded-[10px] border border-white/[0.08] bg-[#161618] px-4 py-3 text-left text-[13px] text-[#E8E8E6] lg:hidden"
      >
        On this page
        <CaretDown
          size={14}
          weight="bold"
          className={"transition-transform duration-200 " + (open ? "rotate-180" : "")}
        />
      </button>
      <p className="mb-3 hidden font-mono text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B] lg:block">
        On this page
      </p>
      <ol
        id="guide-toc-list"
        className={
          (open ? "mt-2 block" : "hidden") +
          " rounded-[10px] border border-white/[0.08] bg-[#161618] p-2 lg:mt-0 lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
        }
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? "location" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  setOpen(false);
                  jumpTo(item.id, reduced);
                }}
                className={
                  "block border-white/[0.08] px-3 py-1.5 text-[13px] leading-snug no-underline transition-colors lg:border-l lg:py-1.5 " +
                  (active
                    ? "text-[#E8E8E6] lg:border-[#E8E8E6]"
                    : "text-[#8A8A86] hover:text-[#E8E8E6]")
                }
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ol>
      <BuilderLink
        title="Claude Code Statusline Builder"
        className="mt-6 hidden items-center gap-1.5 text-[13px] text-[#E8E8E6] no-underline hover:underline lg:inline-flex"
      >
        Open the builder
        <CaretRight size={12} weight="bold" />
      </BuilderLink>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Content blocks                                                              */
/* -------------------------------------------------------------------------- */

function Figure({ figure }: { figure: GuideFigure }) {
  const side = Boolean(figure.maxWidth);
  const image = (
    <div className="relative">
      <a href={figure.src} target="_blank" rel="noopener" title="Open the full-size screenshot" className="block">
        <img
          src={figure.src}
          alt={figure.alt}
          width={figure.width}
          height={figure.height}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full rounded-[10px] border border-white/[0.08]"
        />
      </a>
      {figure.marks?.map((m) => (
        <span
          key={m.n}
          aria-hidden
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          <span className="guide-ping absolute inset-0 rounded-full bg-[#E8E8E6]" />
          <span className="pointer-events-none relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#E8E8E6] font-mono text-[10px] font-semibold text-[#0E0E10] shadow-[0_0_0_2px_rgba(14,14,16,0.7)] md:h-6 md:w-6 md:text-[11px] md:shadow-[0_0_0_3px_rgba(14,14,16,0.7)]">
            {m.n}
          </span>
        </span>
      ))}
    </div>
  );
  const caption = (
    <figcaption className={side ? "md:pt-1" : "mt-3"}>
      <p className="text-[13px] leading-relaxed text-[#8A8A86]">
        <Inline text={figure.caption} />
      </p>
      {figure.marks?.length ? (
        <ol className="mt-3 space-y-2">
          {figure.marks.map((m) => (
            <li key={m.n} className="flex gap-2.5 text-[13px] leading-snug text-[#A8A8A4]">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.16] font-mono text-[10px] text-[#E8E8E6]">
                {m.n}
              </span>
              {m.label}
            </li>
          ))}
        </ol>
      ) : null}
    </figcaption>
  );

  if (side) {
    return (
      <figure className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,var(--fig-w))_1fr] md:gap-8" style={{ ["--fig-w" as string]: `${figure.maxWidth}px` }}>
        {image}
        {caption}
      </figure>
    );
  }
  return (
    <figure>
      {image}
      {caption}
    </figure>
  );
}

const CALLOUT_TONES = {
  note: { Icon: Info, color: "#8FB8DA" },
  tip: { Icon: Lightbulb, color: "#9CC09F" },
  warn: { Icon: Warning, color: "#D8C79F" },
} as const;

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="max-w-[68ch] text-[16px] leading-[1.75] text-[#A8A8A4]">
          <Inline text={block.text} />
        </p>
      );
    case "code":
      return (
        <Reveal>
          <CodeBlock label={block.label} code={block.code} />
        </Reveal>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={
            "max-w-[68ch] space-y-2 pl-5 text-[16px] leading-[1.7] text-[#A8A8A4] marker:text-[#6F6F6B] " +
            (block.ordered ? "list-decimal" : "list-disc")
          }
        >
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "steps":
      return (
        <ol className="space-y-10">
          {block.items.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[2.25rem_minmax(0,1fr)] md:gap-x-5">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-[#161618] font-mono text-[12px] text-[#E8E8E6]">
                  {i + 1}
                </span>
                {i < block.items.length - 1 ? (
                  <span aria-hidden className="mt-2 w-px flex-1 bg-white/[0.08]" />
                ) : null}
              </div>
              <div className="min-w-0 space-y-5 pb-2">
                <h3 className="pt-1 text-[18px] font-medium leading-snug text-[#E8E8E6]">
                  {step.title}
                </h3>
                <p className="max-w-[68ch] text-[16px] leading-[1.75] text-[#A8A8A4]">
                  <Inline text={step.text} />
                </p>
                {step.code ? (
                  <Reveal>
                    <CodeBlock label={step.code.label} code={step.code.code} />
                  </Reveal>
                ) : null}
                {step.figure ? (
                  <Reveal>
                    <Figure figure={step.figure} />
                  </Reveal>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      );
    case "table": {
      // Below md each row becomes a labelled card (no sideways scrolling on a phone);
      // explicit ARIA roles keep the table semantics while display is overridden.
      const stack = !block.collapsible;
      const table = (
        <div className="overflow-x-auto rounded-[10px] border border-white/[0.08]">
          <table
            role="table"
            className={
              "w-full border-collapse text-left text-[14px] leading-relaxed " +
              (stack ? "block md:table md:min-w-[560px]" : "min-w-[560px]")
            }
          >
            {block.caption ? (
              <caption className="caption-top border-b border-white/[0.06] px-4 py-3 text-left text-[13px] text-[#8A8A86]">
                {block.caption}
              </caption>
            ) : null}
            <thead role="rowgroup" className={stack ? "hidden md:table-header-group" : undefined}>
              <tr role="row" className="bg-[#161618]">
                {block.head.map((h) => (
                  <th
                    key={h}
                    role="columnheader"
                    scope="col"
                    className="border-b border-white/[0.08] px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#8A8A86]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup" className={stack ? "block md:table-row-group" : undefined}>
              {block.rows.map((row, r) => (
                <tr
                  key={r}
                  role="row"
                  className={
                    "border-b border-white/[0.05] last:border-b-0 " +
                    (stack ? "block px-4 py-3 md:table-row md:p-0" : "")
                  }
                >
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      role="cell"
                      data-label={c === 0 ? "" : (block.head[c] ?? "")}
                      className={
                        (stack
                          ? "block py-1 before:mb-0.5 before:block before:font-mono before:text-[10px] before:uppercase before:tracking-[0.1em] before:text-[#6F6F6B] before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3 md:align-top md:before:content-none "
                          : "px-4 py-3 align-top ") +
                        (c === 0 ? "font-medium text-[#E8E8E6]" : "text-[#A8A8A4]")
                      }
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      if (!block.collapsible) return <Reveal>{table}</Reveal>;
      return (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-[14px] text-[#E8E8E6] marker:hidden [&::-webkit-details-marker]:hidden">
            <CaretDown
              size={14}
              weight="bold"
              className="text-[#8A8A86] transition-transform duration-200 group-open:rotate-180"
            />
            {block.collapsible}
          </summary>
          <div className="mt-4">{table}</div>
        </details>
      );
    }
    case "callout": {
      const { Icon, color } = CALLOUT_TONES[block.tone];
      return (
        <Reveal>
          <aside
            className="flex gap-3 rounded-[10px] border border-white/[0.08] bg-[#161618] p-4 md:p-5"
            style={{ borderLeft: `2px solid ${color}` }}
          >
            <Icon size={18} weight="bold" className="mt-0.5 shrink-0" style={{ color }} />
            <p className="text-[14px] leading-[1.7] text-[#A8A8A4]">
              <strong className="font-semibold text-[#E8E8E6]">{calloutLead(block.title)} </strong>
              <Inline text={block.text} />
            </p>
          </aside>
        </Reveal>
      );
    }
    case "figure":
      return (
        <Reveal>
          <Figure figure={block.figure} />
        </Reveal>
      );
    case "links":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {block.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col gap-1.5 rounded-[10px] border border-white/[0.08] bg-[#161618] p-4 no-underline transition-colors hover:border-white/[0.18] hover:bg-[#1C1C1F]"
            >
              <span className="flex items-center justify-between gap-2 text-[15px] font-medium text-[#E8E8E6]">
                {item.title}
                <CaretRight
                  size={13}
                  weight="bold"
                  className="text-[#6F6F6B] transition-transform duration-150 group-hover:translate-x-0.5"
                />
              </span>
              <span className="text-[13px] leading-relaxed text-[#8A8A86]">{item.text}</span>
            </Link>
          ))}
        </div>
      );
    case "widget":
      return (
        <Reveal>
          <div className="space-y-3">
            <GuideWidget id={block.id} />
            {block.caption ? (
              <p className="text-[13px] leading-relaxed text-[#8A8A86]">
                <Inline text={block.caption} />
              </p>
            ) : null}
          </div>
        </Reveal>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

function H1WithLogo({ text }: { text: string }) {
  const at = text.indexOf("Claude Code");
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <ClaudeCodeLogo
        size={40}
        className="mr-2 inline-flex align-[-0.08em] md:h-[54px] md:w-[54px]"
      />
      {text.slice(at)}
    </>
  );
}

function Hero({ page }: { page: GuidePageData }) {
  return (
    <header className="max-w-3xl">
      <div className="mb-6 inline-flex rounded-[999px] border border-white/[0.08] bg-[#161618] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
        {page.eyebrow}
      </div>
      <h1
        className="text-[44px] leading-[1.03] tracking-[-0.035em] text-[#E8E8E6] md:text-7xl"
        style={SERIF}
      >
        <H1WithLogo text={page.h1} />
      </h1>
      <p className="mt-7 max-w-[62ch] text-[17px] leading-relaxed text-[#A8A8A4] md:text-[18px]">
        <Inline text={page.lede} />
      </p>
      <p className="mt-5 text-[13px] text-[#6F6F6B]">
        Updated <time dateTime={page.modified}>{formatGuideDate(page.modified)}</time>
        <span aria-hidden> &middot; </span>
        {page.readingMinutes} min read
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <BuilderLink title="Claude Code Statusline Builder" className={PRIMARY_BTN}>
          Open the Claude Code statusline builder
          <CaretRight size={14} weight="bold" />
        </BuilderLink>
        <Link href="/community" title="Community-published Claude Code statusline designs" className={SECONDARY_BTN}>
          See real examples
        </Link>
      </div>
    </header>
  );
}

function TemplateStrip({ ids }: { ids: string[] }) {
  const templates = useMemo(() => templatesFor(ids), [ids]);
  return (
    <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
      {templates.map((t) => (
        <BuilderLink
          key={t.id}
          templateId={t.id}
          title={`Open the ${t.name} template in the builder`}
          className="group flex flex-col gap-2 rounded-[10px] border border-white/[0.08] bg-[#0E0E10] p-4 no-underline transition-colors hover:border-white/[0.18]"
        >
          <span className="flex items-center justify-between text-[13px] font-medium text-[#E8E8E6]">
            {t.name}
            <CaretRight size={12} weight="bold" className="text-[#6F6F6B] transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
          <TemplateLine templateId={t.id} />
          <span className="text-[12px] text-[#6F6F6B]">Start from this template</span>
        </BuilderLink>
      ))}
    </div>
  );
}

function TemplateLine({ templateId }: { templateId: string }) {
  const ansi = useAnsi(getTemplate(templateId));
  return (
    <span className="block overflow-hidden whitespace-pre font-mono text-[11px] leading-tight text-[#E8E8E6] [mask-image:linear-gradient(to_right,black_78%,transparent)]">
      <AnsiToHtml ansi={ansi} />
    </span>
  );
}

export function GuidePage({ page }: { page: GuidePageData }) {
  const tocItems = useMemo(
    () => [
      ...page.sections.map((s) => ({ id: s.id, title: s.title })),
      { id: "faq", title: "Frequently asked questions" },
    ],
    [page],
  );
  const [activeId, setActiveId] = useState(tocItems[0]?.id ?? "");
  const progressRef = useRef<HTMLDivElement | null>(null);

  // Land on #hash deep links (the bundle mounts after the browser's own attempt).
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById(decodeURIComponent(id))?.scrollIntoView(),
    );
    return () => cancelAnimationFrame(frame);
  }, [page.path]);

  // Reading-progress line under the nav + scroll-spy for the table of contents.
  useEffect(() => {
    const ids = tocItems.map((t) => t.id);
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = progressRef.current;
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.transform = `scaleX(${ratio})`;
      }
      // Active section = the last one whose top has passed the sticky nav.
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tocItems]);

  const templateIds =
    page.hero.kind === "rotate"
      ? page.hero.templateIds.slice(0, 3)
      : [page.hero.templateId, "minimal", "verbose-dev"];

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <GuideStyles />
      <div
        ref={progressRef}
        aria-hidden
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-[#E8E8E6]/70"
        style={{ transform: "scaleX(0)" }}
      />
      <main className="mx-auto max-w-[1120px] px-6 py-16 md:px-8 md:py-24">
        <Hero page={page} />

        <div className="mt-14 max-w-4xl">
          {page.hero.kind === "rotate" ? (
            <RotatingTerminal templateIds={page.hero.templateIds} />
          ) : (
            <PromptTerminal prompt={page.hero.prompt} templateId={page.hero.templateId} />
          )}
        </div>

        <div className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
          <Toc items={tocItems} activeId={activeId} />

          <article className="min-w-0">
            <aside className="rounded-[10px] border border-white/[0.1] bg-[#161618] p-6 md:p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
                {page.tldr.title}
              </p>
              <ul className="mt-4 space-y-3">
                {page.tldr.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-[#A8A8A4]">
                    <CheckCircle size={17} weight="bold" className="mt-1 shrink-0 text-[#9CC09F]" />
                    <span>
                      <Inline text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            </aside>

            {page.sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                className="mt-20 scroll-mt-24 border-t border-white/[0.06] pt-12"
              >
                <div className="font-mono text-[12px] text-[#6F6F6B]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h2
                  className="mt-2 text-[32px] leading-[1.1] tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
                  style={SERIF}
                >
                  {section.title}
                </h2>
                <div className="mt-7 space-y-6">
                  {section.blocks.map((block, b) => (
                    <Block key={b} block={block} />
                  ))}
                </div>
              </section>
            ))}

            <section id="faq" className="mt-20 scroll-mt-24 border-t border-white/[0.06] pt-12">
              <h2
                className="text-[32px] leading-[1.1] tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
                style={SERIF}
              >
                Frequently asked questions
              </h2>
              <div className="mt-6">
                {page.faqs.map((faq) => (
                  <details key={faq.q} className="group border-b border-white/[0.07]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-medium text-[#E8E8E6] marker:hidden [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <CaretDown
                        size={16}
                        weight="bold"
                        className="shrink-0 text-[#8A8A86] transition-transform duration-200 group-open:rotate-180"
                      />
                    </summary>
                    <p className="max-w-[68ch] pb-6 text-[15px] leading-[1.75] text-[#A8A8A4]">
                      <Inline text={faq.a} />
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section className="mt-20 border-t border-white/[0.06] pt-12">
              <h2
                className="text-[32px] leading-[1.1] tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
                style={SERIF}
              >
                Keep reading
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {page.related.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="group flex flex-col gap-2 rounded-[10px] border border-white/[0.08] bg-[#161618] p-5 no-underline transition-colors hover:border-white/[0.16] hover:bg-[#1C1C1F]"
                  >
                    <span className="text-[16px] font-medium text-[#E8E8E6]">{r.title}</span>
                    <span className="text-[14px] leading-relaxed text-[#8A8A86]">{r.text}</span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#E8E8E6]">
                      Read more
                      <CaretRight size={12} weight="bold" className="transition-transform duration-150 group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-16 rounded-[10px] border border-white/[0.08] bg-[#161618] p-7 md:p-10">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
                Ready to build
              </div>
              <h2
                className="mt-4 text-[30px] leading-tight tracking-[-0.03em] text-[#E8E8E6] md:text-4xl"
                style={SERIF}
              >
                {page.cta.title}
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-[#8A8A86]">
                {page.cta.text}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <BuilderLink title="Claude Code Statusline Builder" className={PRIMARY_BTN}>
                  {page.cta.label}
                  <CaretRight size={14} weight="bold" />
                </BuilderLink>
                <Link href="/community" title="Browse Claude Code statusline examples" className={SECONDARY_BTN}>
                  Browse community designs
                </Link>
              </div>
              <TemplateStrip ids={templateIds} />
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
