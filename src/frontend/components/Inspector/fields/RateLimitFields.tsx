import type { Element, RateLimitVariant } from "@statusline/shared/types";
import BarCharFields from "./BarCharFields";
import { type FieldsProps, captionClass, inputClass, labelClass } from "./common";

type RateLimitElement = Extract<
  Element,
  { type: "rateLimit5h" | "rateLimit7d" }
>;

interface VariantOption {
  value: RateLimitVariant;
  label: string;
  hint: string;
  example: string;
}

const VARIANTS: VariantOption[] = [
  {
    value: "pct",
    label: "Percentage",
    hint: "Numeric usage readout",
    example: "61%",
  },
  {
    value: "bar",
    label: "Progress bar",
    hint: "Visual meter of usage",
    example: "██████░░░░",
  },
];

export default function RateLimitFields({
  element,
  onPatch,
}: FieldsProps<RateLimitElement>) {
  const setVariant = (variant: RateLimitVariant) =>
    onPatch({ variant } as Partial<Element>);
  const setWidth = (n: number) => {
    const clamped = Math.max(1, Math.min(40, Math.round(n)));
    onPatch({ width: clamped } as Partial<Element>);
  };
  const toggleReset = () =>
    onPatch({ showResetTime: !(element.showResetTime ?? false) } as Partial<Element>);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Variation</label>
        <div className="flex flex-col gap-1">
          {VARIANTS.map((v) => {
            const active = element.variant === v.value;
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => setVariant(v.value)}
                className={`flex items-start gap-3 rounded-[4px] border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[#8FB8DA] bg-[#1E2A36]"
                    : "border-white/[0.06] bg-[#1C1C1F] hover:border-white/[0.12]"
                }`}
              >
                <span
                  className={`mt-1 inline-block h-3 w-3 rounded-full border ${
                    active
                      ? "border-[#8FB8DA] bg-[#8FB8DA]"
                      : "border-white/[0.18]"
                  }`}
                />
                <span className="flex flex-1 flex-col">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[#E8E8E6]">{v.label}</span>
                    <code className="font-mono text-[11px] text-[#8FB8DA]">
                      {v.example}
                    </code>
                  </span>
                  <span className="text-xs text-[#8A8A86]">{v.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {element.variant === "bar" ? (
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
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={element.showResetTime ?? false}
              onChange={toggleReset}
              className="h-4 w-4 cursor-pointer accent-[#8FB8DA]"
            />
            <span className="text-sm text-[#E8E8E6]">Show reset time</span>
          </label>
          <p className={captionClass}>
            Append <code className="font-mono">T-1h02m</code> (countdown to{" "}
            <code className="font-mono">resets_at</code>).
          </p>
        </div>
      )}
    </div>
  );
}
