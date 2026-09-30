import type {
  ContextColorMode,
  ContextThresholds,
  Element,
} from "@statusline/shared/types";
import { DEFAULT_CONTEXT_THRESHOLDS } from "@statusline/shared/types";
import { type FieldsProps, inputClass, labelClass, tabListClass, tabClass, nestedClass } from "./common";

type PctElement = Extract<Element, { type: "contextPct" }>;

const COLOR_MODES: { value: ContextColorMode; label: string }[] = [
  { value: "static", label: "Static" },
  { value: "percentage", label: "Percent" },
  { value: "absolute", label: "Absolute" },
];

export default function ContextPctFields({
  element,
  onPatch,
}: FieldsProps<PctElement>) {
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
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Color mode</label>
      <div className={tabListClass}>
        {COLOR_MODES.map((m) => {
          const active = colorMode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setColorMode(m.value)}
              className={tabClass(active)}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {colorMode === "absolute" && (
        <div className={nestedClass}>
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
  );
}
