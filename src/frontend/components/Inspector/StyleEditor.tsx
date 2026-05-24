import { useMemo } from "react";
import type { AnsiColor, AnsiStyle } from "@statusline/shared/types";
import { ANSI16_HEX, ansi256ToRgb } from "@statusline/shared/ansi";
import ColorPicker from "./ColorPicker";
import Collapsible from "./Collapsible";

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

function colorPreview(c: AnsiColor | undefined): { css: string | null; label: string } {
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
      return { css: `rgb(${c.r},${c.g},${c.b})`, label: "RGB" };
  }
}

function ColorSummary({ color }: { color: AnsiColor | undefined }) {
  const { css, label } = useMemo(() => colorPreview(color), [color]);
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 rounded-[3px] border border-white/[0.12]"
        style={{
          background:
            css ??
            "repeating-linear-gradient(45deg,#1C1C1F,#1C1C1F 3px,#2A2A2D 3px,#2A2A2D 6px)",
        }}
      />
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
    </span>
  );
}

/**
 * Renders the Appearance section: foreground + background color pickers
 * (each in its own disclosure) and the four text decoration toggles.
 * Collapsing each picker keeps the inspector vertical real-estate
 * managable when only one channel is being edited.
 */
export default function StyleEditor({
  style,
  onChange,
  title = "Appearance",
}: StyleEditorProps) {
  const patch = (p: Partial<AnsiStyle>) => onChange({ ...style, ...p });
  const setFg = (v: AnsiColor) => patch({ fg: v });
  const setBg = (v: AnsiColor) => patch({ bg: v });

  return (
    <Collapsible title={title} defaultOpen variant="flush">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 pl-3">
        <legend className="px-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Decorations
        </legend>
        <div className="flex flex-wrap gap-2">
          {TOGGLES.map(({ key, label }) => {
            const active = Boolean(style[key]);
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => patch({ [key]: !active })}
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40 ${
                  active
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
                          ? { opacity: active ? 1 : 0.7 }
                          : undefined
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 pl-3">
        <Collapsible
          title="Foreground"
          summary={<ColorSummary color={style.fg} />}
          defaultOpen={false}
          density="compact"
        >
          <ColorPicker value={style.fg} onChange={setFg} label="Foreground" />
        </Collapsible>

        <Collapsible
          title="Background"
          summary={<ColorSummary color={style.bg} />}
          defaultOpen={false}
          density="compact"
        >
          <ColorPicker value={style.bg} onChange={setBg} label="Background" />
        </Collapsible>
      </div>
    </Collapsible>
  );
}
