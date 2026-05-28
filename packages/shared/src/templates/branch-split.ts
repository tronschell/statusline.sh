import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 5. Branch Split — segmentSplit on git_worktree.
export const template: TemplateMeta = {
  id: "branch-split",
  name: "Branch Split",
  description:
    "Demonstrates segmentSplit on git branches like feature/auth-refactor.",
  design: {
    version: 1,
    name: "Branch Split",
    elements: [
      el({
        id: "bs_glyph",
        type: "glyph",
        char: " ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "bs_split",
        type: "segmentSplit",
        style: s({}),
        source: { kind: "field", path: "workspace.git_worktree" },
        delimiter: "/",
        segments: [
          { style: s({ dim: true, fg: { kind: "ansi16", index: 7 } }) },
          { style: s({ bold: true, fg: { kind: "ansi16", index: 14 } }) },
        ],
      }),
    ],
  },
};
