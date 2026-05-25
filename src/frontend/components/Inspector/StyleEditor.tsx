import { useMemo, useState } from "react";
import type { AnsiColor, AnsiStyle } from "@statusline/shared/types";
import { ANSI16_HEX, ansi256ToRgb } from "@statusline/shared/ansi";
import ColorPicker from "./ColorPicker";

export interface StyleEditorProps {
  style: AnsiStyle;
  onChange: (s: AnsiStyle) => void;
  title?: string;
}

type ToggleKey = "bold" | "italic" | "dim" | "underline";
const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "bold", label: "Bold" },
  { key: "italic", label: "Italic" },
  { key: "dim", label: "Dim" },
  { key: "underline", label: "Underline" },
];

type Channel = "fg" | "bg";

const CHECKER_BG =
  "repeating-linear-gradient(45deg,#1C1C1F,#1C1C1F 3px,#2A2A2D 3px,#2A2A2D 6px)";

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Resolves an AnsiColor into a CSS background string for the swatch
 * preview plus a short human label ("Default", "16·9", "256·240",
 * "#F26B1D"). Returning a null `css` signals "use the checker pattern".
 */
function colorPreview(c: AnsiColor | undefined): {
  css: string | null;
  label: string;
} {
  if (!c) return { css: null, label: "Default" };
  switch (c.kind) {
    case "default":
      return { css: null, label: "Default" };
    case "ansi16":
      return { css: ANSI16_HEX[c.index] ?? "#000", label: `16·${c.index}` };
    case "ansi256": {
      const [r, g, b] = ansi256ToRgb(c.index);
      return { css: `rgb(${r},${g},${b})`, label: `256·${c.index}` };
    }
    case "rgb":
      return {
        css: `rgb(${c.r},${c.g},${c.b})`,
        label: `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`,
      };
  }
}

interface SwatchChipProps {
  channel: Channel;
  label: string;
  color: AnsiColor | undefined;
  active: boolean;
  onClick: () => void;
}

function SwatchChip({ channel, label, color, active, onClick }: SwatchChipProps) {
  const { css, summary } = useMemo(() => {
    const p = colorPreview(color);
    return { css: p.css, summary: p.label };
  }, [color]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      aria-controls={`style-editor-picker-${channel}`}
      className={`flex flex-1 items-center gap-2.5 rounded-[8px] border bg-[var(--color-surface-2)] px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40 ${
        active
          ? "border-[#8FB8DA]/40"
          : "border-white/[0.06] hover:border-white/[0.14]"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-[22px] w-[22px] shrink-0 rounded-[4px] border border-white/[0.12]"
        style={{ background: css ?? CHECKER_BG }}
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-[var(--color-text)]">
          {summary}
        </span>
      </span>
    </button>
  );
}

/**
 * Renders the Appearance section: a flat heading, a two-up swatch row
 * for foreground/background, an inline picker drawer that opens for
 * whichever channel is active, and a row of decoration toggle pills.
 *
 * The picker drawer uses controlled local state so clicking the active
 * swatch toggles it closed — this keeps the inspector's vertical real
 * estate manageable without nesting collapsibles.
 */
export default function StyleEditor({
  style,
  onChange,
  title = "Appearance",
}: StyleEditorProps) {
  const [active, setActive] = useState<Channel | null>(null);

  const patch = (p: Partial<AnsiStyle>) => onChange({ ...style, ...p });
  const setFg = (v: AnsiColor) => patch({ fg: v });
  const setBg = (v: AnsiColor) => patch({ bg: v });

  const toggleChannel = (c: Channel) =>
    setActive((cur) => (cur === c ? null : c));

  const activeLabel = active === "fg" ? "Foreground" : "Background";

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </h3>

      <div className="flex items-stretch gap-2">
        <SwatchChip
          channel="fg"
          label="Foreground"
          color={style.fg}
          active={active === "fg"}
          onClick={() => toggleChannel("fg")}
        />
        <SwatchChip
          channel="bg"
          label="Background"
          color={style.bg}
          active={active === "bg"}
          onClick={() => toggleChannel("bg")}
        />
      </div>

      {active !== null && (
        <div
          id={`style-editor-picker-${active}`}
          className="flex flex-col gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Editing: {activeLabel}
            </span>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:text-[var(--color-text)]"
            >
              Done
            </button>
          </div>
          {active === "fg" ? (
            <ColorPicker value={style.fg} onChange={setFg} label="Foreground" />
          ) : (
            <ColorPicker value={style.bg} onChange={setBg} label="Background" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Decorations
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TOGGLES.map(({ key, label }) => {
            const isActive = Boolean(style[key]);
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => patch({ [key]: !isActive })}
                className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40 ${
                  isActive
                    ? "bg-[var(--color-text)] text-[var(--color-canvas)]"
                    : "border border-white/[0.06] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
                style={
                  key === "bold"
                    ? { fontWeight: 700 }
                    : key === "italic"
                      ? { fontStyle: "italic" }
                      : key === "underline"
                        ? { textDecoration: "underline" }
                        : key === "dim"
                          ? { opacity: isActive ? 1 : 0.7 }
                          : undefined
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
