/**
 * Content for the Claude Code statusline guides.
 *
 * ONE source of truth for three consumers:
 *   - the React pages (`GuidePage.tsx`),
 *   - the build-time static HTML shells (`static-content/staticContent.ts`),
 *   - the JSON-LD builders in `seo.ts` (Article, HowTo, FAQPage).
 *
 * Because the FAQ shown on the page, the FAQ in the static HTML, and the
 * FAQPage JSON-LD are all derived from `faqs` below, they cannot drift.
 *
 * Keep this module PURE DATA: no React, no image imports, nothing from
 * `seo.ts` (seo.ts imports this file). `worker/test/seo.test.ts` pulls this in
 * transitively through `build.ts`, so it must stay runnable outside the browser.
 * Images are plain `/guides/*.webp` URLs — `build.ts` copies `src/static/guides`
 * into `dist/guides`, and `src/dev.ts` serves the same folder in development.
 *
 * Inline mini-markup inside any string that says "inline": `code`, **bold**,
 * and [label](/path). See `parseInline`.
 */

export const STATUSLINE_GUIDE_PATH = "/how-to-make-a-claude-code-statusline";
export const COMMAND_GUIDE_PATH = "/claude-code-statusline-command";
export const GUIDE_OG_IMAGE = "/og-guide.png";

/** Official Claude Code statusline documentation (used for field names). */
export const CLAUDE_DOCS_STATUSLINE_URL =
  "https://code.claude.com/docs/en/statusline";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type WidgetId =
  | "dataFlow"
  | "colorGallery"
  | "styleLab"
  | "stdinExplorer";

export interface GuideFigure {
  /** Site-relative URL, e.g. `/guides/foo.webp`. */
  src: string;
  alt: string;
  /** Caption shown under the image. Inline markup allowed. */
  caption: string;
  /** Intrinsic pixel size — emitted as width/height so there is no layout shift. */
  width: number;
  height: number;
  /** Numbered pins drawn over the image. x/y are percentages of the image. */
  marks?: Array<{ n: number; x: number; y: number; label: string }>;
  /** Cap the rendered width on desktop (px). Useful for tall dialog shots. */
  maxWidth?: number;
}

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "code"; label: string; code: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | {
      kind: "steps";
      items: Array<{
        title: string;
        text: string;
        code?: { label: string; code: string };
        figure?: GuideFigure;
      }>;
    }
  | {
      kind: "table";
      caption?: string;
      /** When set, the table sits in a closed <details> with this summary (still in the DOM). */
      collapsible?: string;
      head: string[];
      rows: string[][];
    }
  | {
      kind: "callout";
      tone: "note" | "tip" | "warn";
      title: string;
      text: string;
    }
  | { kind: "figure"; figure: GuideFigure }
  | {
      kind: "links";
      items: Array<{ href: string; title: string; text: string }>;
    }
  | { kind: "widget"; id: WidgetId; caption?: string };

export interface GuideSection {
  /** Anchor id, also used by the sticky table of contents. */
  id: string;
  /** The H2. Plain text. */
  title: string;
  blocks: GuideBlock[];
}

export interface GuideFaq {
  q: string;
  /** Inline markup allowed; JSON-LD uses `stripInline(a)`. */
  a: string;
}

export interface GuideHowTo {
  name: string;
  description: string;
  /** ISO-8601 duration. */
  totalTime: string;
  tools: string[];
  steps: Array<{ name: string; text: string; url?: string }>;
}

export interface GuideRelated {
  href: string;
  title: string;
  text: string;
}

export interface GuidePageData {
  path: string;
  /** `<title>` — keep the whole string under ~60 characters. */
  metaTitle: string;
  /** Meta description — keep under ~155 characters. */
  metaDescription: string;
  /** Short label used in breadcrumbs and "related" cards. */
  breadcrumbName: string;
  eyebrow: string;
  /** The single H1. The React page inserts the Claude Code logo before "Claude Code". */
  h1: string;
  /** Inline markup allowed. */
  lede: string;
  readingMinutes: number;
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  modified: string;
  tldr: { title: string; items: string[] };
  sections: GuideSection[];
  faqs: GuideFaq[];
  howTo?: GuideHowTo;
  related: GuideRelated[];
  cta: { title: string; text: string; label: string };
  /** Hero variant: rotating live templates, or a typed slash-command demo. */
  hero:
    | { kind: "rotate"; templateIds: string[] }
    | { kind: "prompt"; prompt: string; templateId: string };
}

// -----------------------------------------------------------------------------
// Inline mini-markup
// -----------------------------------------------------------------------------

export type InlineToken =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; v: string }
  | { t: "link"; v: string; href: string };

const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(input: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of input.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ t: "text", v: input.slice(last, start) });
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "strong", v: m[2] });
    else out.push({ t: "link", v: m[3] ?? "", href: m[4] ?? "" });
    last = start + m[0].length;
  }
  if (last < input.length) out.push({ t: "text", v: input.slice(last) });
  return out;
}

/** Visible text of an inline string (markup removed). Used for JSON-LD + meta. */
export function stripInline(input: string): string {
  return parseInline(input)
    .map((t) => t.v)
    .join("");
}

