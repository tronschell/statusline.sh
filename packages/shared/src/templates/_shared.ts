import type { AnsiStyle, Element } from "../types";

// Shared helpers for the per-template files in this directory.
//
// Stable element IDs are intentional: templates are referenced by element id
// within their own design, but tests assert that re-running validation works,
// so collisions across templates do not matter — only within one design.

/** Identity helper that exists purely to annotate inline style literals. */
export const s = (style: AnsiStyle): AnsiStyle => style;

/** Identity helper that preserves each element's precise literal type. */
export function el<T extends Element>(e: T): T {
  return e;
}
