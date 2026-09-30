import type { Element } from "@statusline/shared/types";
import { type FieldsProps, labelClass, optionRowClass } from "./common";

type CwdElement = Extract<Element, { type: "cwd" }>;

const MODES: { value: CwdElement["mode"]; label: string; hint: string }[] = [
  { value: "basename", label: "Basename", hint: "Last path segment only" },
  { value: "full", label: "Full", hint: "Entire absolute path" },
  { value: "tilde", label: "Tilde", hint: "~ for home directory" },
  {
    value: "compact",
    label: "Compact",
    hint: "Parent dirs collapse to first char (/h/u/project)",
  },
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
              className={optionRowClass(active, "center")}
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
