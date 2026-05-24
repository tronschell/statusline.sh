import type { Element } from "@statusline/shared/types";
import { type FieldsProps, labelClass } from "./common";

type CwdElement = Extract<Element, { type: "cwd" }>;

const MODES: { value: CwdElement["mode"]; label: string; hint: string }[] = [
  { value: "basename", label: "Basename", hint: "Last path segment only" },
  { value: "full", label: "Full", hint: "Entire absolute path" },
  { value: "tilde", label: "Tilde", hint: "~ for home directory" },
];

export default function CwdFields({
  element,
  onPatch,
}: FieldsProps<CwdElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Display mode</label>
      <div className="flex flex-col gap-1">
        {MODES.map((m) => {
          const active = element.mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() =>
                onPatch({ mode: m.value } as Partial<Element>)
              }
              className={`flex items-center gap-3 rounded-[4px] border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-[#8FB8DA] bg-[#1E2A36]"
                  : "border-white/[0.06] bg-[#1C1C1F] hover:border-white/[0.12]"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full border ${
                  active
                    ? "border-[#8FB8DA] bg-[#8FB8DA]"
                    : "border-white/[0.18]"
                }`}
              />
              <span className="flex flex-col">
                <span className="text-sm text-[#E8E8E6]">{m.label}</span>
                <span className="text-xs text-[#8A8A86]">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
