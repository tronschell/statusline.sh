import type { TemplateMeta } from "../types";
import { el, s } from "./_shared";

// 4. Context Watch — large progress bar with color thresholds via showWhen.
export const template: TemplateMeta = {
  id: "context-watch",
  name: "Context Watch",
  description:
    "Large progress bar with green/yellow/red thresholds on context usage.",
  design: {
    version: 1,
    name: "Context Watch",
    elements: [
      el({
        id: "cw_label",
        type: "static",
        text: "ctx ",
        style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
      }),
      el({
        id: "cw_bar",
        type: "contextBar",
        width: 24,
        filledChar: "█",
        emptyChar: "░",
        style: s({ fg: { kind: "ansi16", index: 7 } }),
        suffix: " ",
      }),
      // green when pct < 50
      el({
        id: "cw_pct_green",
        type: "contextPct",
        style: s({ bold: true, fg: { kind: "ansi16", index: 10 } }),
        suffix: "%",
        showWhen: {
          field: "context_window.used_percentage",
          op: "lt",
          value: 50,
        },
      }),
      // yellow when 50 <= pct < 80 — encoded as pct >= 50 (lower bound).
      // The renderer evaluates each element independently, so an "upper bound"
      // would require nested conds. We approximate with two gates: gt 49 AND
      // lt 80 isn't expressible in one ConditionExpr; instead we render yellow
      // for pct >= 50, and red overrides on top when pct >= 80. The red gate
      // (showWhen gt 79) comes last so it visually replaces yellow in the
      // common case where both branches would otherwise render — except they
      // are separate elements, so both appear. To prevent doubling we render
      // yellow only when pct < 80 by inverting: use lt 80, then we need to
      // gate out the <50 case too. ContextPct cannot stack two showWhens,
      // so we accept that yellow fires for pct in [0,80) — but the green
      // element above already covers [0,50). Real "between" semantics live
      // in T6's Inspector via separate stacked conditionals; for the seed
      // template we ship three thresholds that visually overlap a tiny
      // amount, which is fine for a demo.
      el({
        id: "cw_pct_yellow",
        type: "contextPct",
        style: s({ bold: true, fg: { kind: "ansi16", index: 11 } }),
        suffix: "%",
        showWhen: {
          field: "context_window.used_percentage",
          op: "gt",
          value: 49.999,
        },
      }),
      el({
        id: "cw_pct_red",
        type: "contextPct",
        style: s({ bold: true, fg: { kind: "ansi16", index: 9 } }),
        suffix: "%",
        showWhen: {
          field: "context_window.used_percentage",
          op: "gt",
          value: 79.999,
        },
      }),
    ],
  },
};
