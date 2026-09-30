/**
 * Interactive widgets embedded in the guide pages (see `WidgetId` in
 * guideContent.ts). All of them render with the real interpreter
 * (`renderToAnsi`), so what you see here is what the installed script prints.
 */
import { ArrowRight, CaretRight, TerminalWindow } from "@phosphor-icons/react";
import { useMemo, useState, type ReactNode } from "react";
import { ANSI16_HEX, styleToSgr } from "@statusline/shared/ansi";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import {
  DEFAULT_MOCK_STDIN,
  MOCK_PRESETS,
  getField,
} from "@statusline/shared/mockStdin";
import { getTemplate } from "@statusline/shared/templates";
import type { AnsiStyle, ClaudeStdin, Design } from "@statusline/shared/types";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import { StaticPreview } from "../Preview/StaticPreview";
import { STDIN_FIELDS, type WidgetId } from "./guideContent";
import { BuilderLink, CopyButton, Inline, Pill } from "./guideUi";

const SESSION_PRESETS: { id: string; label: string; mock: ClaudeStdin }[] = [
  { id: "fresh", label: "Fresh start", mock: MOCK_PRESETS.fresh ?? DEFAULT_MOCK_STDIN },
  { id: "working", label: "Mid-session", mock: DEFAULT_MOCK_STDIN },
  { id: "deep", label: "Deep session", mock: MOCK_PRESETS.deep ?? DEFAULT_MOCK_STDIN },
];

const MONO_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]";
const PANEL = "overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#161618]";

export function GuideWidget({ id }: { id: WidgetId }) {
  switch (id) {
    case "dataFlow":
      return <DataFlow />;
    case "colorGallery":
      return <ColorGallery />;
    case "styleLab":
      return <StyleLab />;
    case "stdinExplorer":
      return <StdinExplorer />;
  }
}

/* -------------------------------------------------------------------------- */
/* Data flow: Claude Code -> script -> status bar                              */
/* -------------------------------------------------------------------------- */

