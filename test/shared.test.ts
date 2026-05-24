import { describe, expect, test } from "bun:test";
import { validateDesign, safeValidateDesign, ValidationError } from "@statusline/shared/schema";
import {
  parseAnsi,
  styleToSgr,
  stripAnsi,
  colorToCss,
  ansi256ToRgb,
  ESC,
} from "@statusline/shared/ansi";
import { DEFAULT_MOCK_STDIN, getField } from "@statusline/shared/mockStdin";
import type { Design } from "@statusline/shared/types";

const FIXTURE: Design = {
  version: 1,
  name: "Fixture",
  elements: [
    { id: "a", type: "model", style: { fg: { kind: "ansi16", index: 12 }, bold: true } },
    {
      id: "b",
      type: "separator",
      text: " | ",
      style: { fg: { kind: "ansi256", index: 244 } },
    },
    {
      id: "c",
      type: "cwd",
      mode: "basename",
      style: { fg: { kind: "rgb", r: 220, g: 220, b: 200 } },
    },
    {
      id: "d",
      type: "segmentSplit",
      source: { kind: "field", path: "workspace.git_worktree" },
      delimiter: "/",
      style: {},
      segments: [
        { style: { fg: { kind: "ansi16", index: 15 } } },
        { style: { fg: { kind: "ansi16", index: 13 }, bold: true } },
      ],
    },
    {
      id: "e",
      type: "contextBar",
      width: 10,
      filledChar: "█",
      emptyChar: "░",
      style: { fg: { kind: "ansi16", index: 10 } },
    },
  ],
};

