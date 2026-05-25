import type {
  ContextColorMode,
  ContextThresholds,
  Element,
  TokenDisplayVariant,
} from "@statusline/shared/types";
import { DEFAULT_CONTEXT_THRESHOLDS } from "@statusline/shared/types";
import { type FieldsProps, captionClass, inputClass, labelClass } from "./common";

type TokensElement = Extract<Element, { type: "contextTokens" }>;

interface VariantOption {
  value: TokenDisplayVariant;
  label: string;
  hint: string;
  example: string;
}

const VARIANTS: VariantOption[] = [
  {
    value: "ratio",
    label: "Used / Total",
    hint: "94k / 200k style",
    example: "94.4k/200k",
  },
  {
    value: "ratioPct",
    label: "Used / Total + %",
    hint: "Appends rounded percentage",
    example: "94.4k/200k (47%)",
  },
  {
    value: "used",
    label: "Used only",
    hint: "Tokens consumed so far",
    example: "94.4k",
  },
  {
    value: "remaining",
    label: "Remaining only",
    hint: "Tokens left until context fills",
    example: "105.6k",
  },
];

const COLOR_MODES: { value: ContextColorMode; label: string }[] = [
  { value: "static", label: "Static" },
  { value: "percentage", label: "Percent" },
  { value: "absolute", label: "Absolute" },
];

export default function ContextTokensFields({
  element,
  onPatch,
}: FieldsProps<TokensElement>) {
  const setVariant = (variant: TokenDisplayVariant) =>
    onPatch({ variant } as Partial<Element>);
  const toggleCompact = () =>
    onPatch({ compact: !element.compact } as Partial<Element>);
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

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={element.compact}
            onChange={toggleCompact}
            className="h-4 w-4 cursor-pointer accent-[#8FB8DA]"
          />
          <span className="text-sm text-[#E8E8E6]">Compact numbers</span>
        </label>
        <p className={captionClass}>
          On: <code className="font-mono">94.4k/200k</code>. Off:{" "}
          <code className="font-mono">94,400/200,000</code>.
        </p>
      </div>

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
