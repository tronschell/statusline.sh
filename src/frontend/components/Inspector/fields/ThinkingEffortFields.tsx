import type { Element } from "@statusline/shared/types";
import { type FieldsProps, captionClass } from "./common";

type ThinkingEffortElement = Extract<Element, { type: "thinkingEffort" }>;

export default function ThinkingEffortFields(
  _props: FieldsProps<ThinkingEffortElement>,
) {
  return (
    <div className="flex flex-col gap-2">
      <p className={captionClass}>
        Reads <code className="font-mono text-[11px]">effort.level</code> from
        the Claude Code stdin payload. Hidden when{" "}
        <code className="font-mono text-[11px]">thinking.enabled</code> is
        falsy. Use the Style and Layout sections below to customise rendering.
      </p>
    </div>
  );
}
