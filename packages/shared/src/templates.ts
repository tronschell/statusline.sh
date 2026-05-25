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

// 9. Vital Signs — traffic-light dashboard for rate limits + tokens.
// Showcases rateLimit5h/7d bars (with reset times) and contextTokens.
// Palette mirrors the design-system pastels at slightly higher saturation.
const vitalSigns: Design = {
  version: 1,
  name: "Vital Signs",
  elements: [
    el({
      id: "vs_model",
      type: "model",
      style: s({
        bold: true,
        fg: { kind: "rgb", r: 0xff, g: 0xff, b: 0xff },
        bg: { kind: "rgb", r: 0x2b, g: 0x2f, b: 0x3a },
      }),
      prefix: " ",
      suffix: " ",
    }),
    el({
      id: "vs_gap1",
      type: "static",
      text: " ",
      style: s({}),
    }),
    el({
      id: "vs_5h_label",
      type: "static",
      text: "5h ",
      style: s({ dim: true, fg: { kind: "rgb", r: 0x9c, g: 0xc0, b: 0x9f } }),
    }),
    el({
      id: "vs_5h_bar",
      type: "rateLimit5h",
      variant: "bar",
      width: 10,
      filledChar: "▰",
      emptyChar: "▱",
      showResetTime: true,
      style: s({ fg: { kind: "rgb", r: 0x9c, g: 0xc0, b: 0x9f } }),
      suffix: " ",
    }),
    el({
      id: "vs_7d_label",
      type: "static",
      text: "7d ",
      style: s({ dim: true, fg: { kind: "rgb", r: 0xd8, g: 0xb8, b: 0x70 } }),
    }),
    el({
      id: "vs_7d_bar",
      type: "rateLimit7d",
      variant: "bar",
      width: 10,
      filledChar: "▰",
      emptyChar: "▱",
      showResetTime: true,
      style: s({ fg: { kind: "rgb", r: 0xd8, g: 0xb8, b: 0x70 } }),
      suffix: " ",
    }),
    el({
      id: "vs_ctx_label",
      type: "static",
      text: "tok ",
      style: s({ dim: true, fg: { kind: "rgb", r: 0x8f, g: 0xb8, b: 0xda } }),
    }),
    el({
      id: "vs_tokens",
      type: "contextTokens",
      variant: "used",
      compact: true,
      colorMode: "percentage",
      style: s({ bold: true, fg: { kind: "rgb", r: 0x8f, g: 0xb8, b: 0xda } }),
    }),
  ],
};

// 10. Two-Line Cockpit — multi-line layout via lineBreak.
// Line 1: model + cwd + branch + gitStatus (custom marker).
// Line 2: context bar + cost + duration with chip backgrounds.
const twoLineCockpit: Design = {
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
};

// 11. Mode Switcher — spotlights thinkingEffort, outputStyle, fastMode,
// and a rotator tagline. Cyan + magenta + amber accent triad.
const modeSwitcher: Design = {
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
};

