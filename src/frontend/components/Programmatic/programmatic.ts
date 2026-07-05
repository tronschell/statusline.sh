import type { Design } from "@statusline/shared/types";

/**
 * Configuration for the programmatic SEO landing pages.
 *
 * One page per Claude Code statusline element. Each entry powers a
 * dedicated URL like `/claude-code-statusline-git-branch` and is keyed
 * off the topic slug used in the route param.
 *
 * Body content stays in this file (not in a CMS or MDX) so it ships in
 * the prerendered HTML shell emitted by build.ts and is fully indexable
 * before any React hydration. Designs are inlined as plain objects so
 * the interpreter can render them at build- and run-time without any
 * extra plumbing.
 */
export interface ProgrammaticBodySection {
  heading: string;
  paragraphs: string[];
}

export interface ProgrammaticRelatedLink {
  href: string;
  label: string;
}

export interface ProgrammaticPageConfig {
  topic: string;
  path: string;
  h1: string;
  eyebrow: string;
  lede: string;
  metaTitle: string;
  metaDescription: string;
  ctaHref: string;
  ctaLabel: string;
  sections: ProgrammaticBodySection[];
  sampleDesign: Design;
  related: ProgrammaticRelatedLink[];
}

const COLOR_GRAY_DIM = { kind: "ansi16", index: 8 } as const;
const COLOR_GREEN = { kind: "ansi16", index: 2 } as const;
const COLOR_CYAN = { kind: "ansi16", index: 6 } as const;
const COLOR_BLUE = { kind: "ansi16", index: 12 } as const;
const COLOR_YELLOW = { kind: "ansi16", index: 11 } as const;
const COLOR_MAGENTA = { kind: "ansi16", index: 13 } as const;
const COLOR_WHITE = { kind: "ansi16", index: 15 } as const;
const COLOR_RED = { kind: "ansi16", index: 1 } as const;
const COLOR_BLACK = { kind: "ansi16", index: 0 } as const;
// Darker, saturated backgrounds for the powerline segment fills (the bright
// fg palette above reads poorly as a segment background).
const COLOR_BG_BLUE = { kind: "ansi16", index: 4 } as const;
const COLOR_BG_MAGENTA = { kind: "ansi16", index: 5 } as const;

