import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileToOps } from "@statusline/shared/compiler/ir";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { compileToBash } from "@statusline/shared/compiler/bash";
import { compileToPS } from "@statusline/shared/compiler/powershell";
import { stripAnsi } from "@statusline/shared/ansi";
import { DEFAULT_MOCK_STDIN, MOCK_PRESETS } from "@statusline/shared/mockStdin";
import type { Design } from "@statusline/shared/types";

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

  test("contextTokens renders ratio/used/remaining/ratioPct in compact and full form", () => {
    const stdin = {
      context_window: {
        used_percentage: 47.2,
        total_input_tokens: 94400,
        context_window_size: 200000,
      },
    };
    const mk = (variant: "ratio" | "ratioPct" | "used" | "remaining", compact: boolean): Design => ({
      version: 1,
      name: "TD",
      elements: [{ id: "1", type: "contextTokens", style: {}, variant, compact }],
    });
    expect(stripAnsi(renderToAnsi(mk("ratio", true), stdin))).toBe("94.4k/200k");
    expect(stripAnsi(renderToAnsi(mk("ratio", false), stdin))).toBe("94,400/200,000");
    expect(stripAnsi(renderToAnsi(mk("ratioPct", true), stdin))).toBe("94.4k/200k (47%)");
    expect(stripAnsi(renderToAnsi(mk("used", true), stdin))).toBe("94.4k");
    expect(stripAnsi(renderToAnsi(mk("used", false), stdin))).toBe("94,400");
    expect(stripAnsi(renderToAnsi(mk("remaining", true), stdin))).toBe("105.6k");
    expect(stripAnsi(renderToAnsi(mk("remaining", false), stdin))).toBe("105,600");
  });

  test("contextTokens compact handles 1M boundary", () => {
    const d: Design = {
      version: 1,
      name: "TD",
      elements: [
        { id: "1", type: "contextTokens", style: {}, variant: "ratio", compact: true },
      ],
    };
    const stdin = {
      context_window: {
        total_input_tokens: 250000,
        context_window_size: 1000000,
      },
    };
    expect(stripAnsi(renderToAnsi(d, stdin))).toBe("250k/1M");
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

// --- lineBreak / multi-deck fixtures -----------------------------------

const MULTILINE: Design = {
  version: 1,
  name: "ML",
  elements: [
    { id: "m", type: "model", style: {} },
    { id: "lb", type: "lineBreak", style: {} },
    { id: "c", type: "cwd", mode: "basename", style: {} },
  ],
};

// Design + element-level background colors flanking a lineBreak — used to
// prove the reset-before-newline contract holds. Without the reset, the
// terminal would paint the (now-cleared) trailing line with the previous
// element's bg colour, which is the bug we are guarding against.
const MULTILINE_BG: Design = {
  version: 1,
  name: "ML-BG",
  background: { kind: "ansi16", index: 0 },
  elements: [
    {
      id: "m",
      type: "model",
      style: { fg: { kind: "ansi16", index: 15 }, bg: { kind: "ansi16", index: 4 } },
    },
    { id: "lb", type: "lineBreak", style: {} },
    {
      id: "c",
      type: "cwd",
      mode: "basename",
      style: { fg: { kind: "ansi16", index: 14 } },
    },
  ],
};

describe("lineBreak (multi-deck)", () => {
  test("compileToOps emits a {op:'lineBreak'} between flanking ops", () => {
    const ops = compileToOps(MULTILINE);
    expect(ops).toHaveLength(3);
    expect(ops[0]!.op).toBe("field");
    expect(ops[1]!).toEqual({ op: "lineBreak" });
    expect(ops[2]!.op).toBe("field");
  });

  test("interpret renders exactly one \\n at the boundary", () => {
    const raw = renderToAnsi(MULTILINE, DEFAULT_MOCK_STDIN);
    const stripped = stripAnsi(raw);
    expect(stripped.match(/\n/g)?.length ?? 0).toBe(1);
    const [first, second, ...rest] = stripped.split("\n");
    expect(rest.length).toBe(0);
    expect(first).toBe("Opus 4.7");
    expect(second).toBe("statusline-maker");
  });

  test("interpret emits SGR_RESET immediately before the newline (no bg bleed)", () => {
    const raw = renderToAnsi(MULTILINE_BG, DEFAULT_MOCK_STDIN);
    // Reset-then-newline must appear verbatim — terminals only clear the
    // current SGR state on \x1b[0m, so without this the bg paints the
    // rest of the line.
    expect(raw).toContain("\x1b[0m\n");
    // After the newline, the second deck must not begin with leftover
    // background SGR state (44 = blue bg). The opening byte sequence on
    // the new line should be either the fresh fg style or the literal
    // text — never a stale bg code from the deck above.
    const afterNl = raw.slice(raw.indexOf("\n") + 1);
    expect(afterNl.startsWith("\x1b[44m")).toBe(false);
    expect(afterNl).not.toContain("\x1b[44m");
  });

  test("compiled bash emits __reset then printf newline", () => {
    const script = compileToBash(MULTILINE);
    expect(script).toContain("__reset");
    expect(script).toContain("printf '\\n'");
  });

  test("compiled PowerShell emits reset before backtick-n", () => {
    const script = compileToPS(MULTILINE);
    expect(script).toContain('(__reset) + "`n"');
  });
});

describe("YAS stateless elements", () => {
  const THINKING: Design = {
    version: 1,
    name: "T",
    elements: [{ id: "1", type: "thinkingEffort", style: {} }],
  };
  const OUTPUT_STYLE_HIDDEN: Design = {
    version: 1,
    name: "O",
    elements: [{ id: "1", type: "outputStyle", style: {} }],
  };
  const OUTPUT_STYLE_SHOWN: Design = {
    version: 1,
    name: "O",
    elements: [{ id: "1", type: "outputStyle", style: {}, alwaysShow: true }],
  };
  const FAST_DEFAULT: Design = {
    version: 1,
    name: "F",
    elements: [{ id: "1", type: "fastMode", style: {} }],
  };
  const CWD_COMPACT_DESIGN: Design = {
    version: 1,
    name: "C",
    elements: [{ id: "1", type: "cwd", mode: "compact", style: {} }],
  };

  test("THINKING_OFF: hidden when thinking.enabled is false", () => {
    const out = stripAnsi(
      renderToAnsi(THINKING, {
        thinking: { enabled: false },
        effort: { level: "high" },
      }),
    );
    expect(out).toBe("");
  });

  test("THINKING_HIGH: renders effort.level when thinking.enabled is true", () => {
    const out = stripAnsi(
      renderToAnsi(THINKING, {
        thinking: { enabled: true },
        effort: { level: "high" },
      }),
    );
    expect(out).toBe("high");
  });

  test("OUTPUT_STYLE_DEFAULT_HIDDEN: hidden when name=default and alwaysShow=false", () => {
    const out = stripAnsi(
      renderToAnsi(OUTPUT_STYLE_HIDDEN, { output_style: { name: "default" } }),
    );
    expect(out).toBe("");
  });

  test("OUTPUT_STYLE_DEFAULT_SHOWN: visible when alwaysShow=true", () => {
    const out = stripAnsi(
      renderToAnsi(OUTPUT_STYLE_SHOWN, { output_style: { name: "default" } }),
    );
    expect(out).toBe("default");
  });

  test("OUTPUT_STYLE_EXPLANATORY: visible when name != default", () => {
    const out = stripAnsi(
      renderToAnsi(OUTPUT_STYLE_HIDDEN, {
        output_style: { name: "explanatory" },
      }),
    );
    expect(out).toBe("explanatory");
  });

  test("FAST_MODE_OFF: hidden when fast_mode is false", () => {
    const out = stripAnsi(renderToAnsi(FAST_DEFAULT, { fast_mode: false }));
    expect(out).toBe("");
  });

  test("FAST_MODE_ON: renders default badge text when fast_mode is true", () => {
    const out = stripAnsi(renderToAnsi(FAST_DEFAULT, { fast_mode: true }));
    expect(out).toBe("⚡fast");
  });

  test("FAST_MODE_CUSTOM_TEXT: renders configured text when fast_mode is true", () => {
    const d: Design = {
      version: 1,
      name: "F",
      elements: [
        { id: "1", type: "fastMode", style: {}, text: "FAST!" },
      ],
    };
    expect(stripAnsi(renderToAnsi(d, { fast_mode: true }))).toBe("FAST!");
  });

  test("CWD_COMPACT: parent dirs collapse to first char, leaf intact", () => {
    const out = stripAnsi(
      renderToAnsi(CWD_COMPACT_DESIGN, {
        workspace: { current_dir: "/home/user/my-project" },
      }),
    );
    expect(out).toBe("/h/u/my-project");
  });

  test("CWD_COMPACT: single-segment input is unchanged", () => {
    const out = stripAnsi(
      renderToAnsi(CWD_COMPACT_DESIGN, {
        workspace: { current_dir: "leaf" },
      }),
    );
    expect(out).toBe("leaf");
  });

  test("CWD_COMPACT: empty cwd renders as empty string", () => {
    const out = stripAnsi(
      renderToAnsi(CWD_COMPACT_DESIGN, { workspace: { current_dir: "" } }),
    );
    expect(out).toBe("");
  });

  describe.skipIf(!HAS_BASH)("bash parity", () => {
    function runBash(design: Design, mock: unknown): string {
      const script = compileToBash(design);
      const dir = mkdtempSync(join(tmpdir(), "sl-"));
      const path = join(dir, "sl.sh");
      writeFileSync(path, script);
      const r = spawnSync("bash", [path], {
        input: JSON.stringify(mock),
        encoding: "utf8",
      });
      expect(r.status).toBe(0);
      return r.stdout;
    }

    test("thinkingEffort hidden/visible parity", () => {
      const off = {
        thinking: { enabled: false },
        effort: { level: "high" },
      };
      const on = { thinking: { enabled: true }, effort: { level: "high" } };
      expect(stripAnsi(runBash(THINKING, off))).toBe(
        stripAnsi(renderToAnsi(THINKING, off)),
      );
      expect(stripAnsi(runBash(THINKING, on))).toBe(
        stripAnsi(renderToAnsi(THINKING, on)),
      );
    });

    test("outputStyle hidden/shown parity", () => {
      const def = { output_style: { name: "default" } };
      const exp = { output_style: { name: "explanatory" } };
      expect(stripAnsi(runBash(OUTPUT_STYLE_HIDDEN, def))).toBe(
        stripAnsi(renderToAnsi(OUTPUT_STYLE_HIDDEN, def)),
      );
      expect(stripAnsi(runBash(OUTPUT_STYLE_SHOWN, def))).toBe(
        stripAnsi(renderToAnsi(OUTPUT_STYLE_SHOWN, def)),
      );
      expect(stripAnsi(runBash(OUTPUT_STYLE_HIDDEN, exp))).toBe(
        stripAnsi(renderToAnsi(OUTPUT_STYLE_HIDDEN, exp)),
      );
    });

    test("fastMode on/off parity", () => {
      expect(stripAnsi(runBash(FAST_DEFAULT, { fast_mode: false }))).toBe(
        stripAnsi(renderToAnsi(FAST_DEFAULT, { fast_mode: false })),
      );
      expect(stripAnsi(runBash(FAST_DEFAULT, { fast_mode: true }))).toBe(
        stripAnsi(renderToAnsi(FAST_DEFAULT, { fast_mode: true })),
      );
    });

    test("cwd compact mode parity", () => {
      const mock = { workspace: { current_dir: "/home/user/my-project" } };
      expect(stripAnsi(runBash(CWD_COMPACT_DESIGN, mock))).toBe(
        stripAnsi(renderToAnsi(CWD_COMPACT_DESIGN, mock)),
      );
      expect(stripAnsi(runBash(CWD_COMPACT_DESIGN, mock))).toBe(
        "/h/u/my-project",
      );
    });
  });
});

// --- spacer fixtures ---------------------------------------------------

describe("spacer element", () => {
  const TW = (cols: number) => ({ ...DEFAULT_MOCK_STDIN, _terminalWidth: cols });

  test("SPACER_FIXED: emits exactly N copies of char between elements", () => {
    const d: Design = {
      version: 1,
      name: "SF",
      elements: [
        { id: "1", type: "static", text: "A", style: {} },
        { id: "sp", type: "spacer", mode: "fixed", width: 4, style: {} },
        { id: "2", type: "static", text: "B", style: {} },
      ],
    };
    expect(stripAnsi(renderToAnsi(d, DEFAULT_MOCK_STDIN))).toBe("A    B");
  });

  test("SPACER_FIXED with custom char", () => {
    const d: Design = {
      version: 1,
      name: "SF",
      elements: [
        { id: "1", type: "static", text: "L", style: {} },
        { id: "sp", type: "spacer", mode: "fixed", width: 3, char: ".", style: {} },
        { id: "2", type: "static", text: "R", style: {} },
      ],
    };
    expect(stripAnsi(renderToAnsi(d, DEFAULT_MOCK_STDIN))).toBe("L...R");
  });

  test("SPACER_FLEX: padding = cols - left - right", () => {
    const d: Design = {
      version: 1,
      name: "F",
      elements: [
        { id: "1", type: "static", text: "left", style: {} },
        { id: "sp", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "right", style: {} },
      ],
    };
    const out = stripAnsi(renderToAnsi(d, TW(40)));
    // 40 - 4 - 5 = 31 spaces
    expect(out).toBe("left" + " ".repeat(31) + "right");
    expect(out.length).toBe(40);
  });

  test("SPACER_FLEX_RIGHT_ALIGN: leading spacer right-aligns content", () => {
    const d: Design = {
      version: 1,
      name: "F",
      elements: [
        { id: "sp", type: "spacer", mode: "flex", style: {} },
        { id: "1", type: "static", text: "tail", style: {} },
      ],
    };
    const out = stripAnsi(renderToAnsi(d, TW(40)));
    // 40 - 4 = 36 leading spaces
    expect(out).toBe(" ".repeat(36) + "tail");
    expect(out.length).toBe(40);
  });

  test("SPACER_FLEX_LEFT_ALIGN: trailing spacer is a no-op (no padding emitted)", () => {
    const d: Design = {
      version: 1,
      name: "F",
      elements: [
        { id: "1", type: "static", text: "head", style: {} },
        { id: "sp", type: "spacer", mode: "flex", style: {} },
      ],
    };
    const out = stripAnsi(renderToAnsi(d, TW(40)));
    expect(out).toBe("head");
  });

  test("SPACER_FLEX_CENTERED: two flex spacers split slack evenly", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        { id: "1", type: "static", text: "L", style: {} },
        { id: "sp1", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "C", style: {} },
        { id: "sp2", type: "spacer", mode: "flex", style: {} },
        { id: "3", type: "static", text: "R", style: {} },
      ],
    };
    // 40 cols, content = 3 chars, remaining = 37, split into 2: 19 + 18 (extra to first)
    const out = stripAnsi(renderToAnsi(d, TW(40)));
    expect(out.length).toBe(40);
    expect(out.startsWith("L")).toBe(true);
    expect(out.endsWith("R")).toBe(true);
    const cIdx = out.indexOf("C");
    const leftPad = cIdx - 1; // after "L"
    const rightPad = out.length - cIdx - 2; // before "R"
    // Even split with leftover-distribute-first means leftPad >= rightPad
    // and diff at most 1.
    expect(Math.abs(leftPad - rightPad)).toBeLessThanOrEqual(1);
    expect(leftPad + rightPad).toBe(37);
  });

  test("SPACER_FLEX_PER_DECK: each deck resolves its own flex independently", () => {
    const d: Design = {
      version: 1,
      name: "P",
      elements: [
        { id: "1", type: "static", text: "A", style: {} },
        { id: "sp1", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "B", style: {} },
        { id: "lb", type: "lineBreak", style: {} },
        { id: "3", type: "static", text: "CC", style: {} },
        { id: "sp2", type: "spacer", mode: "flex", style: {} },
        { id: "4", type: "static", text: "DD", style: {} },
      ],
    };
    const out = stripAnsi(renderToAnsi(d, TW(20)));
    const [first, second] = out.split("\n");
    expect(first).toBe("A" + " ".repeat(18) + "B");
    expect(second).toBe("CC" + " ".repeat(16) + "DD");
    expect(first!.length).toBe(20);
    expect(second!.length).toBe(20);
  });

  test("SPACER_FLEX_OVERFLOW: no negative padding when content > cols", () => {
    const d: Design = {
      version: 1,
      name: "O",
      elements: [
        { id: "1", type: "static", text: "a-very-long-string", style: {} },
        { id: "sp", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "tail", style: {} },
      ],
    };
    // 10 cols — way smaller than content (~22 chars total)
    const out = stripAnsi(renderToAnsi(d, TW(10)));
    // Should emit content with ZERO padding, never crash.
    expect(out).toBe("a-very-long-stringtail");
  });

  test("SPACER_FIXED inside flex layout counts toward chunk width", () => {
    const d: Design = {
      version: 1,
      name: "MIX",
      elements: [
        { id: "1", type: "static", text: "L", style: {} },
        { id: "sp1", type: "spacer", mode: "fixed", width: 2, style: {} },
        { id: "2", type: "static", text: "L2", style: {} },
        { id: "sp2", type: "spacer", mode: "flex", style: {} },
        { id: "3", type: "static", text: "R", style: {} },
      ],
    };
    // Left chunk visible width: "L  L2" = 5. Right: "R" = 1. Cols 20 → pad 14.
    const out = stripAnsi(renderToAnsi(d, TW(20)));
    expect(out).toBe("L  L2" + " ".repeat(14) + "R");
    expect(out.length).toBe(20);
  });

  test("compileToOps emits flexSpacer / fixedSpacer ops", () => {
    const d: Design = {
      version: 1,
      name: "X",
      elements: [
        { id: "sp1", type: "spacer", mode: "fixed", width: 3, style: {} },
        { id: "sp2", type: "spacer", mode: "flex", style: {} },
      ],
    };
    const ops = compileToOps(d);
    expect(ops[0]).toEqual({ op: "fixedSpacer", width: 3, char: " " });
    expect(ops[1]).toEqual({ op: "flexSpacer", char: " " });
  });
});

