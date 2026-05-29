import type { Element } from "@statusline/shared/types";
import { inputClass, labelClass } from "./common";

interface BarPreset {
  filled: string;
  empty: string;
  label: string;
}

/**
 * Curated filled/empty pairs for progress-bar elements. Each is a single-cell
 * glyph so the width math in `renderBar` stays exact. Ordered roughly from the
 * densest block styles down to ASCII fallbacks for terminals/fonts that don't
 * render the Unicode block range. The first entry matches the store default.
 */
const BAR_PRESETS: BarPreset[] = [
  { filled: "█", empty: "░", label: "Blocks" },
  { filled: "█", empty: "▒", label: "Shade" },
  { filled: "▓", empty: "░", label: "Soft" },
  { filled: "■", empty: "□", label: "Squares" },
  { filled: "●", empty: "○", label: "Dots" },
  { filled: "▰", empty: "▱", label: "Dotted" },
  { filled: "▮", empty: "▯", label: "Pills" },
  { filled: "━", empty: "─", label: "Lines" },
  { filled: "⣿", empty: "⣀", label: "Braille" },
  { filled: "=", empty: "-", label: "ASCII" },
  { filled: "#", empty: ".", label: "Hash" },
  { filled: "▪", empty: "·", label: "Mid dot" },
];

export interface BarCharFieldsProps {
  filledChar: string;
  emptyChar: string;
  onPatch: (patch: Partial<Element>) => void;
}

/**
 * Filled/empty character controls for progress-bar elements: a one-click row of
 * overwriteable preset styles plus the two free-text inputs for full control.
 * Shared by ContextBar and RateLimit (bar variant) so the two stay in lockstep.
 */
export default function BarCharFields({
  filledChar,
  emptyChar,
  onPatch,
}: BarCharFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Bar style</span>
        <div className="grid grid-cols-2 gap-1">
          {BAR_PRESETS.map((p) => {
            const active = filledChar === p.filled && emptyChar === p.empty;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  onPatch({
                    filledChar: p.filled,
                    emptyChar: p.empty,
                  } as Partial<Element>)
                }
                className={`flex items-center justify-between gap-2 rounded-[4px] border px-2 py-1.5 text-left transition-colors ${
                  active
                    ? "border-[#8FB8DA] bg-[#1E2A36]"
                    : "border-white/[0.06] bg-[#1C1C1F] hover:border-white/[0.12]"
                }`}
                title={`${p.filled} / ${p.empty}`}
                aria-pressed={active}
              >
                <span className="font-mono text-sm leading-none text-[#E8E8E6]">
                  {p.filled.repeat(4)}
                  {p.empty.repeat(2)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#8A8A86]">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass}>Filled char</label>
          <input
            type="text"
            maxLength={4}
            value={filledChar}
            onChange={(e) =>
              onPatch({ filledChar: e.target.value } as Partial<Element>)
            }
            className={inputClass}
            placeholder="█"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass}>Empty char</label>
          <input
            type="text"
            maxLength={4}
            value={emptyChar}
            onChange={(e) =>
              onPatch({ emptyChar: e.target.value } as Partial<Element>)
            }
            className={inputClass}
            placeholder="░"
          />
        </div>
      </div>
    </div>
  );
}
