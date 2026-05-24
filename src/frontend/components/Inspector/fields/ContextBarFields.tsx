import type { Element } from "@statusline/shared/types";
import { type FieldsProps, inputClass, labelClass } from "./common";

type BarElement = Extract<
  Element,
  { type: "contextBar" | "rateLimit5hBar" | "rateLimit7dBar" }
>;

export default function ContextBarFields({
  element,
  onPatch,
}: FieldsProps<BarElement>) {
  const setWidth = (n: number) => {
    const clamped = Math.max(1, Math.min(40, Math.round(n)));
    onPatch({ width: clamped } as Partial<Element>);
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

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <label className={labelClass}>Filled char</label>
          <input
            type="text"
            maxLength={4}
            value={element.filledChar}
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
            value={element.emptyChar}
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