describe.skipIf(!HAS_BASH)("spacer bash parity", () => {
  test("SPACER_FLEX bash parity (STATUSLINE_COLS=40)", () => {
    const d: Design = {
      version: 1,
      name: "F",
      elements: [
        { id: "1", type: "static", text: "left", style: {} },
        { id: "sp", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "right", style: {} },
      ],
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify({}),
      encoding: "utf8",
      env: { ...process.env, STATUSLINE_COLS: "40" },
    });
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout)).toBe("left" + " ".repeat(31) + "right");
  });

  test("SPACER_FIXED bash parity", () => {
    const d: Design = {
      version: 1,
      name: "FX",
      elements: [
        { id: "1", type: "static", text: "A", style: {} },
        { id: "sp", type: "spacer", mode: "fixed", width: 5, char: "-", style: {} },
        { id: "2", type: "static", text: "B", style: {} },
      ],
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify({}),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout)).toBe("A-----B");
  });

  test("SPACER_FLEX_CENTERED bash parity (3 chars, 40 cols)", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        { id: "1", type: "static", text: "L", style: {} },
        { id: "sp1", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "C", style: {} },
        { id: "sp2", type: "spacer", mode: "flex", style: {} },
        { id: "3", type: "static", text: "R", style: {} },
      ],
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify({}),
      encoding: "utf8",
      env: { ...process.env, STATUSLINE_COLS: "40" },
    });
    expect(r.status).toBe(0);
    const out = stripAnsi(r.stdout);
    expect(out.length).toBe(40);
    expect(out.startsWith("L")).toBe(true);
    expect(out.endsWith("R")).toBe(true);
    expect(out.includes("C")).toBe(true);
  });

  test("SPACER_FLEX_OVERFLOW bash parity (no negative padding)", () => {
    const d: Design = {
      version: 1,
      name: "O",
      elements: [
        { id: "1", type: "static", text: "a-very-long-string", style: {} },
        { id: "sp", type: "spacer", mode: "flex", style: {} },
        { id: "2", type: "static", text: "tail", style: {} },
      ],
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify({}),
      encoding: "utf8",
      env: { ...process.env, STATUSLINE_COLS: "10" },
    });
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout)).toBe("a-very-long-stringtail");
  });
});

