import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileToOps } from "../src/compiler/ir";
import { renderToAnsi } from "../src/compiler/interpret";
import { compileToBash } from "../src/compiler/bash";
import { compileToPS } from "../src/compiler/powershell";
import { stripAnsi } from "../src/shared/ansi";
import { DEFAULT_MOCK_STDIN, MOCK_PRESETS } from "../src/shared/mockStdin";
import type { Design } from "../src/shared/types";

const SIMPLE: Design = {
  version: 1,
  name: "Simple",
  elements: [
    { id: "1", type: "model", style: { fg: { kind: "ansi16", index: 12 }, bold: true } },
    { id: "2", type: "separator", text: " | ", style: {} },
    { id: "3", type: "cwd", mode: "basename", style: { fg: { kind: "ansi16", index: 14 } } },
  ],
};

const COMPLEX: Design = {
  version: 1,
  name: "Complex",
  elements: [
    { id: "m", type: "model", style: { bold: true } },
    { id: "s1", type: "separator", text: " ▸ ", style: { fg: { kind: "ansi16", index: 8 } } },
    { id: "c", type: "cwd", mode: "tilde", style: { fg: { kind: "rgb", r: 200, g: 200, b: 180 } } },
    { id: "s2", type: "separator", text: " ", style: {} },
    {
      id: "br",
      type: "segmentSplit",
      style: {},
      source: { kind: "field", path: "workspace.git_worktree" },
      delimiter: "/",
      segments: [
        { style: { fg: { kind: "ansi16", index: 15 } } },
        { style: { fg: { kind: "ansi16", index: 13 }, bold: true } },
      ],
    },
    { id: "sp", type: "separator", text: " ", style: {} },
    {
      id: "bar",
      type: "contextBar",
      width: 10,
      filledChar: "█",
      emptyChar: "░",
      style: { fg: { kind: "ansi256", index: 76 } },
    },
    { id: "pct", type: "contextPct", style: {}, prefix: " ", suffix: "%" },
    { id: "s3", type: "separator", text: " | ", style: {} },
    { id: "cost", type: "cost", precision: 2, style: { fg: { kind: "ansi16", index: 11 } } },
  ],
};

describe("compileToOps", () => {
  test("produces ops for a simple design", () => {
    const ops = compileToOps(SIMPLE);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops[0]!.op).toBe("field");
  });

  test("segmentSplit produces split op", () => {
    const ops = compileToOps(COMPLEX);
    const split = ops.find((o) => o.op === "split");
    expect(split).toBeDefined();
  });

  test("showWhen wraps element in cond", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        {
          id: "1",
          type: "model",
          style: {},
          showWhen: { field: "model.display_name", op: "exists" },
        },
      ],
    };
    const ops = compileToOps(d);
    expect(ops[0]!.op).toBe("cond");
  });

  test("rate limit elements emit field/progressBar ops with rate_limits paths", () => {
    const d: Design = {
      version: 1,
      name: "RL",
      elements: [
        { id: "1", type: "rateLimit5hPct", style: {} },
        { id: "2", type: "rateLimit5hBar", width: 8, filledChar: "#", emptyChar: ".", style: {} },
        { id: "3", type: "rateLimit7dPct", style: {} },
        { id: "4", type: "rateLimit7dBar", width: 8, filledChar: "#", emptyChar: ".", style: {} },
      ],
    };
    const ops = compileToOps(d);
    expect(ops).toHaveLength(4);
    expect(ops[0]).toMatchObject({ op: "field", path: "rate_limits.five_hour.used_percentage" });
    expect(ops[1]).toMatchObject({ op: "progressBar", pctPath: "rate_limits.five_hour.used_percentage" });
    expect(ops[2]).toMatchObject({ op: "field", path: "rate_limits.seven_day.used_percentage" });
    expect(ops[3]).toMatchObject({ op: "progressBar", pctPath: "rate_limits.seven_day.used_percentage" });
  });

  test("prefix/suffix wrap inner ops with literals", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        { id: "1", type: "model", style: {}, prefix: "[", suffix: "]" },
      ],
    };
    const ops = compileToOps(d);
    expect(ops[0]!.op).toBe("literal");
    expect((ops[0] as { text: string }).text).toBe("[");
    expect(ops[2]!.op).toBe("literal");
    expect((ops[2] as { text: string }).text).toBe("]");
  });
});