const DESIGNS: Record<string, Design> = {
  "git-branch": {
    version: 1,
    name: "Git branch statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "basename",
        style: { fg: COLOR_BLUE },
        suffix: " ",
      },
      {
        id: "sep",
        type: "separator",
        text: " on ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "branch",
        type: "gitBranch",
        style: { fg: COLOR_GREEN, bold: true },
      },
    ],
  },
  "token-usage": {
    version: 1,
    name: "Token usage statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "ctxLabel",
        type: "separator",
        text: "ctx ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "ctxBar",
        type: "contextBar",
        width: 12,
        filledChar: "█",
        emptyChar: "░",
        colorMode: "percentage",
        style: {},
        suffix: " ",
      },
      {
        id: "ctxPct",
        type: "contextPct",
        colorMode: "percentage",
        style: {},
      },
    ],
  },
  cost: {
    version: 1,
    name: "Cost statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "branch",
        type: "gitBranch",
        style: { fg: COLOR_GREEN },
        suffix: "  ",
      },
      {
        id: "costLabel",
        type: "separator",
        text: "$ ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "cost",
        type: "cost",
        precision: 2,
        style: { fg: COLOR_YELLOW, bold: true },
      },
    ],
  },
  model: {
    version: 1,
    name: "Model statusline",
    elements: [
      {
        id: "modelLabel",
        type: "separator",
        text: "model: ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "model",
        type: "model",
        style: { fg: COLOR_MAGENTA, bold: true },
        suffix: "  ",
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "tilde",
        style: { fg: COLOR_BLUE },
      },
    ],
  },
  duration: {
    version: 1,
    name: "Duration statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "basename",
        style: { fg: COLOR_BLUE },
        suffix: "  ",
      },
      {
        id: "clock",
        type: "separator",
        text: "⏱ ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "dur",
        type: "sessionDuration",
        format: "human",
        style: { fg: COLOR_CYAN },
      },
    ],
  },
  "rate-limit": {
    version: 1,
    name: "Rate limit statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "fhLabel",
        type: "separator",
        text: "5h ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "fh",
        type: "rateLimit5h",
        variant: "bar",
        width: 10,
        filledChar: "█",
        emptyChar: "░",
        style: { fg: COLOR_CYAN },
        suffix: "  ",
      },
      {
        id: "sdLabel",
        type: "separator",
        text: "7d ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "sd",
        type: "rateLimit7d",
        variant: "pct",
        width: 10,
        filledChar: "█",
        emptyChar: "░",
        style: { fg: COLOR_MAGENTA },
      },
    ],
  },
  directory: {
    version: 1,
    name: "Directory statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "in",
        type: "separator",
        text: "in ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "compact",
        style: { fg: COLOR_BLUE, bold: true },
      },
    ],
  },
  "lines-changed": {
    version: 1,
    name: "Lines changed statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "branch",
        type: "gitBranch",
        style: { fg: COLOR_GREEN },
        suffix: "  ",
      },
      {
        id: "added",
        type: "linesAdded",
        prefix: "+",
        style: { fg: COLOR_GREEN, bold: true },
        suffix: " ",
      },
      {
        id: "removed",
        type: "linesRemoved",
        prefix: "-",
        style: { fg: COLOR_RED, bold: true },
      },
    ],
  },
  "context-window": {
    version: 1,
    name: "Context window statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "ctxLabel",
        type: "separator",
        text: "context ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "ctxBar",
        type: "contextBar",
        width: 14,
        filledChar: "▓",
        emptyChar: "░",
        colorMode: "percentage",
        style: {},
        suffix: " ",
      },
      {
        id: "ctxTokens",
        type: "contextTokens",
        variant: "ratioPct",
        compact: true,
        colorMode: "percentage",
        style: {},
      },
    ],
  },
  "output-style": {
    version: 1,
    name: "Output style statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "styleLabel",
        type: "separator",
        text: "style ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "outStyle",
        type: "outputStyle",
        style: { fg: COLOR_CYAN, bold: true },
      },
    ],
  },
  "thinking-effort": {
    version: 1,
    name: "Thinking effort statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "thinkLabel",
        type: "separator",
        text: "thinking ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "effort",
        type: "thinkingEffort",
        style: { fg: COLOR_YELLOW, bold: true },
      },
    ],
  },
  "nerd-font": {
    version: 1,
    name: "Nerd Font statusline",
    elements: [
      {
        id: "folderIcon",
        type: "glyph",
        char: "",
        style: { fg: COLOR_BLUE },
        suffix: " ",
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "basename",
        style: { fg: COLOR_BLUE },
        suffix: "  ",
      },
      {
        id: "branchIcon",
        type: "glyph",
        char: "",
        style: { fg: COLOR_GREEN },
        suffix: " ",
      },
      {
        id: "branch",
        type: "gitBranch",
        style: { fg: COLOR_GREEN },
        suffix: "  ",
      },
      {
        id: "costIcon",
        type: "glyph",
        char: "",
        style: { fg: COLOR_YELLOW },
        suffix: " ",
      },
      {
        id: "cost",
        type: "cost",
        precision: 2,
        style: { fg: COLOR_YELLOW },
      },
    ],
  },
  powerline: {
    version: 1,
    name: "Powerline statusline",
    elements: [
      {
        id: "model",
        type: "model",
        prefix: " ",
        suffix: " ",
        style: { bg: COLOR_BG_BLUE, fg: COLOR_WHITE, bold: true },
      },
      {
        id: "sep1",
        type: "separator",
        text: "",
        style: { fg: COLOR_BG_BLUE, bg: COLOR_GREEN },
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "basename",
        prefix: " ",
        suffix: " ",
        style: { bg: COLOR_GREEN, fg: COLOR_BLACK },
      },
      {
        id: "sep2",
        type: "separator",
        text: "",
        style: { fg: COLOR_GREEN, bg: COLOR_BG_MAGENTA },
      },
      {
        id: "branch",
        type: "gitBranch",
        prefix: " ",
        suffix: " ",
        style: { bg: COLOR_BG_MAGENTA, fg: COLOR_WHITE },
      },
      {
        id: "cap",
        type: "separator",
        text: "",
        style: { fg: COLOR_BG_MAGENTA },
      },
    ],
  },
  windows: {
    version: 1,
    name: "Windows statusline",
    elements: [
      {
        id: "model",
        type: "model",
        style: { bold: true, fg: COLOR_WHITE },
        suffix: "  ",
      },
      {
        id: "cwd",
        type: "cwd",
        mode: "tilde",
        style: { fg: COLOR_BLUE },
        suffix: "  ",
      },
      {
        id: "branch",
        type: "gitBranch",
        style: { fg: COLOR_GREEN },
        suffix: "  ",
      },
      {
        id: "ctxLabel",
        type: "separator",
        text: "ctx ",
        style: { fg: COLOR_GRAY_DIM },
      },
      {
        id: "ctxPct",
        type: "contextPct",
        colorMode: "percentage",
        style: { fg: COLOR_CYAN },
        suffix: "%",
      },
    ],
  },
};

function design(topic: string): Design {
  const d = DESIGNS[topic];
  if (!d) throw new Error(`Missing sample design for topic ${topic}`);
  return d;
}

