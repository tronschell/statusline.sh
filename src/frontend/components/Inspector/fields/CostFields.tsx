import type { Element } from "../../../../shared/types";
import { type FieldsProps, inputClass, labelClass } from "./common";

type CostElement = Extract<Element, { type: "cost" }>;

export default function CostFields({
  element,
  onPatch,
}: FieldsProps<CostElement>) {
  const setPrecision = (n: number) => {
    const clamped = Math.max(0, Math.min(6, Math.round(n)));
    onPatch({ precision: clamped } as Partial<Element>);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Precision</label>
      <input
        type="number"
        min={0}
        max={6}
        value={element.precision}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) setPrecision(n);
        }}
        className={inputClass}
      />
    </div>
  );
}
