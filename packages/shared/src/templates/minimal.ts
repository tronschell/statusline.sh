import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 1. Minimal — monochrome, model + dir + branch.
export const template: TemplateMeta = {
  id: "minimal",
  name: "Minimal",
  description: "Model, directory, branch — monochrome, distraction-free.",
  design: {
    version: 1,
    name: "Minimal",
    elements: [
      el({
        id: "m_model",
        type: "model",
        style: s({ bold: true, fg: { kind: "ansi16", index: 7 } }),
        suffix: " ",
      }),
      el({
        id: "m_sep1",
        type: "separator",
        text: "· ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "m_cwd",
        type: "cwd",
        mode: "basename",
        style: s({ fg: { kind: "ansi16", index: 15 } }),
        suffix: " ",
      }),
      el({
        id: "m_sep2",
        type: "separator",
        text: "· ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "m_branch",
        type: "gitBranch",
        style: s({ italic: true, fg: { kind: "ansi16", index: 7 } }),
      }),
    ],
  },
};
