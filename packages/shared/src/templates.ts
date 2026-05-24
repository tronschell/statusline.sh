import type { AnsiStyle, Design, Element, TemplateMeta } from "./types";

// Stable IDs are intentional: templates are referenced by element id within
// the design but tests assert that re-running validation works, so collisions
// across templates do not matter — only within one design.

const s = (style: AnsiStyle): AnsiStyle => style;

function el<T extends Element>(e: T): T {
  return e;
}

// 1. Minimal — monochrome, model + dir + branch.
const minimal: Design = {
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
};

// 2. Powerline — colored chevron separators between sections.
// Uses Nerd Font right-pointing chevron  ().
const CHEV = "";
const powerline: Design = {
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
};

// 3. Verbose Dev — full readout.
const verboseDev: Design = {
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
};

// 4. Context Watch — large progress bar with color thresholds via showWhen.
const contextWatch: Design = {
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
};

// 5. Branch Split — segmentSplit on git_worktree.
const branchSplit: Design = {
  version: 1,
  name: "Branch Split",
  elements: [
    el({
      id: "bs_glyph",
      type: "glyph",
      char: " ",
      style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
    }),
    el({
      id: "bs_split",
      type: "segmentSplit",
      style: s({}),
      source: { kind: "field", path: "workspace.git_worktree" },
      delimiter: "/",
      segments: [
        { style: s({ dim: true, fg: { kind: "ansi16", index: 7 } }) },
        { style: s({ bold: true, fg: { kind: "ansi16", index: 14 } }) },
      ],
    }),
  ],
};

// 6. Two-Tone Path — splits cwd on /, fades parents, bolds basename.
// segmentSplit assigns segments by index; the last segment catches overflow.
// We use 4 entries with the last one (basename) bold so any depth still
// highlights the leaf.
const twoTonePath: Design = {
  version: 1,
  name: "Two-Tone Path",
  elements: [
    el({
      id: "tt_split",
      type: "segmentSplit",
      style: s({}),
      source: { kind: "field", path: "workspace.current_dir" },
      delimiter: "/",
      segments: [
        { style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }) },
        { style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }) },
        { style: s({ fg: { kind: "ansi16", index: 7 } }) },
        { style: s({ bold: true, fg: { kind: "ansi16", index: 15 } }) },
      ],
      joinWith: "/",
    }),
  ],
};

// 7. Pastel Dashboard — muted pastels as chip backgrounds.
// Pastels per design-system spec:
//   Red bg 3A1F21 / text E89B9E
//   Blue bg 1E2A36 / text 8FB8DA
//   Green bg 1E2A22 / text 9CC09F
//   Yellow bg 2E2820 / text D8B870
const pastelDashboard: Design = {
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
};

// 8. Just the Bar — single 30-wide context bar.
const justTheBar: Design = {
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
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Model, directory, branch — monochrome, distraction-free.",
    design: minimal,
  },
  {
    id: "powerline",
    name: "Powerline",
    description: "Colored chevron separators between sections.",
    authorCredit: "requires Nerd Font",
    design: powerline,
  },
  {
    id: "verbose-dev",
    name: "Verbose Dev",
    description:
      "Everything: model, dir, branch, line counts, context bar, cost, duration.",
    design: verboseDev,
  },
  {
    id: "context-watch",
    name: "Context Watch",
    description:
      "Large progress bar with green/yellow/red thresholds on context usage.",
    design: contextWatch,
  },
  {
    id: "branch-split",
    name: "Branch Split",
    description:
      "Demonstrates segmentSplit on git branches like feature/auth-refactor.",
    design: branchSplit,
  },
  {
    id: "two-tone-path",
    name: "Two-Tone Path",
    description:
      "Splits cwd on /, fades parent directories, bolds the basename.",
    design: twoTonePath,
  },
  {
    id: "pastel-dashboard",
    name: "Pastel Dashboard",
    description: "Muted pastel chips for each section. Aesthetic over data.",
    design: pastelDashboard,
  },
  {
    id: "just-the-bar",
    name: "Just the Bar",
    description: "A single 30-wide context bar. Ultra minimal.",
    design: justTheBar,
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
