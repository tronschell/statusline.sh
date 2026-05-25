import type { Element } from "@statusline/shared/types";
import {
  type FieldsProps,
  captionClass,
  inputClass,
  labelClass,
} from "./common";

type SpacerElement = Extract<Element, { type: "spacer" }>;

const modeBtn =
  "flex-1 px-3 py-2 text-xs uppercase tracking-wider transition-colors";
const modeBtnActive =
  "bg-[#1C1C1F] text-[#E8E8E6] border border-[#8FB8DA]";
const modeBtnIdle =
  "bg-transparent text-[#8A8A86] border border-white/[0.06] hover:text-[#E8E8E6]";

export default function SpacerFields({
  element,
  onPatch,
}: FieldsProps<SpacerElement>) {
  const setMode = (mode: "fixed" | "flex") => {
    if (element.mode === mode) return;
    const patch: Partial<Element> = { mode } as Partial<Element>;
    // When switching to fixed, ensure a sensible default width.
    if (mode === "fixed" && (element.width === undefined || element.width <= 0)) {
      (patch as { width?: number }).width = 4;
    }
    onPatch(patch);
  };

  const setWidth = (v: string) => {
    if (v === "") return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return;
    const clamped = Math.max(0, Math.min(200, Math.round(n)));
    onPatch({ width: clamped } as Partial<Element>);
  };

  const setChar = (v: string) => {
    const ch = v.length === 0 ? " " : v.slice(0, 1);
    onPatch({ char: ch } as Partial<Element>);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Mode</label>
        <div className="flex gap-0 rounded-[6px] overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("fixed")}
            className={[
              modeBtn,
              "rounded-l-[6px]",
              element.mode === "fixed" ? modeBtnActive : modeBtnIdle,
            ].join(" ")}
            aria-pressed={element.mode === "fixed"}
          >
            Fixed
          </button>
          <button
            type="button"
            onClick={() => setMode("flex")}
            className={[
              modeBtn,
              "rounded-r-[6px]",
              element.mode === "flex" ? modeBtnActive : modeBtnIdle,
            ].join(" ")}
            aria-pressed={element.mode === "flex"}
          >
            Flex
          </button>
        </div>
        <p className={captionClass}>
          {element.mode === "fixed"
            ? "Emits N copies of the character below."
            : "Pushes everything after this spacer toward the right edge of the terminal. Two flex spacers split the slack evenly — handy for centering."}
        </p>
      </div>

      {element.mode === "fixed" && (
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="spacer-width">
            Width (chars)
          </label>
          <input
            id="spacer-width"
            type="number"
            min={0}
            max={200}
            value={element.width ?? 1}
            onChange={(e) => setWidth(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="spacer-char">
          Character
        </label>
        <input
          id="spacer-char"
          type="text"
          maxLength={1}
          value={element.char ?? " "}
          onChange={(e) => setChar(e.target.value)}
          className={inputClass}
          placeholder="(space)"
        />
        <p className={captionClass}>
          Single character. Defaults to a space.
        </p>
      </div>

      {element.mode === "flex" && (
        <p className={captionClass}>
          Flex spacers read{" "}
          <code className="font-mono text-[11px]">$STATUSLINE_COLS</code> (bash)
          or <code className="font-mono text-[11px]">[Console]::WindowWidth</code>{" "}
          (PowerShell) at runtime. Browser preview assumes 120 columns unless{" "}
          <code className="font-mono text-[11px]">_terminalWidth</code> is set in
          the mock stdin.
        </p>
      )}
    </div>
  );
}
