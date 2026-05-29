import { describe, expect, test } from "bun:test";
import type { Design, Element } from "@statusline/shared/types";
import {
  SEPARATOR_OPTIONS,
  analyzeSeparators,
  autoInsertElementBody,
  describeSeparatorText,
  detectSpacingStyle,
  isContentElementType,
  respaceElements,
  separatorOptionForText,
} from "../src/frontend/lib/separators";

function mkId() {
  let n = 0;
  return () => `x${n++}`;
}

const SEP_CFG = {
  autoInsert: "separator" as const,
  autoSeparatorText: " | ",
  autoSpacerWidth: 2,
  autoSpacerChar: " ",
};

function designWith(...separators: string[]): Design {
  return {
    version: 1,
    name: "t",
    elements: [
      { id: "m", type: "model", style: {} },
      ...separators.map((text, i) => ({
        id: `s${i}`,
        type: "separator" as const,
        text,
        style: {},
      })),
      { id: "c", type: "cwd", mode: "basename", style: {} },
    ],
  };
}

describe("SEPARATOR_OPTIONS", () => {
  test("has unique ids and non-empty texts", () => {
    const ids = SEPARATOR_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(SEPARATOR_OPTIONS.length);
    for (const o of SEPARATOR_OPTIONS) expect(o.text.length).toBeGreaterThan(0);
  });

  test("separatorOptionForText matches by exact text", () => {
    expect(separatorOptionForText(" | ")?.id).toBe("pipe");
    expect(separatorOptionForText("nope")).toBeNull();
  });
});

describe("analyzeSeparators", () => {
  test("reports zero for a design with no separators", () => {
    const u = analyzeSeparators({
      version: 1,
      name: "t",
      elements: [{ id: "m", type: "model", style: {} }],
    });
    expect(u.count).toBe(0);
    expect(u.dominant).toBeNull();
    expect(u.dominantOption).toBeNull();
    expect(u.distinctTexts).toEqual([]);
  });

  test("counts and ranks by frequency", () => {
    const u = analyzeSeparators(designWith(" · ", " · ", " | "));
    expect(u.count).toBe(3);
    expect(u.dominant).toBe(" · ");
    expect(u.dominantOption?.id).toBe("dot");
    expect(u.distinctTexts).toEqual([" · ", " | "]);
  });

  test("dominantOption is null for a custom separator", () => {
    const u = analyzeSeparators(designWith(" >> "));
    expect(u.dominant).toBe(" >> ");
    expect(u.dominantOption).toBeNull();
  });
});

describe("describeSeparatorText", () => {
  test("labels known presets and trims unknown ones", () => {
    expect(describeSeparatorText(" | ")).toBe("Pipe (|)");
    expect(describeSeparatorText(" >> ")).toBe(">>");
    expect(describeSeparatorText("   ")).toBe("(blank)");
  });
});

describe("autoInsertElementBody", () => {
  const base = {
    autoSeparatorText: " | ",
    autoSpacerWidth: 2,
    autoSpacerChar: " ",
  };

  test("none yields null", () => {
    expect(autoInsertElementBody({ ...base, autoInsert: "none" })).toBeNull();
  });

  test("separator yields a separator element body", () => {
    const body = autoInsertElementBody({ ...base, autoInsert: "separator" });
    expect(body).toEqual({ type: "separator", text: " | ", style: {} });
  });

  test("spacer yields a clamped fixed spacer", () => {
    const body = autoInsertElementBody({
      ...base,
      autoInsert: "spacer",
      autoSpacerWidth: 99,
      autoSpacerChar: "··",
    });
    expect(body).toEqual({
      type: "spacer",
      mode: "fixed",
      width: 8,
      char: "·",
      style: {},
    });
  });
});