describe("interpret renderToAnsi", () => {
  test("simple design produces correct stripped text", () => {
    const ansi = renderToAnsi(SIMPLE, DEFAULT_MOCK_STDIN);
    expect(stripAnsi(ansi)).toBe("Opus 4.7 | statusline-maker");
  });

  test("contextBar reflects percentage", () => {
    const d: Design = {
      version: 1,
      name: "B",
      elements: [
        { id: "1", type: "contextBar", width: 10, filledChar: "#", emptyChar: ".", style: {} },
      ],
    };
    const ansi = renderToAnsi(d, { context_window: { used_percentage: 50 } });
    expect(stripAnsi(ansi)).toBe("#####.....");
  });

  test("rate limit elements read from rate_limits paths", () => {
    const d: Design = {
      version: 1,
      name: "RL",
      elements: [
        { id: "p5", type: "rateLimit5hPct", style: {}, suffix: "%" },
        { id: "s1", type: "separator", text: " ", style: {} },
        { id: "b5", type: "rateLimit5hBar", width: 10, filledChar: "#", emptyChar: ".", style: {} },
        { id: "s2", type: "separator", text: " ", style: {} },
        { id: "p7", type: "rateLimit7dPct", style: {}, suffix: "%" },
        { id: "s3", type: "separator", text: " ", style: {} },
        { id: "b7", type: "rateLimit7dBar", width: 10, filledChar: "#", emptyChar: ".", style: {} },
      ],
    };
    const ansi = renderToAnsi(d, {
      rate_limits: {
        five_hour: { used_percentage: 40 },
        seven_day: { used_percentage: 70 },
      },
    });
    expect(stripAnsi(ansi)).toBe("40% ####...... 70% #######...");
  });

  test("segmentSplit on feature/auth-refactor styles two segments", () => {
    const d: Design = {
      version: 1,
      name: "S",
      elements: [
        {
          id: "1",
          type: "segmentSplit",
          style: {},
          source: { kind: "field", path: "workspace.git_worktree" },
          delimiter: "/",
          segments: [
            { style: { fg: { kind: "ansi16", index: 15 } } },
            { style: { fg: { kind: "ansi16", index: 13 } } },
          ],
        },
      ],
    };
    const ansi = renderToAnsi(d, DEFAULT_MOCK_STDIN);
    expect(stripAnsi(ansi)).toBe("feature/auth-refactor");
    expect(ansi).toContain("\x1b[97m");
    expect(ansi).toContain("\x1b[95m");
  });

  test("showWhen hides element when condition false", () => {
    const d: Design = {
      version: 1,
      name: "H",
      elements: [
        {
          id: "1",
          type: "model",
          style: {},
          showWhen: { field: "workspace.git_worktree", op: "exists" },
        },
      ],
    };
    expect(stripAnsi(renderToAnsi(d, MOCK_PRESETS["noGit"]!))).toBe("");
    expect(stripAnsi(renderToAnsi(d, DEFAULT_MOCK_STDIN))).toBe("Opus 4.7");
  });

  test("cost formats with precision", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [{ id: "1", type: "cost", precision: 3, style: {} }],
    };
    const ansi = renderToAnsi(d, { cost: { total_cost_usd: 1.5 } });
    expect(stripAnsi(ansi)).toBe("$1.500");
  });

  test("session duration human format", () => {
    const d: Design = {
      version: 1,
      name: "D",
      elements: [{ id: "1", type: "sessionDuration", format: "human", style: {} }],
    };
    expect(stripAnsi(renderToAnsi(d, { cost: { total_duration_ms: 65000 } }))).toBe("1m 5s");
    expect(stripAnsi(renderToAnsi(d, { cost: { total_duration_ms: 5000 } }))).toBe("5s");
    expect(stripAnsi(renderToAnsi(d, { cost: { total_duration_ms: 3700000 } }))).toBe("1h 1m");
  });

  test("session duration hms format", () => {
    const d: Design = {
      version: 1,
      name: "D",
      elements: [{ id: "1", type: "sessionDuration", format: "hms", style: {} }],
    };
    expect(stripAnsi(renderToAnsi(d, { cost: { total_duration_ms: 65000 } }))).toBe("1:05");
    expect(stripAnsi(renderToAnsi(d, { cost: { total_duration_ms: 3661000 } }))).toBe("1:01:01");
  });
});

describe("compileToBash", () => {
  test("returns shebang + body", () => {
    const out = compileToBash(SIMPLE);
    expect(out).toContain("#!/usr/bin/env bash");
    expect(out).toContain("exit 0");
  });

  test("emits __emit calls", () => {
    const out = compileToBash(SIMPLE);
    expect(out).toContain("__emit '");
  });

  test("emits a case statement for segmentSplit", () => {
    const out = compileToBash(COMPLEX);
    expect(out).toContain("case \"$__idx\" in");
  });

  test("contains progress bar logic", () => {
    const out = compileToBash(COMPLEX);
    expect(out).toContain("__bar ");
  });
});

describe("compileToPS", () => {
  test("returns ps header + body", () => {
    const out = compileToPS(SIMPLE);
    expect(out).toContain("ConvertFrom-Json");
    expect(out).toContain("exit 0");
  });

  test("emits __emit calls", () => {
    const out = compileToPS(SIMPLE);
    expect(out).toContain("__emit '");
  });

  test("emits switch for segmentSplit", () => {
    const out = compileToPS(COMPLEX);
    expect(out).toContain("switch ($__i)");
  });
});

