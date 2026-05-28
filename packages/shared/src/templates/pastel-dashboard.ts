import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 7. Pastel Dashboard — muted pastels as chip backgrounds.
// Pastels per design-system spec:
//   Red bg 3A1F21 / text E89B9E
//   Blue bg 1E2A36 / text 8FB8DA
//   Green bg 1E2A22 / text 9CC09F
//   Yellow bg 2E2820 / text D8B870
export const template: TemplateMeta = {
  id: "pastel-dashboard",
  name: "Pastel Dashboard",
  description: "Muted pastel chips for each section. Aesthetic over data.",
  design: {
    version: 1,
    name: "Pastel Dashboard",
    elements: [
      el({
        id: "pd_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0x8f, g: 0xb8, b: 0xda },
          bg: { kind: "rgb", r: 0x1e, g: 0x2a, b: 0x36 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "pd_gap1",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "pd_cwd",
        type: "cwd",
        mode: "basename",
        style: s({
          fg: { kind: "rgb", r: 0x9c, g: 0xc0, b: 0x9f },
          bg: { kind: "rgb", r: 0x1e, g: 0x2a, b: 0x22 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "pd_gap2",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "pd_branch",
        type: "gitBranch",
        style: s({
          italic: true,
          fg: { kind: "rgb", r: 0xd8, g: 0xb8, b: 0x70 },
          bg: { kind: "rgb", r: 0x2e, g: 0x28, b: 0x20 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "pd_gap3",
        type: "static",
        text: " ",
        style: s({}),
      }),
      el({
        id: "pd_cost",
        type: "cost",
        precision: 2,
        style: s({
          fg: { kind: "rgb", r: 0xe8, g: 0x9b, b: 0x9e },
          bg: { kind: "rgb", r: 0x3a, g: 0x1f, b: 0x21 },
        }),
        prefix: " ",
        suffix: " ",
      }),
    ],
  },
};
