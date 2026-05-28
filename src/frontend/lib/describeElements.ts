import type { Design, Element, ElementType } from "@statusline/shared/types";

/**
 * Human-readable labels for each element type. Used by the community detail
 * page to render a crawlable "what's in this design" list — putting Claude
 * Code statusline keyword variants into the page body.
 *
 * Keep these short, noun-phrase, sentence-case ("git branch", not "Git Branch"
 * or "git_branch"). They flow into prose like:
 *
 *   "This statusline contains: model, current directory, git branch."
 */
const LABELS: Record<ElementType, string> = {
  static: "static text",
  model: "model",
  cwd: "current directory",
  thinkingEffort: "thinking effort",
  outputStyle: "output style",
  fastMode: "fast mode indicator",
  gitBranch: "git branch",
  gitStatus: "git dirty/clean status",
  linesAdded: "lines added",
  linesRemoved: "lines removed",
  contextPct: "context percentage",
  contextBar: "context usage bar",
  contextTokens: "context token count",
  rateLimit5h: "5-hour rate limit",
  rateLimit7d: "7-day rate limit",
  cost: "session cost",
  sessionDuration: "session duration",
  glyph: "glyph",
  separator: "separator",
  rotator: "rotating text",
  segmentSplit: "segmented field",
  lineBreak: "line break",
  spacer: "spacer",
};

/**
 * Returns the distinct, user-facing element labels for a design in stable order
 * (first appearance wins). Filters out chrome-only elements (spacers, line
 * breaks, separators, static text, glyphs) because those describe layout, not
 * content — and the breakdown is meant to summarize what the statusline shows.
 *
 * Returns an empty array for an empty design so callers can decide whether to
 * render the section at all.
 */
export function describeElements(elements: ReadonlyArray<Element>): string[] {
  const CHROME_ONLY: ReadonlySet<ElementType> = new Set<ElementType>([
    "spacer",
    "lineBreak",
    "separator",
    "static",
    "glyph",
  ]);

  const seen = new Set<ElementType>();
  const out: string[] = [];
  for (const el of elements) {
    if (seen.has(el.type)) continue;
    seen.add(el.type);
    if (CHROME_ONLY.has(el.type)) continue;
    const label = LABELS[el.type];
    if (label) out.push(label);
  }
  return out;
}

/**
 * Builds a single human-readable sentence describing the design's elements.
 * Returns an empty string if there's nothing notable to mention.
 */
export function describeDesignSentence(design: Design): string {
  const labels = describeElements(design.elements);
  if (labels.length === 0) return "";
  if (labels.length === 1) return `This statusline shows the ${labels[0]}.`;
  const head = labels.slice(0, -1).join(", ");
  const tail = labels[labels.length - 1];
  return `This statusline shows the ${head}, and ${tail}.`;
}
