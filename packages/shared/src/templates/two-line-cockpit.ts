import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 10. Two-Line Cockpit — multi-line layout via lineBreak.
// Line 1: model + cwd + branch + gitStatus (custom marker).
// Line 2: context bar + cost + duration with chip backgrounds.
export const template: TemplateMeta = {
  id: "two-line-cockpit",
  name: "Two-Line Cockpit",
  description:
    "Two-row layout: model/dir/branch up top, context/cost/duration below.",
  design: {
    version: 1,
    name: "Two-Line Cockpit",
    elements: [
      el({
        id: "tlc_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0xf5, g: 0xf3, b: 0xff },
          bg: { kind: "rgb", r: 0x4c, g: 0x1d, b: 0x95 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "tlc_gap1",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "tlc_cwd",
        type: "cwd",
        mode: "tilde",
        style: s({
          fg: { kind: "rgb", r: 0xe0, g: 0xf2, b: 0xfe },
          bg: { kind: "rgb", r: 0x07, g: 0x59, b: 0x85 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "tlc_gap2",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "tlc_branch",
        type: "gitBranch",
        style: s({
          italic: true,
          fg: { kind: "rgb", r: 0xec, g: 0xfc, b: 0xcb },
          bg: { kind: "rgb", r: 0x36, g: 0x53, b: 0x14 },
        }),
        prefix: "  ",
        suffix: " ",
      }),
      el({
        id: "tlc_status",
        type: "gitStatus",
        dirtyText: " ●",
        cleanText: " ✓",
        dirtyStyle: s({ bold: true, fg: { kind: "rgb", r: 0xfb, g: 0xbf, b: 0x24 } }),
        cleanStyle: s({ fg: { kind: "rgb", r: 0x86, g: 0xef, b: 0xac } }),
        style: s({}),
      }),
      el({ id: "tlc_lb", type: "lineBreak", style: s({}) }),
      el({
        id: "tlc_bar",
        type: "contextBar",
        width: 16,
        filledChar: "▰",
        emptyChar: "▱",
        colorMode: "percentage",
        style: s({ fg: { kind: "rgb", r: 0x67, g: 0xe8, b: 0xf9 } }),
        prefix: " ctx ",
        suffix: " ",
      }),
      el({
        id: "tlc_pct",
        type: "contextPct",
        colorMode: "percentage",
        style: s({ bold: true }),
        suffix: "% ",
      }),
      el({
        id: "tlc_sep",
        type: "separator",
        text: "· ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "tlc_cost",
        type: "cost",
        precision: 2,
        style: s({ fg: { kind: "rgb", r: 0xfd, g: 0xe6, b: 0x8a } }),
        prefix: "$",
        suffix: " ",
      }),
      el({
        id: "tlc_sep2",
        type: "separator",
        text: "· ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "tlc_dur",
        type: "sessionDuration",
        format: "human",
        style: s({ italic: true, fg: { kind: "rgb", r: 0xc4, g: 0xb5, b: 0xfd } }),
      }),
    ],
  },
};