// -----------------------------------------------------------------------------
// Shared snippets
// -----------------------------------------------------------------------------

const SETTINGS_JSON = `{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}`;

const MANUAL_SCRIPT = `#!/usr/bin/env bash
# Read the session JSON Claude Code sends on stdin.
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "."')
used=$(echo "$input" | jq -r '.context_window.used_percentage // 0')

# Bold model, plain folder name, dim context percentage.
printf '\\033[1m%s\\033[0m  %s  \\033[2m%.0f%% ctx\\033[0m\\n' "$model" "\${dir##*/}" "$used"`;

const MANUAL_TEST = `chmod +x ~/.claude/statusline.sh
echo '{"model":{"display_name":"Fable 5.1"},"workspace":{"current_dir":"/Users/dev/my-project"},"context_window":{"used_percentage":47.2}}' | ~/.claude/statusline.sh`;

const WINDOWS_SETTINGS_JSON = `{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -File C:/Users/username/.claude/statusline.ps1"
  }
}`;

const INSTALL_COMMANDS = `# macOS and Linux
curl -fsSL https://statusline-community.zoniixyt.workers.dev/i/<design-id>.sh | bash

# Windows (PowerShell)
irm https://statusline-community.zoniixyt.workers.dev/i/<design-id>.ps1 | iex`;

/**
 * Fields a statusline command can read. Drives both the reference table in the
 * guide and the interactive explorer (`path` is looked up in the mock session).
 * Names follow Claude Code's statusline docs; see CLAUDE_DOCS_STATUSLINE_URL.
 */
export const STDIN_FIELDS: Array<{
  path: string;
  holds: string;
  watch: string;
  jq: string;
}> = [
  {
    path: "model.display_name",
    holds: "Human-readable model name.",
    watch: "`model.id` has the machine-readable id.",
    jq: `jq -r '.model.display_name // "Claude"'`,
  },
  {
    path: "workspace.current_dir",
    holds: "Directory Claude Code is working in.",
    watch: "`cwd` holds the same value. `workspace.project_dir` is where it was launched.",
    jq: `jq -r '.workspace.current_dir // .cwd // "."'`,
  },
  {
    path: "workspace.git_worktree",
    holds: "Name of the linked git worktree, when there is one.",
    watch: "This is not the branch. Run `git branch --show-current` for that.",
    jq: `jq -r '.workspace.git_worktree // empty'`,
  },
  {
    path: "cost.total_cost_usd",
    holds: "Estimated session cost in US dollars.",
    watch: "A float. Format it with `printf '%.2f'`.",
    jq: `jq -r '.cost.total_cost_usd // 0'`,
  },
  {
    path: "cost.total_duration_ms",
    holds: "Wall-clock milliseconds since the session started.",
    watch: "Divide by 1000 for seconds.",
    jq: `jq -r '.cost.total_duration_ms // 0'`,
  },
  {
    path: "cost.total_lines_added",
    holds: "Lines of code added this session (`total_lines_removed` for removed).",
    watch: "Integers, zero in a fresh session.",
    jq: `jq -r '.cost.total_lines_added // 0'`,
  },
  {
    path: "context_window.used_percentage",
    holds: "Share of the context window used, 0 to 100.",
    watch: "Can be `null` early in a session. Always give `jq` a default.",
    jq: `jq -r '.context_window.used_percentage // 0'`,
  },
  {
    path: "context_window.context_window_size",
    holds: "Size of the model's context window in tokens.",
    watch: "Pair it with the percentage to show tokens used.",
    jq: `jq -r '.context_window.context_window_size // 0'`,
  },
  {
    path: "rate_limits.five_hour.used_percentage",
    holds: "Percent of the 5-hour rate-limit window used (`seven_day` for the weekly one).",
    watch: "Only present on Pro and Max plans, after the first API response.",
    jq: `jq -r '.rate_limits.five_hour.used_percentage // empty'`,
  },
  {
    path: "effort.level",
    holds: "Current reasoning effort level.",
    watch: "Missing for models without an effort setting.",
    jq: `jq -r '.effort.level // empty'`,
  },
  {
    path: "output_style.name",
    holds: "Name of the active output style.",
    watch: "Default sessions report the default style.",
    jq: `jq -r '.output_style.name // empty'`,
  },
  {
    path: "session_id",
    holds: "Unique id of the session. `version` holds the Claude Code version.",
    watch: "Handy as a cache key for slow lookups.",
    jq: `jq -r '.session_id // empty'`,
  },
];

// -----------------------------------------------------------------------------
// Figures (screenshots of the real app; see src/static/guides)
// -----------------------------------------------------------------------------

const FIG_ELEMENTS: GuideFigure = {
  src: "/guides/claude-code-statusline-builder-elements-drawer.webp",
  alt: "The statusline.sh builder showing the Verbose Dev template: eight element chips on the canvas, a live terminal preview of the statusline above, and the Elements drawer open at the bottom with Identity and Git groups.",
  caption:
    "The builder with the Verbose Dev template loaded. The canvas holds your elements, the terminal frame is the live preview, and the Elements drawer lists everything you can add.",
  width: 2560,
  height: 1600,
  marks: [
    { n: 1, x: 83, y: 29, label: "Canvas: one chip per element. Drag to reorder." },
    { n: 2, x: 83, y: 47, label: "Live preview of the exact terminal output." },
    { n: 3, x: 16, y: 64, label: "Elements drawer: click to add, or drag onto the canvas." },
    { n: 4, x: 90, y: 17, label: "Install in Claude Code opens the install dialog." },
  ],
};

