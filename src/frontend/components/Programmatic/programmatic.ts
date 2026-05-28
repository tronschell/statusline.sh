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
