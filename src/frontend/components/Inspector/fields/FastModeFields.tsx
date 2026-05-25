import type { Element } from "@statusline/shared/types";
import {
  type FieldsProps,
  captionClass,
  inputClass,
  labelClass,
} from "./common";

type FastModeElement = Extract<Element, { type: "fastMode" }>;

export default function FastModeFields({
  element,
  onPatch,
}: FieldsProps<FastModeElement>) {
  return (
    <div className="flex flex-col gap-3">
      <p className={captionClass}>
        Renders a badge only when{" "}
        <code className="font-mono text-[11px]">fast_mode</code> is{" "}
        <code className="font-mono text-[11px]">true</code> in the stdin
        payload.
      </p>

      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="fast-mode-text">
          Badge text
        </label>
        <input
          id="fast-mode-text"
          type="text"
          value={element.text ?? ""}
          onChange={(e) =>
            onPatch({ text: e.target.value } as Partial<Element>)
          }
          className={inputClass}
          placeholder="⚡fast"
        />
        <p className={captionClass}>
          Leave blank to use the default{" "}
          <code className="font-mono text-[11px]">⚡fast</code> badge.
        </p>
      </div>
    </div>
  );
}
