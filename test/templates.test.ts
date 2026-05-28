import { describe, expect, test } from "bun:test";
import { TEMPLATES, getTemplate } from "@statusline/shared/templates";
import { validateDesign } from "@statusline/shared/schema";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import { tweenMock } from "../src/shared/animatedMocks";
import { stripAnsi } from "@statusline/shared/ansi";

describe("templates: catalogue", () => {
  test("ships exactly 14 templates with unique ids", () => {
    expect(TEMPLATES.length).toBe(14);
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const expected = [
      "minimal",
      "powerline",
      "verbose-dev",
      "context-watch",
      "branch-split",
      "two-tone-path",
      "pastel-dashboard",
      "just-the-bar",
      "vital-signs",
      "two-line-cockpit",
      "mode-switcher",
      "neon-pulse",
      "ocean-wave",
      "triptych",
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  test("getTemplate looks up by id", () => {
    expect(getTemplate("minimal")?.name).toBe("Minimal");
    expect(getTemplate("nonsense")).toBeUndefined();
  });
});

describe("templates: validateDesign", () => {
  for (const t of TEMPLATES) {
    test(`${t.id} passes validateDesign`, () => {
      // Round-trip through JSON to mimic loading a serialized template
      // (templates are also exposed via the server as JSON).
      const serialized = JSON.parse(JSON.stringify(t.design));
      const validated = validateDesign(serialized);
      expect(validated.version).toBe(1);
      expect(validated.elements.length).toBe(t.design.elements.length);
    });
  }
});

describe("templates: renderToAnsi", () => {
  for (const t of TEMPLATES) {
    test(`${t.id} renders to a non-empty string`, () => {
      const out = renderToAnsi(t.design, DEFAULT_MOCK_STDIN);
      expect(typeof out).toBe("string");
      const stripped = stripAnsi(out);
      expect(stripped.length).toBeGreaterThan(0);
    });
  }
});

describe("templates: powerline metadata", () => {
  test("powerline uses a font-portable separator (no Nerd Font requirement)", () => {
    const pl = getTemplate("powerline");
    // The chevron is now U+25B6, which renders in plain monospace fonts, so we
    // no longer warn that a Nerd Font is required.
    expect(pl?.authorCredit).toBeUndefined();
    const chevrons = pl?.design.elements.filter(
      (e) => e.type === "separator",
    );
    expect(chevrons?.length).toBeGreaterThan(0);
    for (const c of chevrons ?? []) {
      expect((c as { text: string }).text).toBe("▶");
    }
  });
});

describe("animatedMocks: tweenMock", () => {
  test("at t=0 used_percentage starts near 12", () => {
    const m = tweenMock(DEFAULT_MOCK_STDIN, 0, 6000);
    expect(m.context_window?.used_percentage).toBeCloseTo(12, 1);
    expect(m.cost?.total_cost_usd).toBeCloseTo(0, 4);
  });

  test("at t=durationMs used_percentage ends near 89", () => {
    const m = tweenMock(DEFAULT_MOCK_STDIN, 6000, 6000);
    expect(m.context_window?.used_percentage).toBeCloseTo(89, 1);
    expect(m.cost?.total_cost_usd).toBeCloseTo(1.23, 4);
  });

  test("clamps before 0 and beyond duration", () => {
    const before = tweenMock(DEFAULT_MOCK_STDIN, -200, 6000);
    expect(before.context_window?.used_percentage).toBeCloseTo(12, 1);
    const after = tweenMock(DEFAULT_MOCK_STDIN, 9000, 6000);
    expect(after.context_window?.used_percentage).toBeCloseTo(89, 1);
  });

  test("midpoint interpolates between endpoints", () => {
    const m = tweenMock(DEFAULT_MOCK_STDIN, 3000, 6000);
    const pct = m.context_window?.used_percentage ?? 0;
    expect(pct).toBeGreaterThan(40);
    expect(pct).toBeLessThan(70);
  });

  test("total_duration_ms accumulates from baseline", () => {
    const m = tweenMock(DEFAULT_MOCK_STDIN, 1234, 6000);
    const base = DEFAULT_MOCK_STDIN.cost?.total_duration_ms ?? 0;
    expect(m.cost?.total_duration_ms).toBe(base + 1234);
  });

  test("is pure: same args produce identical output", () => {
    const a = tweenMock(DEFAULT_MOCK_STDIN, 1500, 6000);
    const b = tweenMock(DEFAULT_MOCK_STDIN, 1500, 6000);
    expect(a).toEqual(b);
  });
});
