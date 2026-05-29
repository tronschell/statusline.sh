import type { Design, Element } from "@statusline/shared/types";

/**
 * Spacing the builder can auto-insert between two adjacent content elements
 * when the user adds a new one. `none` is the historical (no-op) behaviour and
 * stays the default so existing flows are unchanged until the user opts in via
 * the setup prompt.
 *
 * - `spacer`    — inserts a standalone fixed-width spacer element.
 * - `separator` — inserts a standalone separator element (a glyph).
 * - `padding`   — no extra element; appends a trailing space to the preceding
 *                 element's `suffix`, the way the built-in templates space
 *                 items apart.
 */
export type AutoInsertMode = "none" | "spacer" | "separator" | "padding";

export interface SeparatorOption {
  /** Stable id used as the <select> option value. */
  id: string;
  /** Human label shown in the dropdown. */
  label: string;
  /** The literal text the separator element renders (spaces included). */
  text: string;
}

/**
 * Suggested separators surfaced as a dropdown in the setup prompt. These are
 * just convenient presets — the user can always type a custom string. Each
 * `text` deliberately includes its own surrounding spaces so the separator
 * reads well when dropped straight between two elements.
 */
export const SEPARATOR_OPTIONS: ReadonlyArray<SeparatorOption> = [
  { id: "pipe", label: "Pipe", text: " | " },
  { id: "dot", label: "Middle dot", text: " · " },
  { id: "bullet", label: "Bullet", text: " • " },
  { id: "slash", label: "Slash", text: " / " },
  { id: "chevron", label: "Chevron", text: " › " },
  { id: "arrow", label: "Arrow", text: " → " },
  { id: "dash", label: "Em dash", text: " — " },
  { id: "colon", label: "Colon", text: " : " },
  { id: "tilde", label: "Tilde", text: " ~ " },
  { id: "powerline", label: "Powerline", text: " ▶ " },
];

export const DEFAULT_SEPARATOR_TEXT = " | ";
export const DEFAULT_SPACER_WIDTH = 2;
export const DEFAULT_SPACER_CHAR = " ";

/** Find the preset whose text matches `text` exactly, if any. */
export function separatorOptionForText(text: string): SeparatorOption | null {
  return SEPARATOR_OPTIONS.find((o) => o.text === text) ?? null;
}

export interface SeparatorUsage {
  /** How many `separator` elements the design contains. */
  count: number;
  /** Distinct separator texts, most-frequent first. */
  distinctTexts: string[];
  /** The most common separator text, or null when there are none. */
  dominant: string | null;
  /** A matching preset for the dominant text, if it maps cleanly to one. */
  dominantOption: SeparatorOption | null;
}

/**
 * Inspect a design's `separator` elements so the setup prompt can tell the
 * user "this template separates items with ` · ` (4 of them)" and offer to
 * mass-change them. Pure — safe to unit-test and call during render.
 */
export function analyzeSeparators(design: Design): SeparatorUsage {
  const counts = new Map<string, number>();
  for (const el of design.elements) {
    if (el.type !== "separator") continue;
    counts.set(el.text, (counts.get(el.text) ?? 0) + 1);
  }

  let count = 0;
  for (const n of counts.values()) count += n;

  const distinctTexts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([text]) => text);
  const dominant = distinctTexts[0] ?? null;

  return {
    count,
    distinctTexts,
    dominant,
    dominantOption: dominant !== null ? separatorOptionForText(dominant) : null,
  };
}

/** Render a short, human-readable label for a separator text (spaces shown). */
export function describeSeparatorText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "(blank)";
  const option = separatorOptionForText(text);
  return option ? `${option.label} (${trimmed})` : trimmed;
}

/**
 * The element a content-element insert should be preceded by, given the
 * current auto-insert configuration. Returns the element body WITHOUT an id
 * (the store assigns one) or null when the mode is `none`.
 */
export type AutoInsertElementBody =
  | { type: "separator"; text: string; style: Record<string, never> }
  | {
      type: "spacer";
      mode: "fixed";
      width: number;
      char: string;
      style: Record<string, never>;
    };

export interface AutoInsertConfig {
  autoInsert: AutoInsertMode;
  autoSeparatorText: string;
  autoSpacerWidth: number;
  autoSpacerChar: string;
}

