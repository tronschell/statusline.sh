import type { Element } from "../../../../shared/types";
import { type FieldsProps, labelClass } from "./common";

type SessionDurationElement = Extract<Element, { type: "sessionDuration" }>;

const FORMATS: { value: SessionDurationElement["format"]; label: string; hint: string }[] = [
  { value: "hms", label: "H:M:S", hint: "01:23:45" },
  { value: "human", label: "Human", hint: "1h 23m" },
];

export default function SessionDurationFields({
  element,
  onPatch,
}: FieldsProps<SessionDurationElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Format</label>
      <div className="flex flex-col gap-1">
        {FORMATS.map((f) => {
          const active = element.format === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() =>
                onPatch({ format: f.value } as Partial<Element>)
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
                <span className="text-sm text-[#E8E8E6]">{f.label}</span>
                <span className="text-xs text-[#8A8A86]">{f.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
