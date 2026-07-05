/**
 * Data for the "Best Claude Code Statusline Tools (2026)" comparison hub
 * (`/best-claude-code-statusline`).
 *
 * One source of truth shared by three consumers so the comparison never
 * drifts between what users see and what crawlers index:
 *  - `BestStatuslineToolsPage.tsx` renders the table + per-tool prose + FAQ.
 *  - `static-content/staticContent.ts` emits the crawlable prose body.
 *  - `seo.ts` builds the ItemList + FAQPage + Article JSON-LD.
 *
 * Factual-honesty rules for this file: competitor tools are described
 * qualitatively and evergreen. No invented star counts, version numbers,
 * benchmarks, or dated claims. Where a capability is uncertain the copy stays
 * general. statusline.sh is positioned on its genuine differentiator — the
 * only web-based visual builder with a live browser preview and a shareable
 * community gallery — never by disparaging the alternatives, all of which are
 * strong tools for a terminal-first workflow.
 */

/** A single comparison-table cell. `kind` drives the checkmark styling. */
export interface ComparisonCell {
  /** Short display text ("Yes", "—", "npm / npx", …). */
  text: string;
  /** yes = affirmative (green check), no = absent (dim dash), info = neutral text. */
  kind: "yes" | "no" | "info";
}

export interface ToolComparison {
  /** Tool name as written by its authors. */
  name: string;
  /** True only for statusline.sh — highlighted as the differentiated row. */
  isUs?: boolean;
  /** Type column: what the tool is, in a few words. */
  type: string;
  /** Install column: how you set it up, in a few words. */
  install: ComparisonCell;
  /** Web-based visual builder (design in a browser, not a terminal). */
  visualBuilder: ComparisonCell;
  /** Live in-browser terminal preview while you design. */
  browserPreview: ComparisonCell;
  /** Shareable links + a community gallery of designs to fork. */
  gallery: ComparisonCell;
  /** First-class Windows / PowerShell story. */
  windows: ComparisonCell;
  /** Powerline-style segmented rendering. */
  powerline: ComparisonCell;
  /** Surfaces session cost / usage. */
  cost: ComparisonCell;
  /** Honest, evergreen one-paragraph description. */
  blurb: string;
}

const yes = (text = "Yes"): ComparisonCell => ({ text, kind: "yes" });
const no = (text = "—"): ComparisonCell => ({ text, kind: "no" });
const info = (text: string): ComparisonCell => ({ text, kind: "info" });

/**
 * Ordered comparison rows. statusline.sh leads because the page's whole
 * argument is its differentiator; the rest follow in no ranked order.
 */
export const STATUSLINE_TOOLS: ToolComparison[] = [
  {
    name: "statusline.sh",
    isUs: true,
    type: "Web-based visual builder",
    install: info("One command (bash or PowerShell)"),
    visualBuilder: yes(),
    browserPreview: yes(),
    gallery: yes(),
    windows: yes("First-class installer"),
    powerline: info("Custom segments"),
    cost: yes(),
    blurb:
      "statusline.sh is a browser-based visual builder for Claude Code statuslines. You drag elements onto a canvas, style them with ANSI colors, and watch a live terminal preview render the exact bytes your terminal will print — then install with a single bash or PowerShell command. There is no sign-up and nothing to hand-edit: the installer structurally merges the statusLine setting into settings.json and leaves your other keys untouched. Every design is a shareable link, and the community gallery lets you fork someone else's statusline into your own builder. A first-class Windows PowerShell installer ships alongside the bash one, so the same design works on macOS, Linux, and Windows.",
  },
  {
    name: "ccstatusline",
    type: "Interactive CLI configurator",
    install: info("npm / npx"),
    visualBuilder: no(),
    browserPreview: no(),
    gallery: no(),
    windows: info("Runs via Node"),
    powerline: info("Configurable"),
    cost: yes(),
    blurb:
      "ccstatusline is a popular interactive command-line configurator for Claude Code statuslines. You run it in your terminal and step through prompts to assemble and style the line, and it wires the result into your Claude Code settings. If you like staying in the terminal and configuring things through a friendly interactive CLI, it is a well-liked choice.",
  },
  {
    name: "claude-powerline",
    type: "Powerline-style statusline",
    install: info("npm / config"),
    visualBuilder: no(),
    browserPreview: no(),
    gallery: no(),
    windows: info("Runs via Node"),
    powerline: yes(),
    cost: yes(),
    blurb:
      "claude-powerline brings the powerline aesthetic — segmented blocks with arrow separators — to the Claude Code statusline. It is a natural fit if you already run a powerline-style prompt in your shell and want the same segmented look for your Claude Code session.",
  },
  {
    name: "CCometixLine",
    type: "Native (Rust) statusline",
    install: info("Prebuilt binary"),
    visualBuilder: no(),
    browserPreview: no(),
    gallery: no(),
    windows: info("Native build"),
    powerline: info("Segmented"),
    cost: yes(),
    blurb:
      "CCometixLine is a fast, native Claude Code statusline built as a compiled (Rust) binary rather than a script. Its emphasis is performance and a lightweight, segmented line. If you want a native binary with minimal overhead, it is worth a look.",
  },
  {
    name: "ccusage",
    type: "Usage & cost reporting",
    install: info("npm / npx"),
    visualBuilder: no(),
    browserPreview: no(),
    gallery: no(),
    windows: info("Runs via Node"),
    powerline: no(),
    cost: yes("Yes (focus)"),
    blurb:
      "ccusage focuses on Claude Code usage and cost reporting. It is less about styling a decorative statusline and more about surfacing how much you have spent and used, and some setups feed its output into a statusline. Reach for it when cost and usage analytics are the priority.",
  },
];

/** The differentiator sentence, reused across the page, body, and meta copy. */
export const STATUSLINE_DIFFERENTIATOR =
  "statusline.sh is the only one that is a web-based visual builder: you design the status line in your browser, see a live terminal preview, and install with one command — and every design is a shareable link backed by a community gallery. The others are CLI or config-driven tools you set up in a terminal, each a strong pick if that is how you prefer to work.";

export interface BestToolsFaq {
  question: string;
  answer: string;
}

export const BEST_TOOLS_FAQS: BestToolsFaq[] = [
  {
    question: "What is the best Claude Code statusline tool?",
    answer:
      "It depends on how you like to work. statusline.sh is the only web-based visual builder: you design in the browser, see a live preview, and install with one command, and every design is a shareable link. ccstatusline, claude-powerline, CCometixLine, and ccusage are CLI or config-driven tools you set up in a terminal — each a strong choice if you prefer that workflow.",
  },
  {
    question: "Do these Claude Code statusline tools work on Windows?",
    answer:
      "statusline.sh generates a first-class PowerShell installer, so a design works on Windows as well as macOS and Linux. The Node-based tools (ccstatusline, claude-powerline, ccusage) run wherever Node runs, including Windows, while CCometixLine ships as a native binary per platform.",
  },
  {
    question: "Is statusline.sh free, and does it need an account?",
    answer:
      "Yes. statusline.sh is free and needs no sign-up. You can design and preview a status line in the browser and install it with a single command; publishing a design to the community gallery is optional.",
  },
];
