import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 2. Powerline — colored chevron separators between sections.
// U+25B6 (Geometric Shapes) — a font-portable powerline-style separator that
// renders in plain monospace fonts, so the preview never shows tofu (the old
// U+E0B0 Nerd Font chevron required a patched font and rendered as box-question).
const CHEV = "▶";

export const template: TemplateMeta = {
  id: "powerline",
  name: "Powerline",
  description: "Colored chevron separators between sections.",
  design: {
    version: 1,
    name: "Powerline",
    elements: [
      el({
        id: "pl_model",
        type: "model",
        style: s({
          bold: true,
          fg: { kind: "ansi256", index: 231 },
          bg: { kind: "ansi256", index: 24 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "pl_chev1",
        type: "separator",
        text: CHEV,
        style: s({
          fg: { kind: "ansi256", index: 24 },
          bg: { kind: "ansi256", index: 240 },
        }),
      }),
      el({
        id: "pl_cwd",
        type: "cwd",
        mode: "basename",
        style: s({
          fg: { kind: "ansi256", index: 231 },
          bg: { kind: "ansi256", index: 240 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "pl_chev2",
        type: "separator",
        text: CHEV,
        style: s({
          fg: { kind: "ansi256", index: 240 },
          bg: { kind: "ansi256", index: 22 },
        }),
      }),
      el({
        id: "pl_branch",
        type: "gitBranch",
        style: s({
          fg: { kind: "ansi256", index: 231 },
          bg: { kind: "ansi256", index: 22 },
        }),
        prefix: "  ",
        suffix: " ",
      }),
      el({
        id: "pl_chev3",
        type: "separator",
        text: CHEV,
        style: s({ fg: { kind: "ansi256", index: 22 } }),
      }),
    ],
  },
};
