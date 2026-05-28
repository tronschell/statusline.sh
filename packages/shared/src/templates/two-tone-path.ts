import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 6. Two-Tone Path — splits cwd on /, fades parents, bolds basename.
// segmentSplit assigns segments by index; the last segment catches overflow.
// We use 4 entries with the last one (basename) bold so any depth still
// highlights the leaf.
export const template: TemplateMeta = {
  id: "two-tone-path",
  name: "Two-Tone Path",
  description:
    "Splits cwd on /, fades parent directories, bolds the basename.",
  design: {
    version: 1,
    name: "Two-Tone Path",
    elements: [
      el({
        id: "tt_split",
        type: "segmentSplit",
        style: s({}),
        source: { kind: "field", path: "workspace.current_dir" },
        delimiter: "/",
        segments: [
          { style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }) },
          { style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }) },
          { style: s({ fg: { kind: "ansi16", index: 7 } }) },
          { style: s({ bold: true, fg: { kind: "ansi16", index: 15 } }) },
        ],
        joinWith: "/",
      }),
    ],
  },
};
