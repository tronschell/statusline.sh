import type { Element } from "../../../../shared/types";
import { type FieldsProps, captionClass, inputClass, labelClass } from "./common";
import { EmojiQuickPick } from "./EmojiQuickPick";

type GlyphElement = Extract<Element, { type: "glyph" }>;

export default function GlyphFields({
  element,
  onPatch,
}: FieldsProps<GlyphElement>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Character</label>
        <input
          type="text"
          value={element.char}
          onChange={(e) => onPatch({ char: e.target.value } as Partial<Element>)}
          className={inputClass}
          placeholder="◆"
        />
      </div>
      <EmojiQuickPick
        onPick={(c) => onPatch({ char: c } as Partial<Element>)}
      />
      <p className={captionClass}>
        Use any Unicode glyph. Emoji works in most terminals; Nerd Font glyphs
        require a Nerd Font.
      </p>
    </div>
  );
}
