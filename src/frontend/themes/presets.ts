import type { AnsiColor, ElementType } from "@statusline/shared/types";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /**
   * Maps each ElementType (or `default` fallback) to an AnsiColor
   * (the shape used in `element.style.fg`). When applying a theme we
   * overwrite every element's `style.fg` using `colors[el.type] ?? colors.default`.
   *
   * `swatch` is a small subset of hexes used purely for the preview
   * strip in the picker UI.
   */
  colors: Partial<Record<ElementType, AnsiColor>> & { default: AnsiColor };
  swatch: string[];
}

function rgb(r: number, g: number, b: number): AnsiColor {
  return { kind: "rgb", r, g, b };
}

// Helper to keep the preset table short and audit-friendly.
function makeTheme(args: {
  id: string;
  name: string;
  description: string;
  swatch: string[];
  default_: AnsiColor;
  model?: AnsiColor;
  cwd?: AnsiColor;
  gitBranch?: AnsiColor;
  gitStatus?: AnsiColor;
  contextPct?: AnsiColor;
  contextBar?: AnsiColor;
  rateLimit5h?: AnsiColor;
  rateLimit7d?: AnsiColor;
  cost?: AnsiColor;
  sessionDuration?: AnsiColor;
  separator?: AnsiColor;
  linesAdded?: AnsiColor;
  linesRemoved?: AnsiColor;
  glyph?: AnsiColor;
}): ThemePreset {
  const colors: ThemePreset["colors"] = { default: args.default_ };
  const assign = <K extends ElementType>(key: K, val: AnsiColor | undefined) => {
    if (val) colors[key] = val;
  };
  assign("model", args.model);
  assign("cwd", args.cwd);
  assign("gitBranch", args.gitBranch);
  assign("gitStatus", args.gitStatus);
  assign("contextPct", args.contextPct);
  assign("contextBar", args.contextBar);
  assign("rateLimit5h", args.rateLimit5h);
  assign("rateLimit7d", args.rateLimit7d);
  assign("cost", args.cost);
  assign("sessionDuration", args.sessionDuration);
  assign("separator", args.separator);
  assign("linesAdded", args.linesAdded);
  assign("linesRemoved", args.linesRemoved);
  assign("glyph", args.glyph);
  return {
    id: args.id,
    name: args.name,
    description: args.description,
    colors,
    swatch: args.swatch,
  };
}

/**
 * Curated color schemes. Hex values are taken from each project's official
 * palette docs (Catppuccin, Tokyo Night, Gruvbox, Nord, Solarized, Dracula).
 * Monochrome is a custom grayscale ramp for minimalist users.
 */
