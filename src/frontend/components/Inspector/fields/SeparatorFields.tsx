import type { Element } from "@statusline/shared/types";
import { type FieldsProps, inputClass, labelClass } from "./common";

type SeparatorElement = Extract<Element, { type: "separator" }>;

export default function SeparatorFields({
  element,
  onPatch,
}: FieldsProps<SeparatorElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Separator</label>
      <input
        type="text"
        value={element.text}
        onChange={(e) => onPatch({ text: e.target.value } as Partial<Element>)}
        className={inputClass}
        placeholder=" | "
      />
    </div>
  );
}