const FIG_INSPECTOR: GuideFigure = {
  src: "/guides/claude-code-statusline-builder-inspector.webp",
  alt: "The statusline.sh builder with the Cost element selected. The Inspector panel on the right shows Content settings (precision, prefix, suffix, max length), Appearance (foreground and background color) and Decorations (bold, italic, dim, underline).",
  caption:
    "Select a chip and the Inspector shows only the controls that element supports. Here the Cost element is selected, and its highlighted value updates in the preview as you change it.",
  width: 2560,
  height: 1600,
  marks: [
    { n: 1, x: 61, y: 35, label: "The selected element on the canvas." },
    { n: 2, x: 72, y: 38, label: "Content: precision, prefix, suffix and max length." },
    { n: 3, x: 72, y: 85, label: "Appearance: foreground and background color." },
    { n: 4, x: 72, y: 94, label: "Decorations: bold, italic, dim and underline." },
  ],
};

const FIG_INSTALL: GuideFigure = {
  src: "/guides/claude-code-statusline-install-dialog.webp",
  alt: "The Install statusline.sh dialog with macOS, Linux and Windows tabs, a copyable curl install command, an Inspect exactly what runs link, a self-heal opt-in checkbox and a What this does list.",
  caption:
    "The install dialog. Pick your operating system, copy the command, and run it in a terminal. (Screenshot from a local build, with the install host shortened for display.)",
  width: 1200,
  height: 1660,
  maxWidth: 520,
  marks: [
    { n: 1, x: 96, y: 42, label: "Tabs for macOS, Linux and Windows." },
    { n: 2, x: 96, y: 50, label: "The one-line install command, with a copy button." },
    { n: 3, x: 96, y: 54, label: "Inspect exactly what runs before you run it." },
    { n: 4, x: 96, y: 59, label: "Self-heal is opt-in and off by default." },
    { n: 5, x: 96, y: 77, label: "A plain-language summary of what the installer changes." },
  ],
};

const FIG_PUBLISH: GuideFigure = {
  src: "/guides/claude-code-statusline-publish-dialog.webp",
  alt: "The Publish to community dialog with Name, Author name and Description fields, a warning that published designs can't be edited or removed, and Export JSON, Cancel and Publish buttons.",
  caption:
    "Publishing is optional. Community designs have no self-service edit or unpublish controls, so use Export JSON first if you want a copy.",
  width: 1072,
  height: 1192,
  maxWidth: 520,
};

const FIG_COMMUNITY: GuideFigure = {
  src: "/guides/claude-code-statusline-community-gallery.webp",
  alt: "The statusline.sh community gallery: a grid of statusline design cards, each with a live terminal preview, author, description and install, fork and view counts, plus filter tabs for Minimal, Powerline, Context, Rate limits, Cost and Multi-line.",
  caption:
    "The community gallery lists designs with a live preview each. (Screenshot from a local build populated with sample designs.)",
  width: 2560,
  height: 1800,
};

// -----------------------------------------------------------------------------
// Pillar: how to make a Claude Code statusline
// -----------------------------------------------------------------------------

