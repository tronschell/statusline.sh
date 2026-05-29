import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowsHorizontal,
  ArrowsOutLineHorizontal,
  Check,
  DotsThree,
  Prohibit,
} from "@phosphor-icons/react";
import Modal from "../Modal/Modal";
import { useUiStore } from "../../store/uiStore";
import { useDesignStore } from "../../store/designStore";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { ClaudeStdin, Element } from "@statusline/shared/types";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import { TerminalFrame } from "../Layout/TerminalFrame";
import {
  SEPARATOR_OPTIONS,
  analyzeSeparators,
  detectSpacingStyle,
  type AutoInsertMode,
} from "../../lib/separators";

const MODE_NOUN: Record<AutoInsertMode, string> = {
  none: "no",
  padding: "padding",
  spacer: "spacer",
  separator: "separator",
};

// Mock elements used by the looping demo — rendered through the real
// interpreter + mock stdin so they look exactly like the live preview
// (colored model name, directory) rather than placeholder labels.
const DEMO_MODEL: Element = {
  id: "demo-model",
  type: "model",
  style: { bold: true, fg: { kind: "ansi16", index: 14 } },
};
const DEMO_CWD: Element = {
  id: "demo-cwd",
  type: "cwd",
  mode: "basename",
  style: { fg: { kind: "ansi16", index: 7 } },
};

function parseMock(json: string): ClaudeStdin {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ClaudeStdin;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_MOCK_STDIN;
}

function renderDemoElement(el: Element, mock: ClaudeStdin): string {
  try {
    return renderToAnsi({ version: 1, name: "demo", elements: [el] }, mock);
  } catch {
    return "";
  }
}

/**
 * A button that, on click, runs `onConfirm` and flashes a green checkmark
 * overlay that pops in, holds, then fades back out — visual confirmation that
 * a mass edit was applied. The overlay is driven by the `sl-confirm-flash`
 * keyframe; a timeout (not animationend) clears it so the fallback still works
 * under `prefers-reduced-motion`, where animations are disabled.
 */
function FlashConfirmButton({
  onConfirm,
  className,
  children,
}: {
  onConfirm: () => void;
  className: string;
  children: ReactNode;
}) {
  const [flashKey, setFlashKey] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleClick() {
    onConfirm();
    setFlashKey((k) => k + 1); // remount the overlay so the animation restarts
    setFlashing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashing(false), 1300);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      {flashing && (
        <span
          key={flashKey}
          aria-hidden="true"
          className="sl-confirm-flash absolute inset-0 flex items-center justify-center rounded-[6px] bg-[#5BA66A] text-[#0E0E10]"
        >
          <Check size={16} weight="bold" />
        </span>
      )}
    </button>
  );
}

export interface BuilderSetupModalProps {
  isOpen: boolean;
  onClose(): void;
  /** Template id the builder was seeded from, if any. */
  templateId: string | null;
  /** Human-readable template name for the mass-change section. */
  templateName: string | null;
}

const MODES: ReadonlyArray<{
  value: AutoInsertMode;
  label: string;
  hint: string;
  Icon: typeof Prohibit;
}> = [
  { value: "none", label: "None", hint: "Add spacing yourself", Icon: Prohibit },
  {
    value: "padding",
    label: "Padding",
    hint: "Trailing space, like templates",
    Icon: ArrowsOutLineHorizontal,
  },
  {
    value: "spacer",
    label: "Spacer",
    hint: "Fixed blank gap element",
    Icon: ArrowsHorizontal,
  },
  {
    value: "separator",
    label: "Separator",
    hint: "A glyph between items",
    Icon: DotsThree,
  },
];

/** How the chosen spacing reads inside the looping demo + previews. */
function spacerLabel(width: number, char: string): string {
  const ch = char.length > 0 ? char.slice(0, 1) : " ";
  return `${width}× ${ch === " " ? "·" : ch}`;
}

