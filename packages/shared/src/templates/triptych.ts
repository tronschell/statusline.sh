import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 14. Triptych — three-row layout with two lineBreaks. Warm sunset palette.
// Line 1 (identity): model · cwd · branch · gitStatus
// Line 2 (progress): context bar · tokens · cost
// Line 3 (modes):    effort · output style · fast · rotator · duration
export const template: TemplateMeta = {
  id: "triptych",
  name: "Triptych",
  description:
    "Three-row sunset layout: identity, progress, modes — each on its own line.",
  design: {
    version: 1,
    name: "Triptych",
    elements: [
      el({
        id: "tri_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0xfc, g: 0xe7, b: 0xf3 },
          bg: { kind: "rgb", r: 0x7c, g: 0x2d, b: 0x4d },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "tri_gap1",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "tri_cwd",
        type: "cwd",
        mode: "tilde",
        style: s({ bold: true, fg: { kind: "rgb", r: 0xfd, g: 0xba, b: 0x74 } }),
        suffix: " ",
      }),
      el({
        id: "tri_branch",
        type: "gitBranch",
        style: s({ italic: true, fg: { kind: "rgb", r: 0xfe, g: 0xd7, b: 0xaa } }),
        prefix: " ",
      }),
      el({
        id: "tri_status",
        type: "gitStatus",
        dirtyText: " ◆",
        cleanText: " ◇",
        dirtyStyle: s({ bold: true, fg: { kind: "rgb", r: 0xfb, g: 0xbf, b: 0x24 } }),
        cleanStyle: s({ dim: true, fg: { kind: "rgb", r: 0xfb, g: 0x92, b: 0x3c } }),
        style: s({}),
      }),
      el({ id: "tri_lb1", type: "lineBreak", style: s({}) }),
      el({
        id: "tri_ctx_label",
        type: "static",
        text: " ctx ",
        style: s({ dim: true, fg: { kind: "rgb", r: 0xfb, g: 0x92, b: 0x3c } }),
      }),
      el({
        id: "tri_bar",
        type: "contextBar",
        width: 18,
        filledChar: "▰",
        emptyChar: "▱",
        colorMode: "percentage",
        style: s({ fg: { kind: "rgb", r: 0xfb, g: 0x92, b: 0x3c } }),
        suffix: " ",
      }),
      el({
        id: "tri_tokens",
        type: "contextTokens",
        variant: "ratioPct",
        compact: true,
        colorMode: "percentage",
        style: s({ bold: true }),
        suffix: " ",
      }),
      el({
        id: "tri_sep1",
        type: "separator",
        text: "· ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "tri_cost",
        type: "cost",
        precision: 2,
        style: s({ fg: { kind: "rgb", r: 0xfe, g: 0xf3, b: 0xc7 } }),
        prefix: "$",
      }),
      el({ id: "tri_lb2", type: "lineBreak", style: s({}) }),
      el({
        id: "tri_effort",
        type: "thinkingEffort",
        style: s({ bold: true, fg: { kind: "rgb", r: 0xec, g: 0x4a, b: 0xa1 } }),
        prefix: " ✦ ",
        suffix: " ",
      }),
      el({
        id: "tri_style",
        type: "outputStyle",
        style: s({ italic: true, fg: { kind: "rgb", r: 0xf0, g: 0xab, b: 0xfc } }),
        prefix: "✎ ",
        suffix: " ",
      }),
      el({
        id: "tri_fast",
        type: "fastMode",
        text: "⚡",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0x0b, g: 0x10, b: 0x1a },
          bg: { kind: "rgb", r: 0xfd, g: 0xe0, b: 0x47 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "tri_rotator",
        type: "rotator",
        items: ["building", "thinking", "shipping", "exploring"],
        intervalSeconds: 5,
        pickMode: "cycle",
        style: s({ italic: true, fg: { kind: "rgb", r: 0xfb, g: 0xcf, b: 0xe8 } }),
        prefix: " · ",
        suffix: " ",
      }),
      el({
        id: "tri_dur",
        type: "sessionDuration",
        format: "human",
        style: s({ dim: true, fg: { kind: "rgb", r: 0xfd, g: 0xba, b: 0x74 } }),
        prefix: "· ",
      }),
    ],
  },
};
