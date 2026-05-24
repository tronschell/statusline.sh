import type { AnsiStyle, Element } from "@statusline/shared/types";
import StyleEditor from "../StyleEditor";
import { type FieldsProps, inputClass, labelClass } from "./common";

type GitStatusElement = Extract<Element, { type: "gitStatus" }>;

export default function GitStatusFields({
  element,
  onPatch,
}: FieldsProps<GitStatusElement>) {
  const setDirtyStyle = (s: AnsiStyle) =>
    onPatch({ dirtyStyle: s } as Partial<Element>);
  const setCleanStyle = (s: AnsiStyle) =>
    onPatch({ cleanStyle: s } as Partial<Element>);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Dirty text</label>
        <input
          type="text"
          value={element.dirtyText ?? ""}
          onChange={(e) =>
            onPatch({ dirtyText: e.target.value } as Partial<Element>)
          }
          className={inputClass}
          placeholder="✗"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Clean text</label>
        <input
          type="text"
          value={element.cleanText ?? ""}
          onChange={(e) =>
            onPatch({ cleanText: e.target.value } as Partial<Element>)
          }
          className={inputClass}
          placeholder="✓"
        />
      </div>

      <StyleEditor
        title="Dirty style"
        style={element.dirtyStyle ?? {}}
        onChange={setDirtyStyle}
      />
      <StyleEditor
        title="Clean style"
        style={element.cleanStyle ?? {}}
        onChange={setCleanStyle}
      />
    </div>
  );
}
