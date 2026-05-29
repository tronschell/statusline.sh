import type {
  ContextColorMode,
  ContextThresholds,
  Element,
} from "@statusline/shared/types";
import { DEFAULT_CONTEXT_THRESHOLDS } from "@statusline/shared/types";
import BarCharFields from "./BarCharFields";
import { type FieldsProps, inputClass, labelClass } from "./common";

type BarElement = Extract<Element, { type: "contextBar" }>;

const COLOR_MODES: { value: ContextColorMode; label: string }[] = [
  { value: "static", label: "Static" },
  { value: "percentage", label: "Percent" },
  { value: "absolute", label: "Absolute" },
];

export default function ContextBarFields({
  element,
  onPatch,
}: FieldsProps<BarElement>) {
  const setWidth = (n: number) => {
    const clamped = Math.max(1, Math.min(40, Math.round(n)));
    onPatch({ width: clamped } as Partial<Element>);
  };

  const colorMode: ContextColorMode = element.colorMode ?? "static";
  const thresholds: ContextThresholds =
    element.thresholds ?? DEFAULT_CONTEXT_THRESHOLDS;

  const setColorMode = (m: ContextColorMode) =>
    onPatch({ colorMode: m } as Partial<Element>);
  const setThreshold = (key: keyof ContextThresholds, n: number) => {
    const next: ContextThresholds = { ...thresholds, [key]: Math.max(0, Math.round(n)) };
    onPatch({ thresholds: next } as Partial<Element>);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Width</label>
        <input
          type="number"
          min={1}
          max={40}
          value={element.width}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setWidth(n);
          }}
          className={inputClass}
        />
      </div>

      <BarCharFields
        filledChar={element.filledChar}
        emptyChar={element.emptyChar}
        onPatch={onPatch}
      />

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Color mode</label>
        <div className="grid grid-cols-3 gap-1 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] p-1">
          {COLOR_MODES.map((m) => {
            const active = colorMode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setColorMode(m.value)}
                className={`rounded-[4px] px-2 py-1 text-xs transition-colors ${
                  active
                    ? "bg-[#1E2A36] text-[#E8E8E6]"
                    : "text-[#8A8A86] hover:text-[#E8E8E6]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        {colorMode === "absolute" && (
          <div className="flex flex-col gap-2 rounded-[4px] border border-white/[0.06] p-3">
            <span className="text-xs text-[#8A8A86]">
              Token thresholds. Color picks the highest band ≤ tokens.
            </span>
            {(["green", "yellow", "orange"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <label className="w-16 text-xs uppercase tracking-wider text-[#8A8A86]">
                  {k}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={thresholds[k]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setThreshold(k, n);
                  }}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