describe("rate-limit reset time + context absolute zones", () => {
  // Frozen baseline: 2026-05-25 00:00 UTC.
  const NOW = 1779484800;

  test("RATE_LIMIT_RESET: showResetTime appends T-<dur> suffix", () => {
    const d: Design = {
      version: 1,
      name: "R",
      elements: [
        {
          id: "p5",
          type: "rateLimit5hPct",
          style: {},
          suffix: "%",
          showResetTime: true,
        },
      ],
    };
    const prev = process.env.STATUSLINE_CLOCK_OVERRIDE;
    process.env.STATUSLINE_CLOCK_OVERRIDE = String(NOW);
    try {
      const ansi = renderToAnsi(d, {
        rate_limits: {
          five_hour: { used_percentage: 61, resets_at: NOW + 3700 },
        },
      });
      const stripped = stripAnsi(ansi);
      // 3700s == 1h 01m 40s; format "1h01m" (we drop seconds at >=1h).
      expect(stripped).toBe("61%T-1h01m");
    } finally {
      if (prev === undefined) delete process.env.STATUSLINE_CLOCK_OVERRIDE;
      else process.env.STATUSLINE_CLOCK_OVERRIDE = prev;
    }
  });

  test("RATE_LIMIT_RESET_PAST: emits no suffix when reset is in the past", () => {
    const d: Design = {
      version: 1,
      name: "R",
      elements: [
        {
          id: "p5",
          type: "rateLimit5hPct",
          style: {},
          suffix: "%",
          showResetTime: true,
        },
      ],
    };
    const prev = process.env.STATUSLINE_CLOCK_OVERRIDE;
    process.env.STATUSLINE_CLOCK_OVERRIDE = String(NOW);
    try {
      const ansi = renderToAnsi(d, {
        rate_limits: {
          five_hour: { used_percentage: 99, resets_at: NOW - 5 },
        },
      });
      const stripped = stripAnsi(ansi);
      expect(stripped).toBe("99%");
      expect(stripped).not.toContain("T-");
    } finally {
      if (prev === undefined) delete process.env.STATUSLINE_CLOCK_OVERRIDE;
      else process.env.STATUSLINE_CLOCK_OVERRIDE = prev;
    }
  });

  test("CONTEXT_ABSOLUTE_RED: tokens > orange threshold emits red SGR", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        { id: "b", type: "contextBar", width: 4, filledChar: "#", emptyChar: ".", style: {}, colorMode: "absolute" },
      ],
    };
    const ansi = renderToAnsi(d, {
      context_window: { used_percentage: 90, total_input_tokens: 180000 },
    });
    expect(ansi).toContain("\x1b[38;5;167m");
  });

  test("CONTEXT_ABSOLUTE_GREEN: tokens <= green threshold emits green SGR", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        { id: "b", type: "contextBar", width: 4, filledChar: "#", emptyChar: ".", style: {}, colorMode: "absolute" },
      ],
    };
    const ansi = renderToAnsi(d, {
      context_window: { used_percentage: 15, total_input_tokens: 30000 },
    });
    expect(ansi).toContain("\x1b[38;5;114m");
  });

  test("CONTEXT_STATIC_UNCHANGED: omitting colorMode renders identically to colorMode='static'", () => {
    const a: Design = {
      version: 1,
      name: "A",
      elements: [
        { id: "b", type: "contextBar", width: 6, filledChar: "#", emptyChar: ".", style: { fg: { kind: "ansi16", index: 12 } } },
      ],
    };
    const b: Design = {
      version: 1,
      name: "B",
      elements: [
        { id: "b", type: "contextBar", width: 6, filledChar: "#", emptyChar: ".", style: { fg: { kind: "ansi16", index: 12 } }, colorMode: "static" },
      ],
    };
    const input = { context_window: { used_percentage: 50, total_input_tokens: 100000 } };
    expect(renderToAnsi(a, input)).toBe(renderToAnsi(b, input));
  });

  test("CONTEXT_ABSOLUTE thresholds: respects custom thresholds", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        {
          id: "p",
          type: "contextPct",
          style: {},
          colorMode: "absolute",
          thresholds: { green: 100, yellow: 200, orange: 300 },
        },
      ],
    };
    expect(renderToAnsi(d, { context_window: { used_percentage: 1, total_input_tokens: 50 } })).toContain("\x1b[38;5;114m");
    expect(renderToAnsi(d, { context_window: { used_percentage: 1, total_input_tokens: 150 } })).toContain("\x1b[38;5;226m");
    expect(renderToAnsi(d, { context_window: { used_percentage: 1, total_input_tokens: 250 } })).toContain("\x1b[38;5;214m");
    expect(renderToAnsi(d, { context_window: { used_percentage: 1, total_input_tokens: 999 } })).toContain("\x1b[38;5;167m");
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

  test("lineBreak parity: stripped bash output includes the newline", () => {
    const script = compileToBash(MULTILINE);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify(DEFAULT_MOCK_STDIN),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const expected = stripAnsi(renderToAnsi(MULTILINE, DEFAULT_MOCK_STDIN));
    expect(stripAnsi(r.stdout)).toBe(expected);
    expect(stripAnsi(r.stdout)).toContain("\n");
  });

  test("lineBreak background-bleed parity: raw bash output contains \\x1b[0m\\n", () => {
    const script = compileToBash(MULTILINE_BG);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify(DEFAULT_MOCK_STDIN),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("\x1b[0m\n");
    const afterNl = r.stdout.slice(r.stdout.indexOf("\n") + 1);
    expect(afterNl.startsWith("\x1b[44m")).toBe(false);
  });

  test("rate limit reset-time parity (interpret vs bash, pinned clock)", () => {
    const NOW = 1779484800;
    const d: Design = {
      version: 1,
      name: "R",
      elements: [
        {
          id: "p5",
          type: "rateLimit5hPct",
          style: {},
          suffix: "%",
          showResetTime: true,
        },
      ],
    };
    const stdin = {
      rate_limits: { five_hour: { used_percentage: 61, resets_at: NOW + 3700 } },
    };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const prev = process.env.STATUSLINE_CLOCK_OVERRIDE;
    process.env.STATUSLINE_CLOCK_OVERRIDE = String(NOW);
    try {
      const r = spawnSync("bash", [path], {
        input: JSON.stringify(stdin),
        encoding: "utf8",
        env: { ...process.env, STATUSLINE_CLOCK_OVERRIDE: String(NOW) },
      });
      expect(r.status).toBe(0);
      const expected = stripAnsi(renderToAnsi(d, stdin));
      expect(stripAnsi(r.stdout)).toBe(expected);
      expect(stripAnsi(r.stdout)).toBe("61%T-1h01m");
    } finally {
      if (prev === undefined) delete process.env.STATUSLINE_CLOCK_OVERRIDE;
      else process.env.STATUSLINE_CLOCK_OVERRIDE = prev;
    }
  });

  test("context absolute mode parity (interpret vs bash, red zone)", () => {
    const d: Design = {
      version: 1,
      name: "C",
      elements: [
        { id: "b", type: "contextBar", width: 4, filledChar: "#", emptyChar: ".", style: {}, colorMode: "absolute" },
      ],
    };
    const stdin = { context_window: { used_percentage: 90, total_input_tokens: 180000 } };
    const script = compileToBash(d);
    const dir = mkdtempSync(join(tmpdir(), "sl-"));
    const path = join(dir, "sl.sh");
    writeFileSync(path, script);
    const r = spawnSync("bash", [path], {
      input: JSON.stringify(stdin),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(stripAnsi(r.stdout)).toBe(stripAnsi(renderToAnsi(d, stdin)));
    expect(r.stdout).toContain("\x1b[38;5;167m");
  });

  test("contextTokens parity across variants (interpret vs bash)", () => {
    const stdin = {
      context_window: {
        used_percentage: 47.2,
        total_input_tokens: 94400,
        context_window_size: 200000,
      },
    };
    const variants = ["ratio", "ratioPct", "used", "remaining"] as const;
    for (const variant of variants) {
      for (const compact of [true, false]) {
        const d: Design = {
          version: 1,
          name: "TD",
          elements: [
            { id: "t", type: "contextTokens", style: {}, variant, compact },
          ],
        };
        const script = compileToBash(d);
        const dir = mkdtempSync(join(tmpdir(), "sl-"));
        const path = join(dir, "sl.sh");
        writeFileSync(path, script);
        const r = spawnSync("bash", [path], {
          input: JSON.stringify(stdin),
          encoding: "utf8",
        });
        expect(r.status).toBe(0);
        expect(stripAnsi(r.stdout)).toBe(stripAnsi(renderToAnsi(d, stdin)));
      }
    }
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
