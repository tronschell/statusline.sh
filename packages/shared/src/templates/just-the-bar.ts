import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 8. Just the Bar — single 30-wide context bar.
export const template: TemplateMeta = {
  id: "just-the-bar",
  name: "Just the Bar",
  description: "A single 30-wide context bar. Ultra minimal.",
  design: {
    version: 1,
    name: "Just the Bar",
    elements: [
      el({
        id: "jtb_bar",
        type: "contextBar",
        width: 30,
        filledChar: "█",
        emptyChar: "░",
        style: s({ fg: { kind: "ansi16", index: 7 } }),
      }),
    ],
  },
};