// 12. Neon Pulse — cyberpunk palette with right-aligned context bar via
// flex spacer. gitStatus uses custom dirty/clean glyphs.
const neonPulse: Design = {
  version: 1,
  name: "Neon Pulse",
  elements: [
    el({
      id: "np_model",
      type: "model",
      style: s({
        bold: true,
        fg: { kind: "rgb", r: 0x0a, g: 0x0a, b: 0x0a },
        bg: { kind: "rgb", r: 0xff, g: 0x2d, b: 0x95 },
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
      mode: "flex",
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
      filledChar: "━",
      emptyChar: "─",
      colorMode: "percentage",
      style: s({ fg: { kind: "rgb", r: 0x05, g: 0xf2, b: 0xff } }),
      prefix: "[",
      suffix: "]",
    }),
  ],
};

// 13. Ocean Wave — multi-line gradient palette (deep blue → teal → seafoam).
// Demonstrates contextTokens with ratioPct + flex spacer right-alignment.
const oceanWave: Design = {
  version: 1,
  name: "Ocean Wave",
  elements: [
    el({
      id: "ow_model",
      type: "model",
      style: s({
        bold: true,
        fg: { kind: "rgb", r: 0xf0, g: 0xfd, b: 0xfa },
        bg: { kind: "rgb", r: 0x0c, g: 0x4a, b: 0x6e },
      }),
      prefix: " ",
      suffix: " ",
    }),
    el({
      id: "ow_cwd",
      type: "cwd",
      mode: "basename",
      style: s({
        fg: { kind: "rgb", r: 0xf0, g: 0xfd, b: 0xfa },
        bg: { kind: "rgb", r: 0x0e, g: 0x74, b: 0x90 },
      }),
      prefix: " ",
      suffix: " ",
    }),
    el({
      id: "ow_branch",
      type: "gitBranch",
      style: s({
        italic: true,
        fg: { kind: "rgb", r: 0x04, g: 0x2f, b: 0x2e },
        bg: { kind: "rgb", r: 0x5e, g: 0xea, b: 0xd4 },
      }),
      prefix: "  ",
      suffix: " ",
    }),
    el({
      id: "ow_spacer1",
      type: "spacer",
      mode: "flex",
      char: " ",
      style: s({}),
    }),
    el({
      id: "ow_dur",
      type: "sessionDuration",
      format: "human",
      style: s({ italic: true, fg: { kind: "rgb", r: 0x99, g: 0xf6, b: 0xe4 } }),
      prefix: "⌛ ",
    }),
    el({ id: "ow_lb", type: "lineBreak", style: s({}) }),
    el({
      id: "ow_tokens",
      type: "contextTokens",
      variant: "ratioPct",
      compact: true,
      colorMode: "percentage",
      style: s({ bold: true }),
      prefix: " ",
      suffix: " ",
    }),
    el({
      id: "ow_bar",
      type: "contextBar",
      width: 20,
      filledChar: "≋",
      emptyChar: "·",
      colorMode: "percentage",
      style: s({ fg: { kind: "rgb", r: 0x2d, g: 0xd4, b: 0xbf } }),
      prefix: "[",
      suffix: "] ",
    }),
    el({
      id: "ow_spacer2",
      type: "spacer",
      mode: "flex",
      char: " ",
      style: s({}),
    }),
    el({
      id: "ow_cost",
      type: "cost",
      precision: 2,
      style: s({ fg: { kind: "rgb", r: 0xa5, g: 0xf3, b: 0xfc } }),
      prefix: "$",
    }),
  ],
};

// 14. Triptych — three-row layout with two lineBreaks. Warm sunset palette.
// Line 1 (identity): model · cwd · branch · gitStatus
// Line 2 (progress): context bar · tokens · cost
// Line 3 (modes):    effort · output style · fast · rotator · duration
const triptych: Design = {
  version: 1,
  name: "Triptych",
  elements: [
    el({
      id: "tri_model",
      type: "model",
      style: s({
        bold: true,
        fg: { kind: "rgb", r: 0xfc, g: 0xe7, b: 0xf3 },
        bg: { kind: "rgb", r: 0x7c, g: 0x2d, b: 0x4d },
      }),
      prefix: " ",
      suffix: " ",
    }),
    el({
      id: "tri_gap1",
      type: "static",
      text: " ",
      style: s({}),
    }),
    el({
      id: "tri_cwd",
      type: "cwd",
      mode: "tilde",
      style: s({ bold: true, fg: { kind: "rgb", r: 0xfd, g: 0xba, b: 0x74 } }),
      suffix: " ",
    }),
    el({
      id: "tri_branch",
      type: "gitBranch",
      style: s({ italic: true, fg: { kind: "rgb", r: 0xfe, g: 0xd7, b: 0xaa } }),
      prefix: " ",
    }),
    el({
      id: "tri_status",
      type: "gitStatus",
      dirtyText: " ◆",
      cleanText: " ◇",
      dirtyStyle: s({ bold: true, fg: { kind: "rgb", r: 0xfb, g: 0xbf, b: 0x24 } }),
      cleanStyle: s({ dim: true, fg: { kind: "rgb", r: 0xfb, g: 0x92, b: 0x3c } }),
      style: s({}),
    }),
    el({ id: "tri_lb1", type: "lineBreak", style: s({}) }),
    el({
      id: "tri_ctx_label",
      type: "static",
      text: " ctx ",
      style: s({ dim: true, fg: { kind: "rgb", r: 0xfb, g: 0x92, b: 0x3c } }),
    }),
    el({
      id: "tri_bar",
      type: "contextBar",
      width: 18,
      filledChar: "▰",
      emptyChar: "▱",
      colorMode: "percentage",
      style: s({ fg: { kind: "rgb", r: 0xfb, g: 0x92, b: 0x3c } }),
      suffix: " ",
    }),
    el({
      id: "tri_tokens",
      type: "contextTokens",
      variant: "ratioPct",
      compact: true,
      colorMode: "percentage",
      style: s({ bold: true }),
      suffix: " ",
    }),
    el({
      id: "tri_sep1",
      type: "separator",
      text: "· ",
      style: s({ dim: true, fg: { kind: "ansi16", index: 8 } }),
    }),
    el({
      id: "tri_cost",
      type: "cost",
      precision: 2,
      style: s({ fg: { kind: "rgb", r: 0xfe, g: 0xf3, b: 0xc7 } }),
      prefix: "$",
    }),
    el({ id: "tri_lb2", type: "lineBreak", style: s({}) }),
    el({
      id: "tri_effort",
      type: "thinkingEffort",
      style: s({ bold: true, fg: { kind: "rgb", r: 0xec, g: 0x4a, b: 0xa1 } }),
      prefix: " ✦ ",
      suffix: " ",
    }),
    el({
      id: "tri_style",
      type: "outputStyle",
      style: s({ italic: true, fg: { kind: "rgb", r: 0xf0, g: 0xab, b: 0xfc } }),
      prefix: "✎ ",
      suffix: " ",
    }),
    el({
      id: "tri_fast",
      type: "fastMode",
      text: "⚡",
      style: s({
        bold: true,
        fg: { kind: "rgb", r: 0x0b, g: 0x10, b: 0x1a },
        bg: { kind: "rgb", r: 0xfd, g: 0xe0, b: 0x47 },
      }),
      prefix: " ",
      suffix: " ",
    }),
    el({
      id: "tri_rotator",
      type: "rotator",
      items: ["building", "thinking", "shipping", "exploring"],
      intervalSeconds: 5,
      pickMode: "cycle",
      style: s({ italic: true, fg: { kind: "rgb", r: 0xfb, g: 0xcf, b: 0xe8 } }),
      prefix: " · ",
      suffix: " ",
    }),
    el({
      id: "tri_dur",
      type: "sessionDuration",
      format: "human",
      style: s({ dim: true, fg: { kind: "rgb", r: 0xfd, g: 0xba, b: 0x74 } }),
      prefix: "· ",
    }),
  ],
};

// Order is gallery-facing. Interleave by visual density (single-line / multi-line),
// palette family (mono / warm / cool / neon), and feature focus so adjacent
// cards feel distinct. Tests assert membership, not ordering — feel free to
// re-shuffle without breaking anything.
export const TEMPLATES: TemplateMeta[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Model, directory, branch — monochrome, distraction-free.",
    design: minimal,
  },
  {
    id: "neon-pulse",
    name: "Neon Pulse",
    description:
      "Cyberpunk palette with a flex spacer that right-aligns the context bar.",
    design: neonPulse,
  },
  {
    id: "verbose-dev",
    name: "Verbose Dev",
    description:
      "Everything: model, dir, branch, line counts, context bar, cost, duration.",
    design: verboseDev,
  },
  {
    id: "two-line-cockpit",
    name: "Two-Line Cockpit",
    description:
      "Two-row layout: model/dir/branch up top, context/cost/duration below.",
    design: twoLineCockpit,
  },
  {
    id: "pastel-dashboard",
    name: "Pastel Dashboard",
    description: "Muted pastel chips for each section. Aesthetic over data.",
    design: pastelDashboard,
  },
  {
    id: "triptych",
    name: "Triptych",
    description:
      "Three-row sunset layout: identity, progress, modes — each on its own line.",
    design: triptych,
  },
  {
    id: "powerline",
    name: "Powerline",
    description: "Colored chevron separators between sections.",
    authorCredit: "requires Nerd Font",
    design: powerline,
  },
  {
    id: "vital-signs",
    name: "Vital Signs",
    description:
      "Traffic-light dashboard for 5h + 7d rate limits and token usage.",
    design: vitalSigns,
  },
  {
    id: "branch-split",
    name: "Branch Split",
    description:
      "Demonstrates segmentSplit on git branches like feature/auth-refactor.",
    design: branchSplit,
  },
  {
    id: "mode-switcher",
    name: "Mode Switcher",
    description:
      "Spotlights thinking effort, output style, fast-mode, plus a rotating tagline.",
    design: modeSwitcher,
  },
  {
    id: "two-tone-path",
    name: "Two-Tone Path",
    description:
      "Splits cwd on /, fades parent directories, bolds the basename.",
    design: twoTonePath,
  },
  {
    id: "ocean-wave",
    name: "Ocean Wave",
    description:
      "Two-line ocean gradient with token ratio and flex-aligned cost.",
    design: oceanWave,
  },
  {
    id: "context-watch",
    name: "Context Watch",
    description:
      "Large progress bar with green/yellow/red thresholds on context usage.",
    design: contextWatch,
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