const HAS_BASH = (() => {
  try {
    const r = spawnSync("bash", ["--version"], { encoding: "utf8" });
    return r.status === 0;
  } catch {
    return false;
  }
})();

describe("rotator", () => {
  const ROT: Design = {
    version: 1,
    name: "R",
    elements: [
      {
        id: "r",
        type: "rotator",
        style: {},
        items: ["a", "b", "c", "d"],
        intervalSeconds: 2,
        pickMode: "cycle",
      },
    ],
  };

  test("cycle picks index from clock", () => {
    const prev = process.env.STATUSLINE_CLOCK_OVERRIDE;
    process.env.STATUSLINE_CLOCK_OVERRIDE = "10"; // 10/2 = 5; 5%4 = 1
    const ansi = renderToAnsi(ROT, DEFAULT_MOCK_STDIN);
    expect(stripAnsi(ansi)).toBe("b");
    process.env.STATUSLINE_CLOCK_OVERRIDE = "14"; // 14/2 = 7; 7%4 = 3
    expect(stripAnsi(renderToAnsi(ROT, DEFAULT_MOCK_STDIN))).toBe("d");
    if (prev === undefined) delete process.env.STATUSLINE_CLOCK_OVERRIDE;
    else process.env.STATUSLINE_CLOCK_OVERRIDE = prev;
  });

  test("random picks a member each call", () => {
    const d: Design = {
      version: 1,
      name: "R",
      elements: [
        {
          id: "r",
          type: "rotator",
          style: {},
          items: ["x", "y", "z"],
          intervalSeconds: 1,
          pickMode: "random",
        },
      ],
    };
    for (let i = 0; i < 30; i++) {
      const out = stripAnsi(renderToAnsi(d, DEFAULT_MOCK_STDIN));
      expect(["x", "y", "z"]).toContain(out);
    }
  });
});

describe.skipIf(!HAS_BASH)("bash backend executes correctly", () => {
  test("simple design produces matching output", () => {
    const script = compileToBash(SIMPLE);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify(DEFAULT_MOCK_STDIN),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout)).toBe(stripAnsi(renderToAnsi(SIMPLE, DEFAULT_MOCK_STDIN)));
  });

  test("complex design (segmentSplit + bar + cost) stripped output matches interpret", () => {
    const script = compileToBash(COMPLEX);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify(DEFAULT_MOCK_STDIN),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const expected = stripAnsi(renderToAnsi(COMPLEX, DEFAULT_MOCK_STDIN));
    expect(stripAnsi(r.stdout)).toBe(expected);
  });

  test("rate limit pct + bar parity with bash backend", () => {
    const d: Design = {
      version: 1,
      name: "RL",
      elements: [
        { id: "p5", type: "rateLimit5hPct", style: {}, suffix: "%" },
        { id: "s1", type: "separator", text: " ", style: {} },
        { id: "b5", type: "rateLimit5hBar", width: 8, filledChar: "#", emptyChar: ".", style: {} },
        { id: "s2", type: "separator", text: " ", style: {} },
        { id: "p7", type: "rateLimit7dPct", style: {}, suffix: "%" },
        { id: "s3", type: "separator", text: " ", style: {} },
        { id: "b7", type: "rateLimit7dBar", width: 8, filledChar: "#", emptyChar: ".", style: {} },
      ],
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify(DEFAULT_MOCK_STDIN),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout)).toBe(stripAnsi(renderToAnsi(d, DEFAULT_MOCK_STDIN)));
  });

  test("rotator cycle parity with pinned clock", () => {
    const d: Design = {
      version: 1,
      name: "R",
      elements: [
        {
          id: "r",
          type: "rotator",
          style: {},
          items: ["alpha", "beta", "gamma"],
          intervalSeconds: 5,
          pickMode: "cycle",
        },
      ],
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const prev = process.env.STATUSLINE_CLOCK_OVERRIDE;
    process.env.STATUSLINE_CLOCK_OVERRIDE = "27"; // 27/5=5; 5%3 = 2 → "gamma"
    try {
      const r = spawnSync("bash", [path], {
        input: JSON.stringify(DEFAULT_MOCK_STDIN),
        encoding: "utf8",
        env: { ...process.env, STATUSLINE_CLOCK_OVERRIDE: "27" },
      });
      expect(r.status).toBe(0);
      const expected = stripAnsi(renderToAnsi(d, DEFAULT_MOCK_STDIN));
      expect(stripAnsi(r.stdout)).toBe(expected);
      expect(stripAnsi(r.stdout)).toBe("gamma");
    } finally {
      if (prev === undefined) delete process.env.STATUSLINE_CLOCK_OVERRIDE;
      else process.env.STATUSLINE_CLOCK_OVERRIDE = prev;
    }
  });
});