const PILLAR: GuidePageData = {
  path: STATUSLINE_GUIDE_PATH,
  metaTitle: "How to Make a Claude Code Statusline | statusline.sh",
  metaDescription:
    "Make a Claude Code statusline three ways: /statusline, a visual builder, or a script. Install steps, JSON fields, Windows setup and fixes for a blank line.",
  breadcrumbName: "How to make a Claude Code statusline",
  eyebrow: "Claude Code guide",
  h1: "How to make a Claude Code statusline.",
  lede: "A Claude Code statusline is a small command that turns your session into the line at the bottom of the terminal. Here is how to make one three ways, how to install it, and how to fix it when it stays blank.",
  readingMinutes: 9,
  published: "2026-09-29",
  modified: "2026-09-29",
  tldr: {
    title: "The 60-second version",
    items: [
      "A statusline is a **command**. Claude Code runs it, pipes the session as JSON to its stdin, and shows whatever it prints to stdout.",
      "Point the `statusLine` key in `~/.claude/settings.json` at your script. That one entry is the whole configuration.",
      "Fastest routes: type `/statusline` and describe what you want, [design one visually](/builder) and run one install command, or [write the script by hand](#by-hand).",
      "Test before you trust it: pipe sample JSON into the script. If the line is blank, check the executable bit, stdout and the exit code.",
    ],
  },
  sections: [
    {
      id: "what-is",
      title: "What a Claude Code statusline actually is",
      blocks: [
        {
          kind: "p",
          text: "Claude Code can show a customizable bar at the bottom of the terminal. Its documentation calls it the **statusline**; many developers search for it as a status line or a status bar. All three names mean the same feature.",
        },
        {
          kind: "p",
          text: "It is not a widget with fixed options. It is a command you configure. Claude Code starts that command, writes the current session as JSON to its standard input, reads what it prints on standard output, and draws the result. Anything a shell script can work out (a git branch, a context budget, a cost estimate) can go on the line.",
        },
        {
          kind: "widget",
          id: "dataFlow",
          caption:
            "The whole contract: session JSON goes in, styled text comes out. Everything in between is your script.",
        },
        {
          kind: "p",
          text: "The command runs locally on your machine, so running it spends no API tokens. Claude Code does not call it constantly; it refreshes after each assistant message and on a few other events ([details below](#refresh)).",
        },
      ],
    },
    {
      id: "ways",
      title: "Three ways to make one",
      blocks: [
        {
          kind: "p",
          text: "Pick by how much control you want and how much you enjoy shell quoting. They all end up as the same thing: a script plus a `statusLine` entry in settings.",
        },
        {
          kind: "table",
          head: ["", "/statusline command", "statusline.sh builder", "Write it by hand"],
          rows: [
            [
              "Effort",
              "One sentence in Claude Code",
              "Point, click, run one command",
              "A script plus a settings edit",
            ],
            [
              "See it before it's live",
              "No: it goes live, then you look",
              "Yes, live preview with mock sessions",
              "Only if you pipe test JSON yourself",
            ],
            [
              "Same result every time",
              "Depends on what the model writes",
              "Yes, generated from your design",
              "Yes, it's your code",
            ],
            [
              "Share or reuse it",
              "Copy the script file",
              "Publish a design, fork others",
              "Copy the script file",
            ],
            [
              "Best for",
              "A quick one-off tweak",
              "Polished, shareable designs",
              "Custom logic: APIs, files, other tools",
            ],
          ],
        },
        {
          kind: "callout",
          tone: "tip",
          title: "Not sure which to pick?",
          text: "Start with the [builder](/builder) to get something good-looking in minutes. Read [the by-hand section](#by-hand) once you want custom logic. Curious how the slash command behaves? See [the /statusline command explained](/claude-code-statusline-command).",
        },
      ],
    },
    {
      id: "build-visually",
      title: "Build one visually in six steps",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Open the builder and pick a starting point",
              text: "Open the [Claude Code statusline builder](/builder). Start from a blank canvas or fork a template such as Minimal, Verbose Dev, Two-Line Cockpit or Powerline. The screenshots below use Verbose Dev.",
            },
            {
              title: "Add elements from the Elements drawer",
              text: "The drawer at the bottom of the canvas groups elements into Identity, Git, Context, Session, Rate limits, Text and Layout. Click one to add it, or drag it onto the canvas. Drag chips left or right to reorder them.",
              figure: FIG_ELEMENTS,
            },
            {
              title: "Style each element in the Inspector",
              text: "Click a chip and the Inspector opens on the right. **Content** controls what is shown (precision, prefix, suffix, max length). **Appearance** sets foreground and background color. **Decorations** toggles bold, italic, dim and underline, and **Visibility** hides an element until a condition is true.",
              figure: FIG_INSPECTOR,
            },
            {
              title: "Check the live preview",
              text: "The terminal frame under the canvas re-renders on every change, using the same interpreter that generates the installed script. Open **Edit mock data** to try a fresh session, a deep one near the context limit, or a folder without git.",
            },
            {
              title: "Install with one command",
              text: "Click **Install in Claude Code**, choose macOS, Linux or Windows, copy the command and run it in a terminal.",
              figure: FIG_INSTALL,
            },
            {
              title: "Optional: save or publish it",
              text: "**Publish** adds the design to the [community gallery](/community) under your name so others can preview and fork it. Community designs have no self-service edit or unpublish controls, so use **Export JSON** first if you want a copy. See the [privacy policy](/privacy) for data-removal requests.",
              figure: FIG_PUBLISH,
            },
          ],
        },
        {
          kind: "callout",
          tone: "note",
          title: "What the bash installer needs",
          text: "To merge your settings, the macOS and Linux installer needs `jq` or Python (`python3` or `python`). The Windows installer uses PowerShell's built-in JSON support.",
        },
      ],
    },
    {
      id: "install",
      title: "What the installer does, and how to check it",
      blocks: [
        {
          kind: "p",
          text: "The generated command downloads a self-contained installer and runs it. You can read it first: the dialog's **Inspect exactly what runs** link shows it, and the same script is served at a plain URL if you would rather download it and run it yourself.",
        },
        {
          kind: "code",
          label: "Install commands (the design id comes from your design)",
          code: INSTALL_COMMANDS,
        },
        {
          kind: "list",
          items: [
            "Writes your statusline script to `~/.claude/statusline.sh` (`statusline.ps1` on Windows).",
            "Saves a timestamped backup of `~/.claude/settings.json` next to it before changing anything.",
            "Merges the `statusLine` entry into the JSON structurally, so every other key (model, permissions, MCP servers) survives.",
            "Points `command` at the script's absolute path.",
          ],
        },
        {
          kind: "callout",
          tone: "warn",
          title: "Read before you pipe",
          text: "Only pipe scripts you trust into a shell. Use **Inspect exactly what runs** and skim the installer first; it takes a minute.",
        },
        {
          kind: "p",
          text: "Claude Code reloads settings when the file changes, so the new line normally appears on your next interaction. The installer still tells you to restart Claude Code, which is the safe fallback if nothing shows up. To remove the statusline, delete the `statusLine` key from your settings (or ask Claude Code to remove it with `/statusline`).",
        },
      ],
    },
    {
      id: "examples",
      title: "Statusline examples to steal from",
      blocks: [
        {
          kind: "p",
          text: "Every line below is rendered live in your browser by the same engine that produces the installed script. These are real ANSI colors from mock session data, not screenshots. Switch the design and the session to watch colors react to context, cost and git state.",
        },
        { kind: "widget", id: "colorGallery" },
        {
          kind: "p",
          text: "The [community gallery](/community) has more designs, each with a live preview and a one-command install. Fork any of them into the builder and change what you don't like.",
        },
        { kind: "figure", figure: FIG_COMMUNITY },
      ],
    },
    {
      id: "cookbook",
      title: "Add one thing at a time",
      blocks: [
        {
          kind: "p",
          text: "Once the basics work, add the pieces you actually glance at during a long session. Each guide has a live preview and the element settings that matter.",
        },
        {
          kind: "links",
          items: [
            {
              href: "/claude-code-statusline-git-branch",
              title: "Git branch",
              text: "Show which branch you are on, with a dirty marker.",
            },
            {
              href: "/claude-code-statusline-token-usage",
              title: "Context and token usage",
              text: "A bar or percentage that changes color as the window fills.",
            },
            {
              href: "/claude-code-statusline-cost",
              title: "Session cost",
              text: "The running dollar cost, at the precision you choose.",
            },
            {
              href: "/claude-code-statusline-model",
              title: "Model name",
              text: "Always know which model is answering.",
            },
            {
              href: "/claude-code-statusline-duration",
              title: "Session duration",
              text: "Elapsed time, human-readable or HH:MM:SS.",
            },
            {
              href: "/claude-code-statusline-rate-limit",
              title: "Rate limits",
              text: "5-hour and 7-day usage for Pro and Max plans.",
            },
          ],
        },
      ],
    },
    {
      id: "by-hand",
      title: "Write one by hand",
      blocks: [
        {
          kind: "p",
          text: "You do not need the builder to make a statusline. You need a script that reads JSON on stdin and prints text. This bash version uses `jq` and shows the model, the folder, and how full the context window is.",
        },
        { kind: "code", label: "~/.claude/statusline.sh", code: MANUAL_SCRIPT },
        {
          kind: "p",
          text: "Make it executable and test it with sample JSON before Claude Code ever runs it. It should print the bold model name, `my-project`, and a dim `47% ctx`. Running it with no piped input just waits for stdin.",
        },
        { kind: "code", label: "Test in a terminal", code: MANUAL_TEST },
        {
          kind: "p",
          text: "Then point Claude Code at it. Back up `~/.claude/settings.json` and merge this entry into it, keeping your other settings.",
        },
        { kind: "code", label: "~/.claude/settings.json", code: SETTINGS_JSON },
        {
          kind: "p",
          text: "Optional keys on `statusLine`: `padding` adds horizontal padding, and `refreshInterval` re-runs the command on a timer (in seconds, minimum 1), which suits clocks or anything that changes between messages. Print several lines and each becomes its own row.",
        },
        {
          kind: "callout",
          tone: "warn",
          title: "Mind the nulls",
          text: "Fields such as `context_window.used_percentage` can be `null` early in a session, and `rate_limits` only exists on Pro and Max plans after the first API response. Give every `jq` read a default (`// 0` or `// empty`) so one missing field can't blank the whole line.",
        },
        {
          kind: "p",
          text: "The hardest part of doing this by hand is the escape codes. Try them here: toggle a style or pick a color and the generated sequence updates underneath.",
        },
        { kind: "widget", id: "styleLab" },
      ],
    },
    {
      id: "stdin-fields",
      title: "The JSON Claude Code sends your script",
      blocks: [
        {
          kind: "p",
          text: "Every run receives one JSON object on stdin. Pick a field to see a realistic value and the `jq` expression that reads it, then switch the session to watch the values change.",
        },
        { kind: "widget", id: "stdinExplorer" },
        {
          kind: "table",
          caption: "Fields you will reach for most",
          collapsible: "Show every field as a table",
          head: ["Field", "What it holds", "Watch out for"],
          rows: STDIN_FIELDS.map((f) => [`\`${f.path}\``, f.holds, f.watch]),
        },
        {
          kind: "p",
          text: `This is a subset. Claude Code adds fields over time, so check the [official statusline documentation](${CLAUDE_DOCS_STATUSLINE_URL}) for the full current list.`,
        },
      ],
    },
    {
      id: "refresh",
      title: "When the statusline refreshes",
      blocks: [
        {
          kind: "p",
          text: "Claude Code re-runs your command when something worth showing has changed:",
        },
        {
          kind: "list",
          items: [
            "After each new assistant message, and after `/compact`.",
            "When the permission mode changes or vim mode is toggled.",
            "When the `command` in your settings changes.",
            "On a timer, if you set `refreshInterval`.",
            "When a rate-limit window resets or the prompt cache expires.",
          ],
        },
        {
          kind: "p",
          text: "Updates are debounced by roughly 300 ms, and a run still in flight is cancelled when a newer update starts. Keep the script fast, and cache anything slow such as a network call. Claude Code notifications share the row, so a very long line can get truncated.",
        },
      ],
    },
    {
      id: "windows",
      title: "Windows: Git Bash or PowerShell",
      blocks: [
        {
          kind: "p",
          text: "On Windows, Claude Code runs the statusline command through Git Bash when it is installed and PowerShell otherwise. Use forward slashes in the `command` path; `~` works too.",
        },
        {
          kind: "code",
          label: "settings.json on Windows (PowerShell script)",
          code: WINDOWS_SETTINGS_JSON,
        },
        {
          kind: "p",
          text: "The easy route is the builder's **Windows** tab: it writes a PowerShell script and the matching settings entry for you with `irm … | iex`, and keeps the rest of your settings intact.",
        },
      ],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting a blank or broken statusline",
      blocks: [
        {
          kind: "table",
          head: ["Symptom", "Likely cause", "Fix"],
          rows: [
            [
              "Nothing appears",
              "No `statusLine` entry in the settings file Claude Code reads, or the workspace is not trusted.",
              "Check `~/.claude/settings.json`. Accept the workspace trust prompt. Settings such as `disableAllHooks` also switch the statusline off.",
            ],
            [
              "The line is blank",
              "The script printed nothing, or exited with a non-zero code.",
              "Run it with sample JSON and check `echo $?`. Print to stdout, not stderr.",
            ],
            [
              "Permission denied",
              "The script is not executable.",
              "`chmod +x ~/.claude/statusline.sh`",
            ],
            [
              "It shows `null` or a wrong `0%`",
              "The field was `null` early in the session.",
              "Give the `jq` read a default such as `// 0`.",
            ],
            [
              "Raw text like `\\033[1m` appears",
              "Escape codes were printed literally.",
              "Print with `printf` (or `echo -e`) so the escapes are interpreted.",
            ],
            [
              "It works in your shell but not in Claude Code",
              "Different PATH or environment, for example `jq` not found.",
              "Use absolute paths. Run `claude --debug` to see the command's stderr.",
            ],
            [
              "The line is cut off",
              "A notification shares the row, or the terminal is narrow.",
              "Shorten the line, or print a second row.",
            ],
          ],
        },
        {
          kind: "callout",
          tone: "tip",
          title: "Still stuck?",
          text: "Rebuild the same design in the [visual builder](/builder). The preview shows exactly what the script should print, which tells you whether the problem is your data or your script.",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "Is it called a statusline, a status line or a status bar?",
      a: "Claude Code's documentation says statusline. Developers also search for status line and status bar. They all describe the same feature: the customizable line at the bottom of the Claude Code terminal.",
    },
    {
      q: "How do I set up a Claude Code statusline?",
      a: "Add a `statusLine` entry of type `command` to `~/.claude/settings.json` that points at a script. You can write the script yourself, ask Claude Code to write it with `/statusline`, or design one in the [statusline.sh builder](/builder) and run its one-line install command.",
    },
    {
      q: "Does a statusline use tokens or cost money?",
      a: "Running one does not. The command executes locally on your machine and never calls the API. Asking Claude Code to write one with `/statusline` is an ordinary request, so that step uses tokens like any other prompt.",
    },
    {
      q: "Where is the statusline configured?",
      a: "In `settings.json` under the `statusLine` key. `~/.claude/settings.json` applies to all your projects. The value is an object with `type` set to `command` and a `command` that is a script path or an inline command.",
    },
    {
      q: "Does it work on Windows?",
      a: "Yes. Claude Code runs the command through Git Bash when it is installed and PowerShell otherwise. The builder's Windows tab installs a PowerShell script and the matching settings entry for you.",
    },
    {
      q: "Why is my statusline blank?",
      a: "Usually the script printed nothing, exited with an error, or is not executable. Pipe sample JSON into it, check the exit code, run `chmod +x`, and give every `jq` read a default. The troubleshooting table above covers the rest.",
    },
    {
      q: "How often does the statusline update?",
      a: "After each assistant message and a handful of other events, debounced by roughly 300 ms. Set `refreshInterval` if you also want it to re-run on a timer.",
    },
    {
      q: "Can I share or reuse a statusline?",
      a: "Yes. Publish a design from the builder to the [community gallery](/community), where anyone can preview it, install it or fork it. You can also copy your script file to another machine.",
    },
  ],
  howTo: {
    name: "How to make a Claude Code statusline",
    description:
      "Design, preview and install a Claude Code statusline with the statusline.sh builder.",
    totalTime: "PT5M",
    tools: ["Claude Code", "statusline.sh"],
    steps: [
      {
        name: "Open the builder",
        text: "Open the statusline.sh builder and start from a blank canvas or a template.",
        url: "/builder",
      },
      {
        name: "Add elements",
        text: "Open the Elements drawer and add session fields such as model, working directory, git branch, context usage, cost and duration.",
      },
      {
        name: "Style each element",
        text: "Select a chip and use the Inspector to set content, foreground and background color, and decorations.",
      },
      {
        name: "Check the live preview",
        text: "Compare the terminal preview against fresh and deep mock sessions before changing your settings.",
      },
      {
        name: "Install it",
        text: "Click Install in Claude Code, copy the command for your operating system and run it. It writes the script and merges the statusLine entry into settings.json.",
      },
    ],
  },
  related: [
    {
      href: COMMAND_GUIDE_PATH,
      title: "The /statusline command",
      text: "What Claude Code's built-in command writes, and when to skip it.",
    },
    {
      href: "/community",
      title: "Community designs",
      text: "Live previews you can install or fork.",
    },
    {
      href: "/claude-code-statusline-token-usage",
      title: "Show context usage",
      text: "A bar that warns before you hit the limit.",
    },
    {
      href: "/claude-code-statusline-git-branch",
      title: "Show the git branch",
      text: "Branch name plus a dirty marker.",
    },
  ],
  cta: {
    title: "Make yours in about five minutes.",
    text: "Start from a template or a blank canvas, watch the preview update as you go, and install with one command.",
    label: "Open the Claude Code statusline builder",
  },
  hero: {
    kind: "rotate",
    templateIds: ["verbose-dev", "two-line-cockpit", "powerline", "neon-pulse"],
  },
};

