import { describe, expect, test } from "bun:test";
import type { Element } from "@statusline/shared/types";
import {
  describeDesignSentence,
  describeElements,
} from "../src/frontend/lib/describeElements";

// Tiny factory that builds a minimally-valid Element of the requested type by
// stamping required type-specific fields onto a base. We cast through unknown
// so the tests stay readable — the helper purposely doesn't care about the
// rest of the element shape.
function makeEl<T extends Element["type"]>(
  type: T,
  extras: Record<string, unknown> = {},
): Element {
  return {
    id: `e-${type}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    style: {},
    ...extras,
  } as unknown as Element;
}

describe("describeElements", () => {
  test("returns user-facing labels for distinct content element types", () => {
    const labels = describeElements([
      makeEl("model"),
      makeEl("cwd", { mode: "basename" }),
      makeEl("gitBranch"),
      makeEl("contextBar", { width: 10, filledChar: "#", emptyChar: "-" }),
      makeEl("cost", { precision: 2 }),
    ]);
    expect(labels).toEqual([
      "model",
      "current directory",
      "git branch",
      "context usage bar",
      "session cost",
    ]);
  });

  test("dedupes element types and preserves first-appearance order", () => {
    const labels = describeElements([
      makeEl("cwd", { mode: "basename" }),
      makeEl("model"),
      makeEl("cwd", { mode: "full" }),
      makeEl("model"),
    ]);
    expect(labels).toEqual(["current directory", "model"]);
  });

  test("filters out chrome-only types (spacer, separator, static, glyph, lineBreak)", () => {
    const labels = describeElements([
      makeEl("static", { text: "hi" }),
      makeEl("model"),
      makeEl("separator", { text: " | " }),
      makeEl("glyph", { char: ">" }),
      makeEl("lineBreak"),
      makeEl("spacer", { mode: "flex" }),
      makeEl("gitBranch"),
    ]);
    expect(labels).toEqual(["model", "git branch"]);
  });

  test("returns empty array for empty design", () => {
    expect(describeElements([])).toEqual([]);
  });

  test("returns empty array when only chrome elements present", () => {
    const labels = describeElements([
      makeEl("separator", { text: "·" }),
      makeEl("spacer", { mode: "fixed", width: 2 }),
    ]);
    expect(labels).toEqual([]);
  });
});

describe("describeDesignSentence", () => {
  test("formats a single element with 'shows the X'", () => {
    const sentence = describeDesignSentence({
      version: 1,
      name: "x",
      elements: [makeEl("model")],
    });
    expect(sentence).toBe("This statusline shows the model.");
  });

  test("formats multiple elements with an Oxford-style and", () => {
    const sentence = describeDesignSentence({
      version: 1,
      name: "x",
      elements: [
        makeEl("model"),
        makeEl("gitBranch"),
        makeEl("cost", { precision: 2 }),
      ],
    });
    expect(sentence).toBe(
      "This statusline shows the model, git branch, and session cost.",
    );
  });

  test("returns empty string for chrome-only design", () => {
    const sentence = describeDesignSentence({
      version: 1,
      name: "x",
      elements: [makeEl("lineBreak")],
    });
    expect(sentence).toBe("");
  });
});
