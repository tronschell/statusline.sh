import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 3. Verbose Dev — full readout.
export const template: TemplateMeta = {
  id: "verbose-dev",
  name: "Verbose Dev",
  description:
    "Everything: model, dir, branch, line counts, context bar, cost, duration.",
  design: {
    version: 1,
    name: "Verbose Dev",
    elements: [
      el({
        id: "vd_model",
        type: "model",
        style: s({ bold: true, fg: { kind: "ansi16", index: 14 } }),
        suffix: " ",
      }),
      el({
        id: "vd_dir",
        type: "cwd",
        mode: "tilde",
        style: s({ fg: { kind: "ansi16", index: 7 } }),
        suffix: " ",
      }),
      el({
        id: "vd_branch",
        type: "gitBranch",
        style: s({ italic: true, fg: { kind: "ansi16", index: 13 } }),
        prefix: " ",
        suffix: " ",
      }),
      el({
        id: "vd_la",
        type: "linesAdded",
        style: s({ fg: { kind: "ansi16", index: 10 } }),
        prefix: "+",
        suffix: " ",
      }),
      el({
        id: "vd_lr",
        type: "linesRemoved",
        style: s({ fg: { kind: "ansi16", index: 9 } }),
        prefix: "-",
        suffix: " ",
      }),
      el({
        id: "vd_bar",
        type: "contextBar",
        width: 12,
        filledChar: "█",
        emptyChar: "░",
        style: s({ fg: { kind: "ansi16", index: 11 } }),
        prefix: "[",
        suffix: "] ",
      }),
      el({
        id: "vd_cost",
        type: "cost",
        precision: 2,
        style: s({ fg: { kind: "ansi16", index: 3 } }),
        suffix: " ",
      }),
      el({
        id: "vd_dur",
        type: "sessionDuration",
        format: "human",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
    ],
  },
};