// -----------------------------------------------------------------------------
// Sub-page: the /statusline command
// -----------------------------------------------------------------------------

const COMMAND: GuidePageData = {
  path: COMMAND_GUIDE_PATH,
  metaTitle: "Claude Code /statusline Command Guide | statusline.sh",
  metaDescription:
    "What the Claude Code /statusline command does, where it saves statusline-command.sh, example prompts, how to edit or remove it, and when to use a builder.",
  breadcrumbName: "The /statusline command",
  eyebrow: "Claude Code guide",
  h1: "The Claude Code /statusline command.",
  lede: "Type `/statusline` in Claude Code, describe the bar you want, and Claude writes the script and the settings for you. Here is what it does, what it leaves on disk, and where it stops being the fastest option.",
  readingMinutes: 5,
  published: "2026-09-29",
  modified: "2026-09-29",
  tldr: {
    title: "The short version",
    items: [
      "`/statusline` is a built-in Claude Code slash command. Give it a plain-English description, for example `/statusline show model name and context percentage with a progress bar`.",
      "Claude Code writes a script into `~/.claude/` (often called `statusline-command.sh`) and adds a `statusLine` entry to your settings.",
      "It is quick, but the result is not previewed first and can vary between runs. To design something precise, see it before it goes live and share it, use the [visual builder](/builder).",
    ],
  },
  sections: [
    {
      id: "what-it-does",
      title: "What /statusline does",
      blocks: [
        {
          kind: "p",
          text: "`/statusline` asks Claude to set up your statusline for you. You describe what you want in ordinary language. Claude writes a shell script that reads the session JSON and prints your line, then updates your settings so Claude Code runs it.",
        },
        {
          kind: "steps",
          items: [
            {
              title: "Type the command and describe the bar",
              text: "Say which data you want and how it should look.",
              code: {
                label: "In Claude Code",
                code: "/statusline show model name and context percentage with a progress bar",
              },
            },
            {
              title: "Let Claude write the script",
              text: "Claude creates a script in `~/.claude/`, commonly named `statusline-command.sh`, and points the `statusLine` setting at it.",
            },
            {
              title: "Look at the result",
              text: "Claude Code reloads settings when they change, so the line usually shows up on your next message. If it doesn't, restart Claude Code.",
            },
            {
              title: "Ask for changes in plain language",
              text: "Run `/statusline` again, or tell Claude what to adjust, such as making the context percentage turn red above 80.",
            },
          ],
        },
      ],
    },
    {
      id: "prompts",
      title: "Prompts that work well",
      blocks: [
        {
          kind: "p",
          text: "Be specific about the data and the formatting. The script can only use fields Claude Code actually sends, so name them in Claude Code's own terms: model, context window, cost, git branch, rate limits.",
        },
        {
          kind: "table",
          head: ["You want", "Try saying"],
          rows: [
            [
              "Model and context",
              "`/statusline show the model name and a context usage progress bar`",
            ],
            [
              "Git and cost",
              "`/statusline show git branch, session cost and duration on one line`",
            ],
            [
              "Two rows",
              "`/statusline two lines: model and folder on top, context bar and cost below`",
            ],
            [
              "Warning colors",
              "`/statusline turn the context bar red above 80 percent`",
            ],
            [
              "Your shell prompt",
              "`/statusline convert my shell prompt (PS1) into a statusline`",
            ],
          ],
        },
        {
          kind: "callout",
          tone: "tip",
          title: "Know what data exists",
          text: "The [list of JSON fields a statusline can read](/how-to-make-a-claude-code-statusline#stdin-fields) tells you what is possible before you ask for it.",
        },
      ],
    },
    {
      id: "where-it-lives",
      title: "What it leaves on your machine",
      blocks: [
        {
          kind: "list",
          items: [
            "A script in `~/.claude/`, commonly `statusline-command.sh`. It is ordinary shell: open it, read it, edit it.",
            "A `statusLine` entry in your settings that points at that script.",
          ],
        },
        {
          kind: "code",
          label: "The settings entry (path will match your script)",
          code: `{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline-command.sh"
  }
}`,
        },
        {
          kind: "p",
          text: "To remove it, run `/statusline` and ask Claude to remove it, or delete the `statusLine` entry from your settings yourself. Because it is a plain script, everything in the [main guide](/how-to-make-a-claude-code-statusline) applies to it: testing with sample JSON, `jq` defaults, and the troubleshooting table.",
        },
      ],
    },
    {
      id: "limits",
      title: "Where /statusline falls short",
      blocks: [
        {
          kind: "list",
          items: [
            "**No preview.** The line goes live, then you look. Getting a color or spacing right can take several rounds of asking.",
            "**Not repeatable.** The model writes new code each time, so the same prompt can produce different scripts.",
            "**Hard to share.** The result is a script on your disk. There is no design to publish or fork.",
            "**You own the script.** If a field changes or the script breaks, you are the one debugging shell code.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          title: "When to use which",
          text: "Use `/statusline` for a quick one-off tweak. Use the [visual builder](/builder) when you want to see the result first, tune colors precisely, reuse the design on another machine, or start from a [community example](/community).",
        },
      ],
    },
    {
      id: "troubleshoot",
      title: "If /statusline didn't work",
      blocks: [
        {
          kind: "list",
          items: [
            "**Nothing appears:** open your settings and confirm a `statusLine` entry exists, then restart Claude Code.",
            "**The line is blank:** run the generated script with sample JSON piped in and check its exit code.",
            "**Permission denied:** make the script executable with `chmod +x`.",
          ],
        },
        {
          kind: "p",
          text: "The [troubleshooting table in the main guide](/how-to-make-a-claude-code-statusline#troubleshooting) covers these and more.",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "What does the /statusline command do in Claude Code?",
      a: "It asks Claude to build your statusline from a plain-English description. Claude writes a script into `~/.claude/` and adds a `statusLine` entry to your settings so Claude Code runs it.",
    },
    {
      q: "Where does /statusline save statusline-command.sh?",
      a: "Claude Code writes the script into `~/.claude/`. The file is commonly named `statusline-command.sh`, and the `statusLine` entry in your settings points at it. Open your settings to see the exact path on your machine.",
    },
    {
      q: "Does /statusline use tokens?",
      a: "Asking Claude to write the script is a normal request, so it uses tokens like any other prompt. Once the script exists, running it costs nothing because it is a local command.",
    },
    {
      q: "How do I remove a statusline made with /statusline?",
      a: "Run `/statusline` and ask Claude to remove it, or delete the `statusLine` entry from your settings. You can delete the script file too, although nothing runs it once the entry is gone.",
    },
    {
      q: "Can I edit the generated statusline-command.sh?",
      a: "Yes. It is a plain script. Edit it, test it by piping sample JSON into it, and Claude Code will run the new version on its next refresh.",
    },
    {
      q: "Is the builder better than /statusline?",
      a: "They suit different jobs. `/statusline` is fastest for a quick change. The [statusline.sh builder](/builder) adds a live preview, repeatable output, Windows support and shareable designs.",
    },
  ],
  related: [
    {
      href: STATUSLINE_GUIDE_PATH,
      title: "How to make a Claude Code statusline",
      text: "All three approaches, JSON fields and troubleshooting.",
    },
    {
      href: "/builder",
      title: "Open the builder",
      text: "See the result before it goes live.",
    },
    {
      href: "/community",
      title: "Community designs",
      text: "Start from a design someone already tuned.",
    },
    {
      href: "/claude-code-statusline-cost",
      title: "Show session cost",
      text: "Add a running dollar cost to the line.",
    },
  ],
  cta: {
    title: "Want to see it before it goes live?",
    text: "The builder previews every change in a terminal frame and installs with one command.",
    label: "Open the Claude Code statusline builder",
  },
  hero: {
    kind: "prompt",
    prompt: "/statusline show model name and context percentage with a progress bar",
    templateId: "context-watch",
  },
};

export const GUIDE_PAGES: GuidePageData[] = [PILLAR, COMMAND];

/** "2026-09-29" -> "September 29, 2026" (timezone-independent). */
/** Callout titles read as the first words of the paragraph; add a full stop unless one is there. */
export function calloutLead(title: string): string {
  return /[.?!:]$/.test(title) ? title : `${title}.`;
}

export function formatGuideDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function guideByPath(path: string): GuidePageData | undefined {
  return GUIDE_PAGES.find((page) => page.path === path);
}

/** Every figure in a page, in reading order (used for image alt/size tests). */
export function figuresOf(page: GuidePageData): GuideFigure[] {
  const out: GuideFigure[] = [];
  for (const section of page.sections) {
    for (const block of section.blocks) {
      if (block.kind === "figure") out.push(block.figure);
      if (block.kind === "steps") {
        for (const step of block.items) if (step.figure) out.push(step.figure);
      }
    }
  }
  return out;
}
