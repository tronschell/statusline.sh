import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 13. Ocean Wave — multi-line gradient palette (deep blue → teal → seafoam).
// Demonstrates contextTokens with ratioPct + flex spacer right-alignment.
export const template: TemplateMeta = {
  id: "ocean-wave",
  name: "Ocean Wave",
  description:
    "Two-line ocean gradient with token ratio and flex-aligned cost.",
  design: {
    version: 1,
    name: "Ocean Wave",
    elements: [
      el({
        id: "ow_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0xf0, g: 0xfd, b: 0xfa },
          bg: { kind: "rgb", r: 0x0c, g: 0x4a, b: 0x6e },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "ow_cwd",
        type: "cwd",
        mode: "basename",
        style: s({
          fg: { kind: "rgb", r: 0xf0, g: 0xfd, b: 0xfa },
          bg: { kind: "rgb", r: 0x0e, g: 0x74, b: 0x90 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "ow_branch",
        type: "gitBranch",
        style: s({
          italic: true,
          fg: { kind: "rgb", r: 0x04, g: 0x2f, b: 0x2e },
          bg: { kind: "rgb", r: 0x5e, g: 0xea, b: 0xd4 },
        }),
        prefix: "  ",
        suffix: " ",
      }),
      el({
        id: "ow_spacer1",
        type: "spacer",
        mode: "flex",
        char: " ",
        style: s({}),
      }),
      el({
        id: "ow_dur",
        type: "sessionDuration",
        format: "human",
        style: s({ italic: true, fg: { kind: "rgb", r: 0x99, g: 0xf6, b: 0xe4 } }),
        prefix: "⌛ ",
      }),
      el({ id: "ow_lb", type: "lineBreak", style: s({}) }),
      el({
        id: "ow_tokens",
        type: "contextTokens",
        variant: "ratioPct",
        compact: true,
        colorMode: "percentage",
        style: s({ bold: true }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "ow_bar",
        type: "contextBar",
        width: 20,
        filledChar: "≋",
        emptyChar: "·",
        colorMode: "percentage",
        style: s({ fg: { kind: "rgb", r: 0x2d, g: 0xd4, b: 0xbf } }),
        prefix: "[",
        suffix: "] ",
      }),
      el({
        id: "ow_spacer2",
        type: "spacer",
        mode: "flex",
        char: " ",
        style: s({}),
      }),
      el({
        id: "ow_cost",
        type: "cost",
        precision: 2,
        style: s({ fg: { kind: "rgb", r: 0xa5, g: 0xf3, b: 0xfc } }),
        prefix: "$",
      }),
    ],
  },
};