export const PROGRAMMATIC_PAGES: ProgrammaticPageConfig[] = [
  {
    topic: "git-branch",
    path: "/claude-code-statusline-git-branch",
    h1: "Claude Code statusline with git branch",
    eyebrow: "Element guide",
    lede: "Show the current git branch in your Claude Code statusline so you always know which branch the assistant is editing.",
    metaTitle:
      "Claude Code Statusline with Git Branch | statusline.sh",
    metaDescription:
      "Add a live git branch indicator to your Claude Code statusline. Visual builder, live preview, one-command install on macOS, Linux, and Windows.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("git-branch"),
    sections: [
      {
        heading: "Why include the git branch?",
        paragraphs: [
          "When Claude Code spans multiple sessions, it is easy to lose track of which branch is checked out. The git branch element reads `workspace.git_worktree` from the session JSON Claude pipes to your statusline command on every render and prints the active branch name.",
          "Branch context is especially helpful when you keep separate worktrees for review, experiment, and main lines of work. A glance at the bottom of the terminal confirms whether the agent is editing the right tree before you accept a multi-file edit.",
        ],
      },
      {
        heading: "How it looks",
        paragraphs: [
          "The preview below pairs the model name with the active directory and the branch, styled green and bold to call attention. The git branch element is conditional by default — when you are outside a git worktree, the element simply renders nothing and your statusline collapses cleanly around it.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Open the visual builder, drag the Git Branch element onto the canvas, and pick a foreground color. The live preview re-renders on every change so you can iterate on styling without leaving the page. When the design looks right, hit Install and paste the one-line command into your terminal — the installer structurally merges your new statusline into `~/.claude/settings.json` without touching any of your other settings.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-model",
        label: "Add the model name",
      },
      {
        href: "/claude-code-statusline-cost",
        label: "Add session cost",
      },
    ],
  },
  {
    topic: "token-usage",
    path: "/claude-code-statusline-token-usage",
    h1: "Claude Code statusline with token usage",
    eyebrow: "Element guide",
    lede: "See live context window usage in your Claude Code statusline — percentage, progress bar, or absolute token counts.",
    metaTitle:
      "Claude Code Statusline with Token Usage | statusline.sh",
    metaDescription:
      "Render the Claude Code context window as a progress bar or percentage in your statusline. Threshold colors warn before you hit the cap.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("token-usage"),
    sections: [
      {
        heading: "Why track context in your statusline?",
        paragraphs: [
          "Claude Code emits `context_window.used_percentage`, `total_input_tokens`, and `context_window_size` on every render. Surfacing those numbers in your statusline lets you spot when a session is approaching the limit before you hit a compaction or rejection mid-edit.",
          "statusline.sh ships two complementary elements: `contextBar` renders an inline progress bar with configurable width and fill characters, and `contextPct` prints the raw percentage. A `contextTokens` variant prints absolute used / remaining / ratio counts in compact (`94.4k/200k`) or full form.",
        ],
      },
      {
        heading: "Threshold-aware colors",
        paragraphs: [
          "All three context elements support a `colorMode` of `percentage` or `absolute` that color-codes the output as it crosses configurable green / yellow / orange / red thresholds. The bar in the preview below smoothly transitions through the palette as you grow the session — no extra script logic required.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Drag the Context Bar or Context % element onto the builder canvas, set the width and characters, and pick a color mode. The live preview uses realistic mock session data so you can preview the bar at fresh, mid, and near-cap usage before installing.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-cost",
        label: "Add cost tracking",
      },
      {
        href: "/claude-code-statusline-rate-limit",
        label: "Add rate-limit progress",
      },
    ],
  },
  {
    topic: "cost",
    path: "/claude-code-statusline-cost",
    h1: "Claude Code statusline with cost display",
    eyebrow: "Element guide",
    lede: "Add a live running cost estimate to your Claude Code statusline so long sessions stay budget-aware.",
    metaTitle:
      "Claude Code Statusline with Cost Display | statusline.sh",
    metaDescription:
      "Show the running USD cost of your Claude Code session in the statusline. Configurable precision, color-coded styling, and one-command install.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("cost"),
    sections: [
      {
        heading: "Why show session cost?",
        paragraphs: [
          "Claude Code reports the accumulated session spend on `cost.total_cost_usd` every time it renders the statusline. Putting that number in your terminal turns it into a quiet ambient signal — useful for long autonomous runs where you want to notice if a loop has burned through ten dollars without you noticing.",
          "The cost element is a computed expression in the IR (`cost_fmt`) — it formats the raw float to a configurable precision and adds a leading `$`. Pair it with a Static element prefix like `spent ` if you want extra context.",
        ],
      },
      {
        heading: "How it looks",
        paragraphs: [
          "The preview below combines model, current branch, and the running cost styled in bold yellow. The element accepts any ANSI style — switch to dim gray for a quieter presentation, or to a red 256-color above a threshold using a conditional wrapper.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Drag the Cost element from the palette, set precision (typically 2 or 4 decimals), and pick a foreground color. The same IR powers the bash, PowerShell, and browser interpreter backends, so what you see in the preview is byte-for-byte what your terminal will render after install.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-duration",
        label: "Add session duration",
      },
      {
        href: "/claude-code-statusline-token-usage",
        label: "Add token usage",
      },
    ],
  },
  {
    topic: "model",
    path: "/claude-code-statusline-model",
    h1: "Claude Code statusline with model name",
    eyebrow: "Element guide",
    lede: "Display the active Claude model in your Claude Code statusline so you always know whether Opus, Sonnet, or Haiku is driving.",
    metaTitle:
      "Claude Code Statusline with Model Name | statusline.sh",
    metaDescription:
      "Add the active Claude model to your terminal statusline. Visual builder, live preview, and a one-command install that preserves the rest of settings.json.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("model"),
    sections: [
      {
        heading: "Why surface the model?",
        paragraphs: [
          "Claude Code session JSON contains `model.display_name` (and `model.id`), which is exactly what you want pinned to your terminal during a long-running session. Switching models mid-project — for example, dropping to Haiku for a quick batch — is harder to track without it.",
          "The model element reads `model.display_name` and falls back to `model.id` if a friendly name is missing, so the same element works across model upgrades without any change to your design.",
        ],
      },
      {
        heading: "How it looks",
        paragraphs: [
          "The preview pairs a dim `model:` label, the active model name in magenta, and a tilde-collapsed working directory. The element accepts the full ANSI styling palette — bold, italic, dim, 16-color, 256-color, and truecolor — and the live preview uses the same interpreter the install script will use.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Drag the Model element from the palette, style it however you like, and use the live preview to confirm. When you hit install, the generated script is wrapped in a quoted heredoc and merged into `settings.json` without disturbing any other keys.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-git-branch",
        label: "Add the git branch",
      },
      {
        href: "/claude-code-statusline-cost",
        label: "Add cost tracking",
      },
    ],
  },
  {
    topic: "duration",
    path: "/claude-code-statusline-duration",
    h1: "Claude Code statusline with session duration",
    eyebrow: "Element guide",
    lede: "Track how long the current Claude Code session has been running, right in the terminal status bar.",
    metaTitle:
      "Claude Code Statusline with Session Duration | statusline.sh",
    metaDescription:
      "Add elapsed session time to your Claude Code statusline. Choose human-readable or HH:MM:SS formatting and style it with any ANSI color.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("duration"),
    sections: [
      {
        heading: "Why a session timer?",
        paragraphs: [
          "Claude Code reports `cost.total_duration_ms` on every render — the total wall-clock time the session has been open. Surfacing that as a duration in your statusline makes deep work sessions visible without leaving the terminal.",
          "statusline.sh exposes two formats. Pick `human` for compact output like `8m 47s` or `1h 12m`, or `hms` for a colon-padded clock like `1:12:08`. Internally both are lowered to the `duration_human` / `duration_hms` computed expressions so the bash, PowerShell, and browser backends stay byte-identical.",
        ],
      },
      {
        heading: "How it looks",
        paragraphs: [
          "The preview below pairs the model, the active directory, a small clock glyph, and the running duration in cyan. Drop in a Static prefix like `up ` for natural reading, or pair it with the Cost element to get a quick read on time-and-money spent per session.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Drag the Session Duration element from the palette, choose `human` or `hms`, and style it. The live preview uses realistic mock durations so you can pick a format that stays compact even after several hours.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-cost",
        label: "Add cost tracking",
      },
      {
        href: "/claude-code-statusline-rate-limit",
        label: "Add rate-limit info",
      },
    ],
  },
  {
    topic: "rate-limit",
    path: "/claude-code-statusline-rate-limit",
    h1: "Claude Code statusline with rate limit",
    eyebrow: "Element guide",
    lede: "Visualize Claude Code's 5-hour and 7-day rate limit usage in your statusline before you bump into a soft cap.",
    metaTitle:
      "Claude Code Statusline with Rate Limit | statusline.sh",
    metaDescription:
      "Add the 5h and 7d Claude Code rate limit bars or percentages to your terminal statusline. Two element variants, configurable width, one-command install.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("rate-limit"),
    sections: [
      {
        heading: "Why show rate limits?",
        paragraphs: [
          "Claude Code reports rate-limit usage on `rate_limits.five_hour.used_percentage` and `rate_limits.seven_day.used_percentage`, plus reset timestamps. Pinning those numbers in your statusline turns a hidden quota into a visible signal — useful when you are deep into a batch of agentic edits and want to know whether you have room to keep pushing.",
          "statusline.sh ships two element variants for each window. The `bar` variant renders an inline progress bar (configurable width, filled/empty chars). The `pct` variant prints just the percentage. Both share a hidden `showResetTime` flag that adds a `T-1h22m` countdown computed from the reset timestamp.",
        ],
      },
      {
        heading: "How it looks",
        paragraphs: [
          "The preview combines the model, a 5-hour bar in cyan, and a 7-day percentage in magenta. Either variant is conditional — if Claude Code does not emit rate-limit data in your session JSON, the element renders nothing and the statusline collapses around it.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Open the builder, drag the Rate Limit 5h and/or 7d elements onto the canvas, and pick a variant from the inspector. The same hand-rolled compiler that lowers every other element to a `RenderOp[]` powers this one — what you see in the live preview is exactly what the installed bash and PowerShell scripts will render.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-token-usage",
        label: "Add token usage",
      },
      {
        href: "/claude-code-statusline-cost",
        label: "Add session cost",
      },
    ],
  },
  {
    topic: "directory",
    path: "/claude-code-statusline-directory",
    h1: "Claude Code statusline with the working directory",
    eyebrow: "Element guide",
    lede: "Show the current working directory (cwd) in your Claude Code statusline — as a basename, a tilde-collapsed path, or a compact one-letter trail.",
    metaTitle: "Claude Code Statusline with Directory (cwd) | statusline.sh",
    metaDescription:
      "Add the working directory to your Claude Code statusline. Choose basename, full, tilde, or compact path modes, style it, and install in one command.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("directory"),
    sections: [
      {
        heading: "Which directory does Claude Code report?",
        paragraphs: [
          "Claude Code pipes the session as JSON on every render, and the directory element reads `workspace.current_dir` — the folder Claude Code is actually operating in, which can differ from where you launched the CLI. The element also honors `maxLength`, so a deep path never blows out the width of the status line.",
          "Because the path is resolved from the live session, the statusline stays correct as you move between packages in a monorepo or jump into a subproject — the directory segment simply updates on the next render.",
        ],
      },
      {
        heading: "Four ways to render the path",
        paragraphs: [
          "The cwd element ships four modes so you can trade detail for width. `basename` shows just the final folder (`statusline-maker`). `tilde` collapses your home prefix to `~` (`~/projects/statusline-maker`). `full` prints the absolute path. `compact` abbreviates every parent to its first letter and keeps the leaf intact (`/U/d/p/statusline-maker`) — the preview below uses compact mode.",
          "All four are computed identically across the bash, PowerShell, and browser backends, so the compact abbreviation and tilde collapsing you see in the live preview are byte-for-byte what your terminal prints after install.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Open the visual builder, drag the Directory element onto the canvas, and pick a mode from the inspector. Set a maxLength if you work in deeply nested trees, then style the segment with any ANSI color. When it looks right, install the generated command and it merges into your settings.json without disturbing any other keys.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-git-branch",
        label: "Pair it with the git branch",
      },
      {
        href: "/best-claude-code-statusline",
        label: "Compare Claude Code statusline tools",
      },
    ],
  },
  {
    topic: "lines-changed",
    path: "/claude-code-statusline-lines-changed",
    h1: "Claude Code statusline with lines changed",
    eyebrow: "Element guide",
    lede: "Show how many lines the current Claude Code session has added and removed, right in the status line — a live diffstat for agentic edits.",
    metaTitle:
      "Claude Code Statusline with Lines Changed (+/-) | statusline.sh",
    metaDescription:
      "Add live added and removed line counts to your Claude Code statusline. Two elements, +green / -red styling, one-command install on macOS, Linux, and Windows.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("lines-changed"),
    sections: [
      {
        heading: "A live diffstat for your session",
        paragraphs: [
          "Claude Code accumulates `cost.total_lines_added` and `cost.total_lines_removed` across the session and reports both on every render. statusline.sh exposes them as two separate elements — Lines Added and Lines Removed — so you can style and position each one independently.",
          "During a long agentic run this becomes a quiet churn meter: a glance tells you whether the assistant just touched a handful of lines or rewrote half a file, without opening the diff.",
        ],
      },
      {
        heading: "The +green / -red convention",
        paragraphs: [
          "The preview pairs the branch with a bold green `+247` and a bold red `-89`, using a prefix character on each element. Because they are independent elements you are free to break the convention — drop the signs, swap the colors, or show only additions if removals are noise for your workflow.",
          "Both elements render plain integers, so pairing them with a Static separator or a Glyph (for a diff icon) composes cleanly. Add a maxLength if you want to guard against an unusually large count widening the bar.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "In the builder, drag Lines Added and Lines Removed onto the canvas, give each a `+` or `-` prefix and a color, and preview against the mock session data. Install the generated bash or PowerShell command and the counts start rendering on your next Claude Code turn.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-git-branch",
        label: "Add the git branch",
      },
      {
        href: "/claude-code-statusline-cost",
        label: "Add session cost",
      },
    ],
  },
  {
    topic: "context-window",
    path: "/claude-code-statusline-context-window",
    h1: "Claude Code statusline with a context window gauge",
    eyebrow: "Element guide",
    lede: "Turn the Claude Code context window into a fuel gauge in your status line — a bar and percentage showing how full the context is before the next compaction.",
    metaTitle:
      "Claude Code Statusline Context Window Gauge | statusline.sh",
    metaDescription:
      "Show how full the Claude Code context window is as a live bar plus a used/total token ratio. Threshold colors warn before compaction. One-command install.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("context-window"),
    sections: [
      {
        heading: "How full is the window right now?",
        paragraphs: [
          "Every render, Claude Code reports `context_window.used_percentage` and `context_window.remaining_percentage` alongside the raw `total_input_tokens` and `context_window_size`. The context-window gauge reads these to answer one question at a glance: how close is this session to filling up and triggering a compaction?",
          "The preview frames it as a fuel gauge — a 14-cell bar filling left to right, followed by `94.4k/200k (47%)` so you see both the proportion and the absolute headroom in tokens.",
        ],
      },
      {
        heading: "Context window vs token usage",
        paragraphs: [
          "This page is the fuel-gauge view of the same underlying data as the token usage element guide. If you want raw token counters — used, remaining, or a used/total ratio on their own — the token usage page covers those variants in depth. If you mainly want one at-a-glance signal of how full the window is, the bar-plus-percentage layout here is the one to reach for.",
          "Both are powered by the same `contextBar`, `contextPct`, and `contextTokens` elements, so you can mix a gauge on one line with a bare token counter elsewhere in the same design.",
        ],
      },
      {
        heading: "Threshold colors before you hit the cap",
        paragraphs: [
          "Set `colorMode` to `percentage` or `absolute` and the gauge shifts through green, yellow, orange, and red as the window fills, using configurable thresholds. That color shift is the point: it warns you a compaction is coming while you still have room to wrap up the current edit cleanly. Drag the Context Bar and Context Tokens elements from the builder palette to assemble your own gauge.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-token-usage",
        label: "Compare: raw token usage counters",
      },
      {
        href: "/claude-code-statusline-rate-limit",
        label: "Add rate-limit budgets",
      },
    ],
  },
  {
    topic: "output-style",
    path: "/claude-code-statusline-output-style",
    h1: "Claude Code statusline with the output style",
    eyebrow: "Element guide",
    lede: "Surface the active Claude Code output style — explanatory, concise, or your own — in the status line so you always know how the assistant is formatting replies.",
    metaTitle: "Claude Code Statusline with Output Style | statusline.sh",
    metaDescription:
      "Show the active Claude Code output style in your statusline. It auto-hides on the default style or can be pinned always-on. Style it and install in one command.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("output-style"),
    sections: [
      {
        heading: "Know how Claude is formatting replies",
        paragraphs: [
          "Claude Code exposes the current output style as `output_style.name`. Output styles change how the assistant formats its responses — for example an `explanatory` style that teaches as it works, or a terse style tuned for speed — and it is easy to forget you switched. The output style element pins the current mode to the status line so it is always visible.",
        ],
      },
      {
        heading: "Auto-hide on default, or pin it on",
        paragraphs: [
          "By default the element is conditional: it renders nothing while you are on the built-in `default` style, so it only takes up space once you have actually switched to a non-default style. Flip the `alwaysShow` flag if you would rather see the style at all times, including `default`.",
          "That auto-hide is implemented in the compiler as a condition on `output_style.name`, so it costs nothing at render time and behaves identically across the bash, PowerShell, and browser backends.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Drag the Output Style element onto the builder canvas, decide whether it should always show, and give it a color. The preview uses a mock `explanatory` style so you can see exactly how it reads next to the model name before you install.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-thinking-effort",
        label: "Add thinking effort",
      },
      {
        href: "/claude-code-statusline-model",
        label: "Add the model name",
      },
    ],
  },
  {
    topic: "thinking-effort",
    path: "/claude-code-statusline-thinking-effort",
    h1: "Claude Code statusline with thinking effort",
    eyebrow: "Element guide",
    lede: "Show whether extended thinking is on and at what effort level in your Claude Code status line, so you can see when the model is reasoning harder.",
    metaTitle: "Claude Code Statusline with Thinking Effort | statusline.sh",
    metaDescription:
      "Display the Claude Code extended-thinking effort level in your statusline. It only renders when thinking is enabled. Style it and install in one command.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("thinking-effort"),
    sections: [
      {
        heading: "When is the model thinking harder?",
        paragraphs: [
          "Claude Code reports extended thinking as `thinking.enabled` and the current effort as `effort.level`. Higher effort means the model spends more of its budget reasoning before it answers — valuable on hard problems, but worth being aware of because it costs more tokens and time. The thinking effort element makes the current level visible in the status line.",
        ],
      },
      {
        heading: "Only shows when thinking is on",
        paragraphs: [
          "The element is conditional on `thinking.enabled`: when extended thinking is off, it renders nothing and the surrounding statusline collapses around it. When thinking is on, it prints the effort level (for example `high`), so a raised-effort session is obvious at a glance.",
          "The condition is compiled once into the render ops, so the show/hide behavior is identical whether the statusline runs from the bash script, the PowerShell script, or the in-browser preview.",
        ],
      },
      {
        heading: "How to add it",
        paragraphs: [
          "Add the Thinking Effort element in the builder, style it to stand out (the preview uses bold yellow), and pair it with the Output Style element for a compact 'how is Claude configured right now' cluster. Install the generated command and it merges into settings.json without touching your other keys.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-output-style",
        label: "Add the output style",
      },
      {
        href: "/claude-code-statusline-model",
        label: "Add the model name",
      },
    ],
  },
  {
    topic: "nerd-font",
    path: "/claude-code-statusline-nerd-font",
    h1: "Claude Code statusline with Nerd Font icons",
    eyebrow: "Styling guide",
    lede: "Add Nerd Font glyph icons — a folder, a branch, a bolt — to your Claude Code status line for a compact, iconographic terminal bar.",
    metaTitle: "Claude Code Statusline with Nerd Font Icons | statusline.sh",
    metaDescription:
      "Use Nerd Font glyph icons in your Claude Code statusline. Drop folder, branch, and cost icons in front of each segment with the Glyph element. One-command install.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("nerd-font"),
    sections: [
      {
        heading: "What Nerd Fonts add to a statusline",
        paragraphs: [
          "Nerd Fonts are patched programming fonts that pack thousands of extra icon glyphs — from Font Awesome, Devicons, Octicons, and more — into the Unicode Private Use Area. If your terminal is set to a Nerd Font, you can drop those icons straight into your Claude Code statusline to label a segment with a symbol instead of a word: a folder before the directory, a branch before the git branch, a bolt before the cost.",
          "The preview uses a folder glyph (U+F07B), a branch glyph (U+E0A0), and a bolt glyph (U+F0E7). On a machine without a Nerd Font installed they fall back to a placeholder box, so icons are a nice-to-have layer rather than something the rest of the design depends on.",
        ],
      },
      {
        heading: "The Glyph element",
        paragraphs: [
          "statusline.sh models any single character — including a Nerd Font codepoint — as a Glyph element. Paste the glyph into the element's character field, give it its own color, and position it in front of the value it labels. Because each icon is a separate element, you can color the icon and its value independently, or reuse the same glyph across designs.",
          "Glyphs are emitted verbatim by the compiler, so the exact codepoint you pick renders byte-for-byte in the installed bash and PowerShell scripts. Just make sure the terminal you run Claude Code in is configured with a Nerd Font so the icons resolve.",
        ],
      },
      {
        heading: "How to add icons",
        paragraphs: [
          "In the builder, add a Glyph element wherever you want an icon, paste a Nerd Font codepoint, and style it. Pair each glyph with a Directory, Git Branch, or Cost element to build the iconographic bar in the preview. For arrow-style segment separators specifically, see the powerline guide.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-powerline",
        label: "Build a powerline bar",
      },
      {
        href: "/best-claude-code-statusline",
        label: "Compare Claude Code statusline tools",
      },
    ],
  },
  {
    topic: "powerline",
    path: "/claude-code-statusline-powerline",
    h1: "Claude Code powerline statusline",
    eyebrow: "Styling guide",
    lede: "Build a powerline-style Claude Code status line — solid colored segments joined by arrow glyphs — entirely in the visual builder, with no plugin manager or config file.",
    metaTitle: "Claude Code Powerline Statusline | statusline.sh",
    metaDescription:
      "Create a powerline Claude Code statusline with colored segment backgrounds and arrow separators. No plugin manager, no config file — build it visually and install in one command.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("powerline"),
    sections: [
      {
        heading: "What makes a statusline powerline?",
        paragraphs: [
          "The powerline look is a chain of solid, colored segments where each segment's background flows into the next through a filled arrow glyph (U+E0B0). It is the aesthetic popularized by vim-airline and tmux-powerline, and it is a term other Claude Code statusline tools lean on heavily. You can build the same look here without a plugin manager or a YAML config.",
          "The trick is entirely in the styling: give each content element a background color, then place a separator whose foreground matches the segment you are leaving and whose background matches the segment you are entering. That single arrow bridges the two colors so the segments appear to interlock.",
        ],
      },
      {
        heading: "How the preview is built",
        paragraphs: [
          "The preview chains three segments — model on blue, directory on green, git branch on magenta — each padded around its content. Between them sit two arrow separators (`fg` set to the previous background, `bg` to the next), plus a final cap arrow whose foreground is the last segment's color over the default terminal background. Everything is ordinary Glyph, Separator, and background-color styling; there is no special powerline mode to switch on.",
          "Powerline arrows are Nerd Font / powerline glyphs, so the terminal running Claude Code needs a patched font for the arrows to render solid rather than as boxes. See the Nerd Font guide for how glyphs resolve.",
        ],
      },
      {
        heading: "Build your own powerline bar",
        paragraphs: [
          "Open the builder, add your content elements, and set a background color on each from the inspector. Insert a Separator with the arrow glyph between segments, matching its foreground and background to the neighbors. The live preview renders the interlocking colors exactly as your terminal will, and the one-command installer works the same on macOS, Linux, and Windows PowerShell.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/claude-code-statusline-nerd-font",
        label: "Use Nerd Font icons",
      },
      {
        href: "/best-claude-code-statusline",
        label: "Compare powerline statusline tools",
      },
    ],
  },
  {
    topic: "windows",
    path: "/claude-code-statusline-windows",
    h1: "Claude Code statusline on Windows",
    eyebrow: "Platform guide",
    lede: "statusline.sh generates a first-class PowerShell installer, so your Claude Code status line works natively on Windows — no WSL, no bash required.",
    metaTitle: "Claude Code Statusline on Windows (PowerShell) | statusline.sh",
    metaDescription:
      "Install a Claude Code statusline on Windows with one PowerShell command. Native ConvertFrom-Json settings merge, raw UTF-8 output, no WSL or bash required.",
    ctaHref: "/builder",
    ctaLabel: "Open the builder",
    sampleDesign: design("windows"),
    sections: [
      {
        heading: "First-class PowerShell support",
        paragraphs: [
          "Most Claude Code statusline tools assume a bash environment. statusline.sh compiles the same design to a native PowerShell script as well, so Windows users get a real, first-class installer rather than a WSL workaround. The PowerShell backend reads the session JSON with `ConvertFrom-Json` and writes output through `[Console]::Out.Write` to bypass PowerShell's color mangling — it renders byte-for-byte the same statusline the macOS and Linux bash script produces.",
          "Windows PowerShell 5.1 is handled carefully: the generated script is ASCII-only at the source level and emits raw UTF-8 bytes, so glyphs, progress-bar blocks, and box-drawing characters survive the console's OEM code page instead of turning into garbage.",
        ],
      },
      {
        heading: "One-command install",
        paragraphs: [
          "Installing is a single line you paste into PowerShell — an `irm ... | iex` command that downloads and runs the self-contained installer. It embeds the compiled statusline in a single-quoted here-string (so your paths and special characters round-trip untouched) and structurally merges the `statusLine` setting into your Claude Code settings.json with `ConvertFrom-Json`, writing a timestamped backup first. Every other key — model, permissions, MCP servers — is preserved.",
          "There is nothing else to install: no bash, no jq, no Python. The installer relies only on PowerShell, which ships with Windows.",
        ],
      },
      {
        heading: "Design once, install anywhere",
        paragraphs: [
          "Build your statusline in the visual builder and you get both installers from the same design: a bash command for macOS and Linux, and a PowerShell command for Windows. The live preview uses the same interpreter as both backends, so what you see in the browser is what your Windows terminal will render. Switch the OS toggle in the builder to grab the PowerShell command.",
        ],
      },
    ],
    related: [
      { href: "/builder", label: "Open the builder" },
      { href: "/community", label: "Community designs" },
      {
        href: "/how-to-make-a-claude-code-statusline",
        label: "Full guide: how to make a Claude Code statusline",
      },
      {
        href: "/best-claude-code-statusline",
        label: "Compare Claude Code statusline tools",
      },
      {
        href: "/claude-code-statusline-powerline",
        label: "Build a powerline bar",
      },
    ],
  },
];

export function findProgrammaticPage(
  topic: string,
): ProgrammaticPageConfig | undefined {
  return PROGRAMMATIC_PAGES.find((p) => p.topic === topic);
}

export function findProgrammaticPageByPath(
  path: string,
): ProgrammaticPageConfig | undefined {
  return PROGRAMMATIC_PAGES.find((p) => p.path === path);
}