export function autoInsertElementBody(
  cfg: AutoInsertConfig,
): AutoInsertElementBody | null {
  if (cfg.autoInsert === "separator") {
    return { type: "separator", text: cfg.autoSeparatorText, style: {} };
  }
  if (cfg.autoInsert === "spacer") {
    const width = Math.max(1, Math.min(8, Math.round(cfg.autoSpacerWidth)));
    const char =
      cfg.autoSpacerChar.length > 0 ? cfg.autoSpacerChar.slice(0, 1) : " ";
    return { type: "spacer", mode: "fixed", width, char, style: {} };
  }
  return null;
}

/**
 * Whether an element type counts as "content" for auto-spacing purposes.
 * Structural / whitespace elements never get a separator placed before them,
 * and we never separate *before* one either.
 */
export function isContentElementType(type: Element["type"]): boolean {
  return type !== "separator" && type !== "spacer" && type !== "lineBreak";
}

/**
 * Padding-mode helper: return a clone of `el` whose `suffix` ends in a single
 * space, matching how the built-in templates space items (e.g. `suffix: " "`).
 * No-op (returns the same object) when the suffix already ends in whitespace,
 * so repeated adds never stack up multiple spaces.
 */
export function withPaddedSuffix(el: Element): Element {
  const suffix = el.suffix ?? "";
  if (/\s$/.test(suffix)) return el;
  return { ...el, suffix: suffix + " " } as Element;
}

/**
 * Strip the *gap* whitespace a template used for spacing without touching
 * meaningful affixes: trim leading whitespace off `prefix` and trailing
 * whitespace off `suffix`. So `suffix: " "` disappears, `suffix: "] "` becomes
 * `"]"`, and `prefix: "+"` is left alone. Empty results drop the field.
 */
function trimSpacingPadding(el: Element): Element {
  const { prefix, suffix } = el;
  const newPrefix = typeof prefix === "string" ? prefix.replace(/^\s+/, "") : prefix;
  const newSuffix = typeof suffix === "string" ? suffix.replace(/\s+$/, "") : suffix;
  if (newPrefix === prefix && newSuffix === suffix) return el;
  const next = { ...el } as Element & { prefix?: string; suffix?: string };
  if (newPrefix) next.prefix = newPrefix;
  else delete next.prefix;
  if (newSuffix) next.suffix = newSuffix;
  else delete next.suffix;
  return next;
}

/**
 * Normalize a design's spacing to a single scheme: remove the template's own
 * spacing (standalone separator elements + fixed spacers + padding spaces on
 * affixes) and re-apply `cfg`'s chosen spacing uniformly between adjacent
 * content elements. Flex spacers and line breaks are preserved (they're layout,
 * not inter-item spacing) and spacing is never added across them. `makeId`
 * supplies ids for any inserted separator/spacer elements.
 *
 * Pure — the store wraps this in one undo step; tests call it directly.
 */
export function respaceElements(
  elements: ReadonlyArray<Element>,
  cfg: AutoInsertConfig,
  makeId: () => string,
): Element[] {
  const stripped = elements
    .filter(
      (el) =>
        el.type !== "separator" && !(el.type === "spacer" && el.mode === "fixed"),
    )
    .map(trimSpacingPadding);

  const result: Element[] = [];
  for (const el of stripped) {
    const prev = result[result.length - 1];
    if (
      prev !== undefined &&
      isContentElementType(prev.type) &&
      isContentElementType(el.type)
    ) {
      if (cfg.autoInsert === "padding") {
        result[result.length - 1] = withPaddedSuffix(prev);
      } else {
        const body = autoInsertElementBody(cfg);
        if (body) result.push({ id: makeId(), ...body } as Element);
      }
    }
    result.push(el);
  }
  return result;
}

/**
 * Best-effort description of how a design currently spaces its items, for the
 * "this template uses X" copy in the setup prompt.
 */
export function detectSpacingStyle(design: Design): {
  kind: "separator" | "padding" | "spacer" | "none";
  label: string;
} {
  const usage = analyzeSeparators(design);
  if (usage.count > 0) {
    return {
      kind: "separator",
      label: `separators (${describeSeparatorText(usage.dominant ?? "")})`,
    };
  }
  const hasPadding = design.elements.some(
    (e) =>
      isContentElementType(e.type) &&
      (/\s$/.test(e.suffix ?? "") || /^\s/.test(e.prefix ?? "")),
  );
  if (hasPadding) return { kind: "padding", label: "trailing/leading spaces" };
  const hasFixedSpacer = design.elements.some(
    (e) => e.type === "spacer" && e.mode === "fixed",
  );
  if (hasFixedSpacer) return { kind: "spacer", label: "fixed spacer gaps" };
  return { kind: "none", label: "no extra spacing" };
}
