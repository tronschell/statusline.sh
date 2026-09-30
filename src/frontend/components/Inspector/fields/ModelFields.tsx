import type { Element } from "@statusline/shared/types";
import { type FieldsProps, captionClass } from "./common";

type ModelElement = Extract<Element, { type: "model" }>;

export default function ModelFields(_props: FieldsProps<ModelElement>) {
  return (
    <p className={captionClass}>
      Reads <code className="font-mono text-[11px]">model.display_name</code>{" "}
      from the Claude Code payload. For a fixed rotating model showcase, add
      a Rotator and choose the <code className="font-mono text-[11px]">Models</code>{" "}
      preset.
    </p>
  );
}