describe("respaceElements", () => {
  test("swaps a template's separators for the chosen separator", () => {
    const els: Element[] = [
      { id: "m", type: "model", style: {} },
      { id: "s1", type: "separator", text: "· ", style: {} },
      { id: "c", type: "cwd", mode: "basename", style: {} },
      { id: "s2", type: "separator", text: "· ", style: {} },
      { id: "b", type: "gitBranch", style: {} },
    ];
    const out = respaceElements(els, SEP_CFG, mkId());
    expect(out.map((e) => e.type)).toEqual([
      "model",
      "separator",
      "cwd",
      "separator",
      "gitBranch",
    ]);
    const seps = out.filter(
      (e) => e.type === "separator",
    ) as Array<Extract<Element, { type: "separator" }>>;
    expect(seps.every((s) => s.text === " | ")).toBe(true);
  });

  test("converts padding-style spacing to separators (trims old suffixes)", () => {
    const els: Element[] = [
      { id: "m", type: "model", suffix: " ", style: {} },
      { id: "c", type: "cwd", mode: "basename", suffix: " ", style: {} },
      { id: "b", type: "gitBranch", style: {} },
    ];
    const out = respaceElements(els, SEP_CFG, mkId());
    expect(out.map((e) => e.type)).toEqual([
      "model",
      "separator",
      "cwd",
      "separator",
      "gitBranch",
    ]);
    expect(out[0]!.suffix).toBeUndefined();
    expect(out[2]!.suffix).toBeUndefined();
  });

  test("converts separators to padding suffixes", () => {
    const els: Element[] = [
      { id: "m", type: "model", style: {} },
      { id: "s", type: "separator", text: "· ", style: {} },
      { id: "c", type: "cwd", mode: "basename", style: {} },
    ];
    const out = respaceElements(
      els,
      { ...SEP_CFG, autoInsert: "padding" },
      mkId(),
    );
    expect(out.map((e) => e.type)).toEqual(["model", "cwd"]);
    expect(out[0]!.suffix).toBe(" ");
    expect(out[1]!.suffix).toBeUndefined();
  });

  test("none mode strips all spacing", () => {
    const els: Element[] = [
      { id: "m", type: "model", suffix: " ", style: {} },
      { id: "s", type: "separator", text: " | ", style: {} },
      { id: "c", type: "cwd", mode: "basename", style: {} },
    ];
    const out = respaceElements(els, { ...SEP_CFG, autoInsert: "none" }, mkId());
    expect(out.map((e) => e.type)).toEqual(["model", "cwd"]);
    expect(out[0]!.suffix).toBeUndefined();
  });

  test("keeps flex spacers and never spaces across them", () => {
    const els: Element[] = [
      { id: "m", type: "model", suffix: " ", style: {} },
      { id: "f", type: "spacer", mode: "flex", char: " ", style: {} },
      { id: "co", type: "cost", precision: 2, style: {} },
    ];
    const out = respaceElements(els, SEP_CFG, mkId());
    expect(out.map((e) => e.type)).toEqual(["model", "spacer", "cost"]);
    expect(out[0]!.suffix).toBeUndefined();
  });

  test("preserves meaningful affixes while removing gap spaces", () => {
    const els: Element[] = [
      {
        id: "bar",
        type: "contextBar",
        width: 12,
        filledChar: "█",
        emptyChar: "░",
        prefix: "[",
        suffix: "] ",
        style: {},
      },
      { id: "co", type: "cost", precision: 2, style: {} },
    ];
    const out = respaceElements(els, SEP_CFG, mkId());
    expect(out.map((e) => e.type)).toEqual(["contextBar", "separator", "cost"]);
    expect(out[0]!.prefix).toBe("["); // decoration kept
    expect(out[0]!.suffix).toBe("]"); // trailing gap space removed
  });
});

describe("detectSpacingStyle", () => {
  test("identifies separator, padding, and none", () => {
    expect(
      detectSpacingStyle({
        version: 1,
        name: "t",
        elements: [
          { id: "m", type: "model", style: {} },
          { id: "s", type: "separator", text: " | ", style: {} },
          { id: "c", type: "cwd", mode: "basename", style: {} },
        ],
      }).kind,
    ).toBe("separator");

    expect(
      detectSpacingStyle({
        version: 1,
        name: "t",
        elements: [
          { id: "m", type: "model", suffix: " ", style: {} },
          { id: "c", type: "cwd", mode: "basename", style: {} },
        ],
      }).kind,
    ).toBe("padding");

    expect(
      detectSpacingStyle({
        version: 1,
        name: "t",
        elements: [{ id: "m", type: "model", style: {} }],
      }).kind,
    ).toBe("none");
  });
});

describe("isContentElementType", () => {
  test("structural/whitespace types are not content", () => {
    expect(isContentElementType("separator")).toBe(false);
    expect(isContentElementType("spacer")).toBe(false);
    expect(isContentElementType("lineBreak")).toBe(false);
    expect(isContentElementType("model")).toBe(true);
    expect(isContentElementType("cwd")).toBe(true);
  });
});
