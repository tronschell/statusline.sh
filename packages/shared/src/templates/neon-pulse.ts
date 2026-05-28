import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 12. Neon Pulse — cyberpunk palette, compact single line. gitStatus uses
// custom dirty/clean glyphs. A fixed spacer (not flex) keeps every segment
// visible inside the narrow preview cards instead of padding to a full
// terminal width and pushing the right half off the clipped edge.
export const template: TemplateMeta = {
  id: "neon-pulse",
  name: "Neon Pulse",
  description: "Cyberpunk neon palette on a compact single line.",
  design: {
    version: 1,
    name: "Neon Pulse",
    elements: [
      el({
        id: "np_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0xff, g: 0x2d, b: 0x95 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "np_gap1",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "np_cwd",
        type: "cwd",
        mode: "basename",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0x05, g: 0xf2, b: 0xff },
        }),
        suffix: " ",
      }),
      el({
        id: "np_branch",
        type: "gitBranch",
        style: s({
          italic: true,
          fg: { kind: "rgb", r: 0xb4, g: 0xff, b: 0x39 },
        }),
        prefix: " ",
      }),
      el({
        id: "np_status",
        type: "gitStatus",
        dirtyText: "⚡",
        cleanText: "✓",
        dirtyStyle: s({ bold: true, fg: { kind: "rgb", r: 0xff, g: 0xea, b: 0x00 } }),
        cleanStyle: s({ fg: { kind: "rgb", r: 0xb4, g: 0xff, b: 0x39 } }),
        style: s({}),
        prefix: " ",
      }),
      el({
        id: "np_spacer",
        type: "spacer",
        mode: "fixed",
        width: 3,
        char: " ",
        style: s({}),
      }),
      el({
        id: "np_5h",
        type: "rateLimit5h",
        variant: "pct",
        width: 10,
        filledChar: "█",
        emptyChar: "░",
        style: s({ bold: true, fg: { kind: "rgb", r: 0xff, g: 0x2d, b: 0x95 } }),
        prefix: "5h ",
        suffix: "% ",
      }),
      el({
        id: "np_ctx_bar",
        type: "contextBar",
        width: 12,
        filledChar: "█",
        emptyChar: "░",
        colorMode: "percentage",
        style: s({ fg: { kind: "rgb", r: 0x05, g: 0xf2, b: 0xff } }),
        prefix: "[",
        suffix: "]",
      }),
    ],
  },
};
