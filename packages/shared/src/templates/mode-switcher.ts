import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 11. Mode Switcher — spotlights thinkingEffort, outputStyle, fastMode,
// and a rotator tagline. Cyan + magenta + amber accent triad.
export const template: TemplateMeta = {
  id: "mode-switcher",
  name: "Mode Switcher",
  description:
    "Spotlights thinking effort, output style, fast-mode, plus a rotating tagline.",
  design: {
    version: 1,
    name: "Mode Switcher",
    elements: [
      el({
        id: "ms_rotator",
        type: "rotator",
        items: ["◆ thinking", "◇ planning", "◈ coding", "◉ shipping"],
        intervalSeconds: 4,
        pickMode: "cycle",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0xec, g: 0x4a, b: 0xa1 },
        }),
        suffix: " ",
      }),
      el({
        id: "ms_sep1",
        type: "separator",
        text: "│ ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "ms_effort",
        type: "thinkingEffort",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0x22, g: 0xd3, b: 0xee },
        }),
        prefix: "✦ ",
        suffix: " ",
      }),
      el({
        id: "ms_style",
        type: "outputStyle",
        style: s({
          italic: true,
          fg: { kind: "rgb", r: 0xa8, g: 0x78, b: 0xff },
        }),
        prefix: "✎ ",
        suffix: " ",
      }),
      el({
        id: "ms_fast",
        type: "fastMode",
        text: "⚡FAST",
        style: s({
          bold: true,
          fg: { kind: "rgb", r: 0x0b, g: 0x10, b: 0x1a },
          bg: { kind: "rgb", r: 0xfd, g: 0xe0, b: 0x47 },
        }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "ms_sep2",
        type: "separator",
        text: " │ ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "ms_branch",
        type: "gitBranch",
        style: s({ italic: true, fg: { kind: "rgb", r: 0x86, g: 0xef, b: 0xac } }),
        prefix: " ",
      }),
    ],
  },
};