export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  makeTheme({
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    description: "Warm pastels on a near-black canvas",
    swatch: ["#cba6f7", "#89b4fa", "#a6e3a1", "#f9e2af", "#fab387", "#cdd6f4"],
    default_: rgb(205, 214, 244), // text
    model: rgb(203, 166, 247), // mauve
    cwd: rgb(137, 180, 250), // blue
    gitBranch: rgb(166, 227, 161), // green
    gitStatus: rgb(249, 226, 175), // yellow
    contextPct: rgb(116, 199, 236), // sapphire
    contextBar: rgb(116, 199, 236),
    rateLimit5h: rgb(245, 194, 231), // pink
    rateLimit7d: rgb(245, 194, 231),
    cost: rgb(250, 179, 135), // peach
    sessionDuration: rgb(127, 132, 156), // overlay1
    separator: rgb(88, 91, 112), // surface2
    linesAdded: rgb(166, 227, 161),
    linesRemoved: rgb(243, 139, 168), // red
    glyph: rgb(203, 166, 247),
  }),
  makeTheme({
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Moody blues and purples",
    swatch: ["#bb9af7", "#7aa2f7", "#9ece6a", "#e0af68", "#7dcfff", "#c0caf5"],
    default_: rgb(192, 202, 245), // foreground
    model: rgb(187, 154, 247), // purple
    cwd: rgb(122, 162, 247), // blue
    gitBranch: rgb(158, 206, 106), // green
    gitStatus: rgb(224, 175, 104), // orange/yellow
    contextPct: rgb(125, 207, 255), // cyan
    contextBar: rgb(125, 207, 255),
    rateLimit5h: rgb(255, 158, 100), // orange
    rateLimit7d: rgb(255, 158, 100),
    cost: rgb(255, 158, 100),
    sessionDuration: rgb(86, 95, 137), // comment
    separator: rgb(65, 72, 104), // dark3
    linesAdded: rgb(158, 206, 106),
    linesRemoved: rgb(247, 118, 142), // red
    glyph: rgb(187, 154, 247),
  }),
  makeTheme({
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    description: "Retro warm — earth tones",
    swatch: ["#d3869b", "#83a598", "#b8bb26", "#fabd2f", "#fe8019", "#ebdbb2"],
    default_: rgb(235, 219, 178), // fg1
    model: rgb(211, 134, 155), // purple
    cwd: rgb(131, 165, 152), // aqua
    gitBranch: rgb(184, 187, 38), // green
    gitStatus: rgb(250, 189, 47), // yellow
    contextPct: rgb(131, 165, 152), // aqua
    contextBar: rgb(131, 165, 152),
    rateLimit5h: rgb(254, 128, 25), // orange
    rateLimit7d: rgb(254, 128, 25),
    cost: rgb(254, 128, 25),
    sessionDuration: rgb(146, 131, 116), // gray
    separator: rgb(80, 73, 69),
    linesAdded: rgb(184, 187, 38),
    linesRemoved: rgb(251, 73, 52), // red
    glyph: rgb(211, 134, 155),
  }),
  makeTheme({
    id: "nord",
    name: "Nord",
    description: "Arctic, cool, polar blue",
    swatch: ["#88c0d0", "#81a1c1", "#a3be8c", "#ebcb8b", "#d08770", "#eceff4"],
    default_: rgb(236, 239, 244), // snow storm 3
    model: rgb(143, 188, 187), // frost-1 teal
    cwd: rgb(129, 161, 193), // frost-3 blue
    gitBranch: rgb(163, 190, 140), // aurora green
    gitStatus: rgb(235, 203, 139), // aurora yellow
    contextPct: rgb(136, 192, 208), // frost-2 cyan
    contextBar: rgb(136, 192, 208),
    rateLimit5h: rgb(208, 135, 112), // aurora orange
    rateLimit7d: rgb(208, 135, 112),
    cost: rgb(208, 135, 112),
    sessionDuration: rgb(76, 86, 106), // polar night 3
    separator: rgb(67, 76, 94), // polar night 2
    linesAdded: rgb(163, 190, 140),
    linesRemoved: rgb(191, 97, 106), // aurora red
    glyph: rgb(143, 188, 187),
  }),
  makeTheme({
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "High contrast, sun-soaked",
    swatch: ["#268bd2", "#2aa198", "#859900", "#b58900", "#cb4b16", "#839496"],
    default_: rgb(131, 148, 150), // base0
    model: rgb(38, 139, 210), // blue
    cwd: rgb(38, 139, 210),
    gitBranch: rgb(133, 153, 0), // green
    gitStatus: rgb(181, 137, 0), // yellow
    contextPct: rgb(42, 161, 152), // cyan
    contextBar: rgb(42, 161, 152),
    rateLimit5h: rgb(203, 75, 22), // orange
    rateLimit7d: rgb(203, 75, 22),
    cost: rgb(203, 75, 22),
    sessionDuration: rgb(88, 110, 117), // base01
    separator: rgb(7, 54, 66), // base02
    linesAdded: rgb(133, 153, 0),
    linesRemoved: rgb(220, 50, 47), // red
    glyph: rgb(108, 113, 196), // violet
  }),
  makeTheme({
    id: "dracula",
    name: "Dracula",
    description: "Purple, pink, and ghostly green",
    swatch: ["#bd93f9", "#8be9fd", "#50fa7b", "#f1fa8c", "#ffb86c", "#f8f8f2"],
    default_: rgb(248, 248, 242), // foreground
    model: rgb(189, 147, 249), // purple
    cwd: rgb(139, 233, 253), // cyan
    gitBranch: rgb(80, 250, 123), // green
    gitStatus: rgb(241, 250, 140), // yellow
    contextPct: rgb(139, 233, 253), // cyan
    contextBar: rgb(139, 233, 253),
    rateLimit5h: rgb(255, 184, 108), // orange
    rateLimit7d: rgb(255, 184, 108),
    cost: rgb(255, 184, 108),
    sessionDuration: rgb(98, 114, 164), // comment
    separator: rgb(68, 71, 90), // currentLine
    linesAdded: rgb(80, 250, 123),
    linesRemoved: rgb(255, 85, 85), // red
    glyph: rgb(255, 121, 198), // pink
  }),
  makeTheme({
    id: "monochrome",
    name: "Monochrome",
    description: "Grayscale only — no accents",
    swatch: ["#f4f4f5", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#27272a"],
    default_: rgb(212, 212, 216), // zinc-300
    model: rgb(244, 244, 245), // zinc-100
    cwd: rgb(228, 228, 231), // zinc-200
    gitBranch: rgb(212, 212, 216),
    gitStatus: rgb(212, 212, 216),
    contextPct: rgb(161, 161, 170), // zinc-400
    contextBar: rgb(161, 161, 170),
    rateLimit5h: rgb(161, 161, 170),
    rateLimit7d: rgb(161, 161, 170),
    cost: rgb(228, 228, 231),
    sessionDuration: rgb(113, 113, 122), // zinc-500
    separator: rgb(82, 82, 91), // zinc-600
    linesAdded: rgb(212, 212, 216),
    linesRemoved: rgb(113, 113, 122),
    glyph: rgb(244, 244, 245),
  }),
];

export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
