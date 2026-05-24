import type { Element } from "@statusline/shared/types";
import { type FieldsProps, inputClass, labelClass } from "./common";
import { EmojiQuickPick } from "./EmojiQuickPick";

type StaticElement = Extract<Element, { type: "static" }>;

export default function StaticTextFields({
  element,
  onPatch,
}: FieldsProps<StaticElement>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Text</label>
        <input
          type="text"
          value={element.text}
          onChange={(e) => onPatch({ text: e.target.value } as Partial<Element>)}
          className={inputClass}
          placeholder="Static text"
        />
      </div>
      <EmojiQuickPick
        label="Append emoji"
        onPick={(c) =>
          onPatch({ text: (element.text ?? "") + c } as Partial<Element>)
        }
      />
    </div>
  );
}