export default function BuilderSetupModal({
  isOpen,
  onClose,
  templateId,
  templateName,
}: BuilderSetupModalProps) {
  const autoInsert = useUiStore((s) => s.autoInsert);
  const autoSeparatorText = useUiStore((s) => s.autoSeparatorText);
  const autoSpacerWidth = useUiStore((s) => s.autoSpacerWidth);
  const autoSpacerChar = useUiStore((s) => s.autoSpacerChar);
  const setAutoInsert = useUiStore((s) => s.setAutoInsert);
  const setAutoSeparatorText = useUiStore((s) => s.setAutoSeparatorText);
  const setAutoSpacerWidth = useUiStore((s) => s.setAutoSpacerWidth);
  const setAutoSpacerChar = useUiStore((s) => s.setAutoSpacerChar);
  const setBuilderSetupSeen = useUiStore((s) => s.setBuilderSetupSeen);
  const mockStdinJson = useUiStore((s) => s.mockStdinJson);

  const design = useDesignStore((s) => s.design);
  const replaceAllSeparators = useDesignStore((s) => s.replaceAllSeparators);
  const respaceFromConfig = useDesignStore((s) => s.respaceFromConfig);

  const usage = useMemo(() => analyzeSeparators(design), [design]);
  const spacingStyle = useMemo(() => detectSpacingStyle(design), [design]);

  function handleStart() {
    setBuilderSetupSeen(true);
    onClose();
  }

  // Render the demo's mock elements with the same interpreter + mock stdin the
  // live preview uses. In padding mode the model carries the trailing space it
  // would actually get, so the gap in the demo is the real thing.
  const mock = useMemo(() => parseMock(mockStdinJson), [mockStdinJson]);
  const modelAnsi = useMemo(() => {
    const el = autoInsert === "padding" ? { ...DEMO_MODEL, suffix: " " } : DEMO_MODEL;
    return renderDemoElement(el, mock);
  }, [mock, autoInsert]);
  const cwdAnsi = useMemo(() => renderDemoElement(DEMO_CWD, mock), [mock]);

  // The highlighted chip that reveals between the two elements in the demo.
  // null in `none` mode (nothing is inserted).
  const revealLabel: string | null =
    autoInsert === "separator"
      ? autoSeparatorText.trim() || "·"
      : autoInsert === "spacer"
        ? spacerLabel(autoSpacerWidth, autoSpacerChar)
        : autoInsert === "padding"
          ? "␣"
          : null;

  const demoCaption =
    autoInsert === "none"
      ? "Elements drop straight in with no automatic spacing — you control the gaps."
      : autoInsert === "padding"
        ? "The new element drops in, and a trailing space is added to the previous element — exactly how the built-in templates space things."
        : "The new element drops in, then the spacing appears between it and the previous one.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleStart}
      title="Set up spacing between elements"
      widthClass="max-w-xl"
      closeLabel="Start building"
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm leading-relaxed text-[#A8A8A4]">
          As you add elements, the builder can automatically drop a little
          spacing between them so items don&apos;t run together. Pick a default
          now — you can change or remove any of it later.
        </p>

        {/* Mode picker */}
        <div role="radiogroup" aria-label="Auto-spacing mode" className="grid grid-cols-2 gap-2">
          {MODES.map(({ value, label, hint, Icon }) => {
            const active = autoInsert === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAutoInsert(value)}
                className={[
                  "flex flex-col items-start gap-1 rounded-[10px] border p-3 text-left transition-colors duration-200",
                  active
                    ? "border-[#8FB8DA] bg-[#8FB8DA]/[0.06]"
                    : "border-white/[0.06] bg-[#1C1C1F] hover:border-white/[0.16]",
                ].join(" ")}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-[#E8E8E6]">
                  <Icon size={14} weight="bold" />
                  {label}
                </span>
                <span className="text-[11px] text-[#8A8A86]">{hint}</span>
              </button>
            );
          })}
        </div>

        {/* Separator suggestions + custom text */}
        {autoInsert === "separator" && (
          <div className="flex flex-col gap-3 rounded-[10px] border border-white/[0.06] bg-[#131315] p-4">
            <span className="text-xs uppercase tracking-wider text-[#8A8A86]">
              Separator
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SEPARATOR_OPTIONS.map((opt) => {
                const active = autoSeparatorText === opt.text;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAutoSeparatorText(opt.text)}
                    title={opt.label}
                    className={[
                      "rounded-[6px] border px-2.5 py-1.5 font-mono text-[12px] transition-colors duration-150",
                      active
                        ? "border-[#8FB8DA] bg-[#8FB8DA]/[0.08] text-[#E8E8E6]"
                        : "border-white/[0.06] bg-[#1C1C1F] text-[#A8A8A4] hover:border-white/[0.16]",
                    ].join(" ")}
                  >
                    {opt.text.trim() || "·"}
                  </button>
                );
              })}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[#8A8A86]">Custom (spaces count)</span>
              <input
                type="text"
                value={autoSeparatorText}
                onChange={(e) => setAutoSeparatorText(e.target.value)}
                aria-label="Custom separator text"
                className="w-full rounded-[6px] border border-white/[0.08] bg-[#1C1C1F] px-2.5 py-1.5 font-mono text-[12px] text-[#E8E8E6] focus:border-[#8FB8DA] focus:outline-none"
              />
            </label>
            {usage.count > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <span className="text-[11px] text-[#8A8A86]">
                  Already have {usage.count} separator
                  {usage.count === 1 ? "" : "s"} in this design.
                </span>
                <FlashConfirmButton
                  onConfirm={() => replaceAllSeparators(autoSeparatorText)}
                  className="rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-1.5 text-xs uppercase tracking-wider text-[#E8E8E6] transition-colors hover:border-[#8FB8DA]"
                >
                  Change them all to{" "}
                  <span className="font-mono text-[#8FB8DA]">
                    {autoSeparatorText.trim() || "·"}
                  </span>
                </FlashConfirmButton>
              </div>
            )}
          </div>
        )}

        {/* Spacer width + char */}
        {autoInsert === "spacer" && (
          <div className="flex flex-wrap items-end gap-4 rounded-[10px] border border-white/[0.06] bg-[#131315] p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[#8A8A86]">Width</span>
              <input
                type="number"
                min={1}
                max={8}
                value={autoSpacerWidth}
                onChange={(e) => setAutoSpacerWidth(Number(e.target.value))}
                aria-label="Spacer width"
                className="w-20 rounded-[6px] border border-white/[0.08] bg-[#1C1C1F] px-2.5 py-1.5 text-[12px] text-[#E8E8E6] focus:border-[#8FB8DA] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[#8A8A86]">Fill character</span>
              <input
                type="text"
                value={autoSpacerChar}
                onChange={(e) => setAutoSpacerChar(e.target.value)}
                maxLength={1}
                aria-label="Spacer fill character"
                placeholder="space"
                className="w-20 rounded-[6px] border border-white/[0.08] bg-[#1C1C1F] px-2.5 py-1.5 text-center font-mono text-[12px] text-[#E8E8E6] focus:border-[#8FB8DA] focus:outline-none"
              />
            </label>
            <p className="flex-1 min-w-[140px] text-[11px] leading-relaxed text-[#8A8A86]">
              Inserts a fixed gap of {spacerLabel(autoSpacerWidth, autoSpacerChar)} between
              adjacent items.
            </p>
          </div>
        )}

        {/* Looping demo — mock elements rendered in the faux terminal chrome */}
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-[#8A8A86]">
            How it works
          </span>
          <TerminalFrame>
            <div className="relative flex min-h-[24px] items-center leading-tight">
              <AnsiToHtml ansi={modelAnsi} />
              {revealLabel !== null && (
                <span
                  className="sl-demo-sep mx-0.5 inline-flex items-center rounded-[5px] border border-[#8FB8DA]/40 bg-[#8FB8DA]/[0.10] px-1.5 py-0.5 text-[12px] text-[#8FB8DA]"
                  aria-hidden="true"
                >
                  {revealLabel}
                </span>
              )}
              <span className="relative inline-flex">
                <span
                  className="sl-demo-arrow absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-[#8FB8DA]"
                  aria-hidden="true"
                >
                  ▼
                </span>
                <span className="sl-demo-chip inline-flex">
                  <AnsiToHtml ansi={cwdAnsi} />
                </span>
              </span>
            </div>
          </TerminalFrame>
          <p className="text-[11px] text-[#8A8A86]">{demoCaption}</p>
        </div>

        {/* Template re-space: strip the template's spacing, apply the choice */}
        {templateId && (
          <div className="flex flex-col gap-3 rounded-[10px] border border-white/[0.06] bg-[#131315] p-4">
            <span className="text-xs uppercase tracking-wider text-[#8A8A86]">
              {templateName ? `${templateName} template` : "This template"}
            </span>
            <p className="text-sm leading-relaxed text-[#A8A8A4]">
              Spaces items with{" "}
              <span className="font-mono text-[#E8E8E6]">
                {spacingStyle.label}
              </span>
              .{" "}
              {spacingStyle.kind === "none"
                ? "Nothing to clear — your choice above applies as you add elements."
                : autoInsert === "none"
                  ? "Clear all of it for a blank slate?"
                  : `Strip it and re-space everything with your ${MODE_NOUN[autoInsert]} choice?`}
            </p>
            {spacingStyle.kind !== "none" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <FlashConfirmButton
                    onConfirm={respaceFromConfig}
                    className="rounded-[6px] border border-white/[0.06] bg-[#E8E8E6] px-3 py-1.5 text-xs uppercase tracking-wider text-[#0E0E10] transition-colors hover:border-[#8FB8DA]"
                  >
                    {autoInsert === "none"
                      ? "Remove all spacing"
                      : `Re-space with ${MODE_NOUN[autoInsert]}`}
                  </FlashConfirmButton>
                  {usage.count > 0 && autoInsert === "separator" && (
                    <FlashConfirmButton
                      onConfirm={() => replaceAllSeparators(autoSeparatorText)}
                      className="rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-1.5 text-xs uppercase tracking-wider text-[#E8E8E6] transition-colors hover:border-[#8FB8DA]"
                    >
                      Just swap separator text
                    </FlashConfirmButton>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-[#8A8A86]">
                  Removes the template&apos;s separators, fixed spacers and
                  padding spaces, then applies your choice between items.
                  Flex spacers and line breaks are kept.
                </p>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleStart}
            className="rounded-[6px] border border-white/[0.06] bg-[#E8E8E6] px-4 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98]"
          >
            Start building
          </button>
        </div>
      </div>
    </Modal>
  );
}