function FlowNode({
  step,
  title,
  mono,
  children,
}: {
  step: string;
  title: string;
  mono?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[10px] border border-white/[0.08] bg-[#0E0E10] p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-[#6F6F6B]">{step}</span>
        <h3 className="text-[14px] font-medium text-[#E8E8E6]">{title}</h3>
      </div>
      {mono ? (
        <code className="mt-2 w-fit rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-[#E8E8E6]">
          {mono}
        </code>
      ) : null}
      <div className="mt-2 text-[13px] leading-relaxed text-[#8A8A86]">
        {children}
      </div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-[#6F6F6B] md:flex-col md:py-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{label}</span>
      <ArrowRight
        size={16}
        weight="bold"
        className="guide-nudge rotate-90 md:rotate-0"
      />
    </div>
  );
}

const FLOW_TEMPLATE = "minimal";

function DataFlow() {
  const design = getTemplate(FLOW_TEMPLATE)?.design;
  const ansi = useMemo(
    () => (design ? renderToAnsi(design, DEFAULT_MOCK_STDIN) : ""),
    [design],
  );
  const excerpt = useMemo(
    () =>
      JSON.stringify(
        {
          model: { display_name: DEFAULT_MOCK_STDIN.model?.display_name },
          workspace: { current_dir: DEFAULT_MOCK_STDIN.workspace?.current_dir },
          context_window: {
            used_percentage: DEFAULT_MOCK_STDIN.context_window?.used_percentage,
          },
        },
        null,
        2,
      ),
    [],
  );

  return (
    <div className={PANEL + " p-4 md:p-6"}>
      <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-4">
        <FlowNode step="01" title="Claude Code">
          <span className="mb-2 block">
            <ClaudeCodeLogo size={20} />
          </span>
          Runs your command after each assistant message and hands it the session as JSON.
        </FlowNode>
        <FlowArrow label="JSON on stdin" />
        <FlowNode step="02" title="Your script" mono="~/.claude/statusline.sh">
          Reads the fields it wants and prints one line of text per row.
        </FlowNode>
        <FlowArrow label="text on stdout" />
        <FlowNode step="03" title="The status bar">
          Claude Code draws whatever the script printed, colors included, below the prompt.
        </FlowNode>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[2fr_3fr]">
        <div className="overflow-hidden rounded-[10px] border border-white/[0.06] bg-black/30">
          <div className={MONO_LABEL + " border-b border-white/[0.06] px-4 py-2"}>
            stdin (excerpt)
          </div>
          <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-[#9CC09F]">
            <code>{excerpt}</code>
          </pre>
        </div>
        <div className="overflow-hidden rounded-[10px] border border-white/[0.06] bg-black/30">
          <div className={MONO_LABEL + " border-b border-white/[0.06] px-4 py-2"}>
            stdout, rendered
          </div>
          <div className="p-3">
            <TerminalFrame bodyClassName="px-3 py-3 text-[12px]">
              <AnsiToHtml ansi={ansi} />
            </TerminalFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stdin explorer                                                              */
/* -------------------------------------------------------------------------- */

function formatValue(value: unknown): string {
  if (value === undefined) return "(not present in this session)";
  return JSON.stringify(value);
}

function StdinExplorer() {
  const [selected, setSelected] = useState(0);
  const [sessionId, setSessionId] = useState("working");
  const field = STDIN_FIELDS[selected] ?? STDIN_FIELDS[0];
  const session = SESSION_PRESETS.find((s) => s.id === sessionId) ?? SESSION_PRESETS[1];
  if (!field || !session) return null;
  const value = getField(session.mock, field.path);

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
        <span className={MONO_LABEL + " mr-1"}>Session</span>
        {SESSION_PRESETS.map((s) => (
          <Pill key={s.id} active={s.id === session.id} onClick={() => setSessionId(s.id)}>
            {s.label}
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,17rem)_1fr]">
        <ul
          aria-label="Session JSON fields"
          className="max-h-[17rem] overflow-y-auto border-b border-white/[0.06] p-2 md:max-h-[22rem] md:border-b-0 md:border-r"
        >
          {STDIN_FIELDS.map((f, i) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                className={
                  "w-full truncate rounded-[6px] px-3 py-1.5 text-left font-mono text-[12px] transition-colors " +
                  (i === selected
                    ? "bg-[#E8E8E6] text-[#0E0E10]"
                    : "text-[#A8A8A4] hover:bg-white/[0.05] hover:text-[#E8E8E6]")
                }
              >
                {f.path}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <div className={MONO_LABEL}>Value in this session</div>
            <div className="mt-2 break-all rounded-[8px] bg-black/30 px-3 py-2 font-mono text-[13px] text-[#9CC09F]">
              {formatValue(value)}
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-[#A8A8A4]">
            <Inline text={field.holds} />
          </p>
          <p className="text-[13px] leading-relaxed text-[#8A8A86]">
            <span className="font-medium text-[#E8E8E6]">Watch out: </span>
            <Inline text={field.watch} />
          </p>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className={MONO_LABEL}>Read it in bash</span>
              <CopyButton text={field.jq} label={`jq for ${field.path}`} />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-[8px] bg-black/30 px-3 py-2 font-mono text-[12px] text-[#E8E8E6]">
              <code>{field.jq}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Color gallery                                                               */
/* -------------------------------------------------------------------------- */

// Colorful templates that render with plain terminal glyphs (no Nerd Font).
const GALLERY_TEMPLATE_IDS = [
  "minimal",
  "verbose-dev",
  "pastel-dashboard",
  "vital-signs",
  "neon-pulse",
] as const;

function ColorGallery() {
  const templates = useMemo(
    () =>
      GALLERY_TEMPLATE_IDS.map((id) => getTemplate(id)).filter(
        (t): t is NonNullable<ReturnType<typeof getTemplate>> => Boolean(t),
      ),
    [],
  );
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "minimal");
  const [sessionId, setSessionId] = useState("working");

  const active = templates.find((t) => t.id === templateId) ?? templates[0];
  const session = SESSION_PRESETS.find((s) => s.id === sessionId) ?? SESSION_PRESETS[1];
  if (!active || !session) return null;

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
        <span className={MONO_LABEL + " mr-1 hidden sm:inline"}>Design</span>
        {templates.map((t) => (
          <Pill key={t.id} active={t.id === active.id} onClick={() => setTemplateId(t.id)}>
            {t.name}
          </Pill>
        ))}
      </div>

      <div className="p-5 md:p-6">
        <StaticPreview design={active.design} mock={session.mock} />
        <p className="mt-4 text-[13px] leading-relaxed text-[#8A8A86]">{active.description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className={MONO_LABEL + " mr-1"}>Session</span>
          {SESSION_PRESETS.map((s) => (
            <Pill key={s.id} active={s.id === session.id} onClick={() => setSessionId(s.id)}>
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
        <BuilderLink
          templateId={active.id}
          title={`Open the ${active.name} template in the builder`}
          className="inline-flex items-center gap-1 text-[13px] text-[#E8E8E6]/85 no-underline transition-colors hover:text-[#E8E8E6]"
        >
          Fork this design
          <CaretRight size={12} weight="bold" />
        </BuilderLink>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ANSI style lab                                                              */
/* -------------------------------------------------------------------------- */

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

const ESC = String.fromCharCode(27);

function StyleKey({
  active,
  onClick,
  children,
  label,
  fontStyle,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  label: string;
  fontStyle: { bold?: boolean; italic?: boolean; underline?: boolean };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={
        "inline-flex h-7 min-w-[28px] items-center justify-center rounded-[6px] border px-2 font-mono text-[12px] transition-colors " +
        (active
          ? "border-white/30 bg-[#E8E8E6] text-[#0E0E10]"
          : "border-white/[0.1] bg-[#0E0E10] text-[#A8A8A4] hover:border-white/20 hover:text-[#E8E8E6]")
      }
      style={{
        fontWeight: fontStyle.bold ? 700 : undefined,
        fontStyle: fontStyle.italic ? "italic" : undefined,
        textDecoration: fontStyle.underline ? "underline" : undefined,
      }}
    >
      {children}
    </button>
  );
}

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

  // Only the model segment is user-styled; the rest stay fixed so the styled
  // token reads against neutral context.
  const design: Design = useMemo(
    () => ({
      version: 1,
      name: "Style lab",
      elements: [
        { id: "lab_model", type: "static", text: "Fable 5.1", style, suffix: " " },
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

  const escapeSeq = useMemo(
    () => `${styleToSgr(style).split(ESC).join("\\e")}Fable 5.1\\e[0m`,
    [style],
  );

  return (
    <div className={PANEL}>
      <div className="p-5 md:p-6">
        <StaticPreview design={design} />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className={MONO_LABEL + " mr-1"}>Style</span>
          <StyleKey active={bold} onClick={() => setBold((v) => !v)} label="Bold" fontStyle={{ bold: true }}>
            B
          </StyleKey>
          <StyleKey active={italic} onClick={() => setItalic((v) => !v)} label="Italic" fontStyle={{ italic: true }}>
            I
          </StyleKey>
          <StyleKey active={underline} onClick={() => setUnderline((v) => !v)} label="Underline" fontStyle={{ underline: true }}>
            U
          </StyleKey>
          <StyleKey active={dim} onClick={() => setDim((v) => !v)} label="Dim" fontStyle={{}}>
            dim
          </StyleKey>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={MONO_LABEL + " mr-1"}>Color</span>
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
                  (isActive ? "border-white/70 ring-1 ring-white/40" : "border-white/[0.12]")
                }
                style={{ background: ANSI16_HEX[sw.index] }}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-black/30 px-5 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className={MONO_LABEL}>Generated escape sequence</span>
          <CopyButton text={`printf "${escapeSeq}"`} label="escape sequence" />
        </div>
        <pre className="mt-2 overflow-x-auto font-mono text-[12px] leading-relaxed text-[#9CC09F]">
          <code>printf "{escapeSeq}"</code>
        </pre>
      </div>
    </div>
  );
}