describe("schema.validateDesign", () => {
  test("accepts a well-formed fixture", () => {
    const out = validateDesign(FIXTURE);
    expect(out.elements).toHaveLength(5);
    expect(out.elements[0]!.type).toBe("model");
  });

  test("rejects wrong version", () => {
    expect(() => validateDesign({ ...FIXTURE, version: 2 })).toThrow(ValidationError);
  });

  test("rejects unknown element type", () => {
    const bad = { ...FIXTURE, elements: [{ id: "x", type: "bogus", style: {} }] };
    expect(() => validateDesign(bad)).toThrow(ValidationError);
  });

  test("rejects rgb out of range", () => {
    const bad: any = {
      ...FIXTURE,
      elements: [
        { id: "a", type: "model", style: { fg: { kind: "rgb", r: 999, g: 0, b: 0 } } },
      ],
    };
    expect(() => validateDesign(bad)).toThrow(ValidationError);
  });

  test("safeValidateDesign returns ok", () => {
    const r = safeValidateDesign(FIXTURE);
    expect(r.ok).toBe(true);
  });

  test("safeValidateDesign returns error on bad input", () => {
    const r = safeValidateDesign({ version: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.path).toContain("name");
  });
});

describe("ansi parser", () => {
  test("parses plain text", () => {
    const segs = parseAnsi("hello");
    expect(segs).toEqual([{ text: "hello" }]);
  });

  test("parses 16-color foreground", () => {
    const segs = parseAnsi(`${ESC}[31mred${ESC}[0m`);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.fg).toBe("#cc0000");
    expect(segs[0]!.text).toBe("red");
  });

  test("parses bright 16-color foreground", () => {
    const segs = parseAnsi(`${ESC}[91mbrightred${ESC}[0m`);
    expect(segs[0]!.fg).toBe("#ef2929");
  });

  test("parses bold + italic + underline", () => {
    const segs = parseAnsi(`${ESC}[1;3;4mall${ESC}[0m`);
    expect(segs[0]!.bold).toBe(true);
    expect(segs[0]!.italic).toBe(true);
    expect(segs[0]!.underline).toBe(true);
  });

  test("parses 256-color", () => {
    const segs = parseAnsi(`${ESC}[38;5;196mhi${ESC}[0m`);
    expect(segs[0]!.fg).toBeDefined();
    expect(segs[0]!.fg).toMatch(/^rgb\(/);
  });

  test("parses 24-bit truecolor", () => {
    const segs = parseAnsi(`${ESC}[38;2;100;150;200mhi${ESC}[0m`);
    expect(segs[0]!.fg).toBe("rgb(100,150,200)");
  });

  test("parses background 16-color", () => {
    const segs = parseAnsi(`${ESC}[44mhi${ESC}[0m`);
    expect(segs[0]!.bg).toBe("#3465a4");
  });

  test("parses background 256-color", () => {
    const segs = parseAnsi(`${ESC}[48;5;201mhi${ESC}[0m`);
    expect(segs[0]!.bg).toMatch(/^rgb\(/);
  });

  test("parses background truecolor", () => {
    const segs = parseAnsi(`${ESC}[48;2;10;20;30mhi${ESC}[0m`);
    expect(segs[0]!.bg).toBe("rgb(10,20,30)");
  });

  test("resets style on 0", () => {
    const segs = parseAnsi(`${ESC}[31mA${ESC}[0mB`);
    expect(segs[0]!.fg).toBe("#cc0000");
    expect(segs[1]!.fg).toBeUndefined();
  });

  test("39/49 clear fg/bg only", () => {
    const segs = parseAnsi(`${ESC}[31;44mA${ESC}[39mB${ESC}[49mC`);
    expect(segs[0]!.fg).toBe("#cc0000");
    expect(segs[0]!.bg).toBe("#3465a4");
    expect(segs[1]!.fg).toBeUndefined();
    expect(segs[1]!.bg).toBe("#3465a4");
    expect(segs[2]!.fg).toBeUndefined();
    expect(segs[2]!.bg).toBeUndefined();
  });

  test("22/23/24 clear bold/italic/underline", () => {
    const segs = parseAnsi(`${ESC}[1;3;4mA${ESC}[22mB${ESC}[23mC${ESC}[24mD`);
    expect(segs[0]!.bold).toBe(true);
    expect(segs[1]!.bold).toBeUndefined();
    expect(segs[1]!.italic).toBe(true);
    expect(segs[2]!.italic).toBeUndefined();
    expect(segs[3]!.underline).toBeUndefined();
  });
});

describe("stripAnsi", () => {
  test("removes all SGR sequences", () => {
    expect(stripAnsi(`${ESC}[1;31mhi${ESC}[0m`)).toBe("hi");
  });
});

describe("ansi256ToRgb", () => {
  test("standard 16-color block", () => {
    const [r, g, b] = ansi256ToRgb(1);
    expect(r).toBe(0xcc);
    expect(g).toBe(0x00);
    expect(b).toBe(0x00);
  });
  test("color cube black", () => {
    expect(ansi256ToRgb(16)).toEqual([0, 0, 0]);
  });
  test("color cube vivid red", () => {
    const [r, g, b] = ansi256ToRgb(196);
    expect(r).toBeGreaterThan(200);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
  test("grayscale ramp", () => {
    const [r, g, b] = ansi256ToRgb(232);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe("styleToSgr", () => {
  test("emits codes in order", () => {
    const out = styleToSgr({ bold: true, fg: { kind: "ansi16", index: 1 } });
    expect(out).toContain("1;31");
  });
  test("empty style is empty", () => {
    expect(styleToSgr({})).toBe("");
  });
  test("rgb color", () => {
    expect(styleToSgr({ fg: { kind: "rgb", r: 1, g: 2, b: 3 } })).toContain("38;2;1;2;3");
  });
  test("256 color", () => {
    expect(styleToSgr({ bg: { kind: "ansi256", index: 100 } })).toContain("48;5;100");
  });
});

describe("colorToCss", () => {
  test("default returns undefined", () => {
    expect(colorToCss({ kind: "default" }, true)).toBeUndefined();
  });
  test("rgb returns css", () => {
    expect(colorToCss({ kind: "rgb", r: 1, g: 2, b: 3 }, true)).toBe("rgb(1,2,3)");
  });
});

describe("getField", () => {
  test("traverses nested paths", () => {
    expect(getField(DEFAULT_MOCK_STDIN, "model.display_name")).toBe("Opus 4.7");
    expect(getField(DEFAULT_MOCK_STDIN, "workspace.git_worktree")).toBe("feature/auth-refactor");
  });
  test("returns undefined for missing", () => {
    expect(getField(DEFAULT_MOCK_STDIN, "model.foo.bar")).toBeUndefined();
  });
});
