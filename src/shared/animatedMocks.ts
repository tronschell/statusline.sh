import type { ClaudeStdin } from "@statusline/shared/types";

/**
 * Pure tween over a baseline ClaudeStdin payload.
 *
 * Given `t` milliseconds into a `durationMs` window, returns a new mock with
 * a handful of fields drifting:
 * - `context_window.used_percentage` ramps linearly 12 → 89 over the window
 *   (clamped at the endpoints).
 * - `cost.total_cost_usd` ramps linearly 0 → 1.23 over the window.
 * - `cost.total_duration_ms` = `baseline + t` (ms wall-clock advance).
 * - `cost.total_lines_added` / `total_lines_removed` jitter slowly with a
 *   deterministic sine so consumers get a stable stream — no `Math.random`,
 *   no React, no timers. Pure function.
 *
 * The baseline is shallow-cloned per nested object; everything not listed
 * above passes through untouched.
 */
export function tweenMock(
  baseline: ClaudeStdin,
  t: number,
  durationMs: number,
): ClaudeStdin {
  const span = durationMs > 0 ? durationMs : 1;
  const u = Math.max(0, Math.min(1, t / span));

  const pct = lerp(12, 89, u);
  const cost = lerp(0, 1.23, u);

  const baseLinesAdded = baseline.cost?.total_lines_added ?? 0;
  const baseLinesRemoved = baseline.cost?.total_lines_removed ?? 0;
  // Slow sine-jitter ±8 lines on a ~2.4s period. Deterministic.
  const linesAdded =
    baseLinesAdded + Math.round(8 * Math.sin(t / 380));
  const linesRemoved =
    baseLinesRemoved + Math.round(6 * Math.sin(t / 520 + 1.3));

  const baseDuration = baseline.cost?.total_duration_ms ?? 0;

  return {
    ...baseline,
    cost: {
      ...(baseline.cost ?? {}),
      total_cost_usd: round(cost, 4),
      total_duration_ms: baseDuration + t,
      total_lines_added: Math.max(0, linesAdded),
      total_lines_removed: Math.max(0, linesRemoved),
    },
    context_window: {
      ...(baseline.context_window ?? {}),
      used_percentage: round(pct, 2),
      remaining_percentage: round(100 - pct, 2),
    },
  };
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

const GALLERY_BRANCHES = [
  "main",
  "dev",
  "feature/auth-refactor",
  "release/v2.0",
  "hotfix/oauth",
];

const GALLERY_MODELS: Array<{ id: string; display_name: string }> = [
  { id: "claude-opus-4-7", display_name: "Opus 4.7" },
  { id: "claude-sonnet-4-6", display_name: "Sonnet 4.6" },
  { id: "claude-haiku-4-5", display_name: "Haiku 4.5" },
];

const GALLERY_OUTPUT_STYLES = ["default", "explanatory", "concise", "learning"];
const GALLERY_EFFORTS = ["low", "medium", "high"];

/**
 * Looping gallery animation on top of `tweenMock`'s context/cost drift.
 *
 * On top of the baseline tween, this mutates fields that the static preview
 * never moves: branch name, model display name, output style, thinking
 * effort, fast-mode, and 5h/7d rate-limit percentages. Each rotates on its
 * own period so adjacent template cards don't synchronize.
 *
 * Pure / deterministic — same `(baseline, t)` always returns the same output.
 * No timers, no `Math.random`. Callers drive `t` via rAF.
 *
 * Periods chosen so a 36s scroll past the gallery sees each branch, model,
 * and style at least twice. Context % uses a sine wave (15 → 92 → 15) so the
 * bar visibly oscillates instead of climbing once and resetting.
 */
export function galleryMock(baseline: ClaudeStdin, t: number): ClaudeStdin {
  const safeT = Math.max(0, t);

  // Baseline drift (cost + lines) reuses tweenMock with a 12s window so the
  // cost line ramps and resets gracefully. Context % is overridden below
  // with a sine so it doesn't just monotonically climb.
  const drift = tweenMock(baseline, safeT % 12000, 12000);

  const branchIdx = Math.floor(safeT / 3200) % GALLERY_BRANCHES.length;
  const modelIdx = Math.floor(safeT / 5400) % GALLERY_MODELS.length;
  const styleIdx = Math.floor(safeT / 4100) % GALLERY_OUTPUT_STYLES.length;
  const effortIdx = Math.floor(safeT / 2700) % GALLERY_EFFORTS.length;

  // Fast-mode toggles roughly every 6.5s — long enough to read, short enough
  // to notice when the gallery is in view.
  const fastMode = Math.floor(safeT / 6500) % 2 === 1;

  // Context-window percentage climbs monotonically across a 14s window
  // then snaps back to the floor — simulating a fresh session. Never
  // decreases within a window so the bar/percentage always trends up.
  const CTX_PERIOD_MS = 14000;
  const ctxPhase = (safeT % CTX_PERIOD_MS) / CTX_PERIOD_MS;
  const ctxPct = clamp(round(5 + 91 * ctxPhase, 1), 5, 96);
  // Token totals proportional to ctxPct so contextTokens / contextBar agree.
  const ctxSize =
    baseline.context_window?.context_window_size ?? 200000;
  const usedTokens = Math.round((ctxPct / 100) * ctxSize);

  // Rate limit sweeps — slow, on different phases.
  const fiveHourPct = clamp(
    Math.round(45 + 38 * Math.sin(safeT / 1900)),
    4,
    95,
  );
  const sevenDayPct = clamp(
    Math.round(50 + 30 * Math.sin(safeT / 2600 + 1.4)),
    6,
    92,
  );

  const branch = GALLERY_BRANCHES[branchIdx] ?? "main";
  const model = GALLERY_MODELS[modelIdx] ?? GALLERY_MODELS[0]!;
  const style = GALLERY_OUTPUT_STYLES[styleIdx] ?? "default";
  const effort = GALLERY_EFFORTS[effortIdx] ?? "medium";

  return {
    ...drift,
    model: { ...(baseline.model ?? {}), ...model },
    workspace: {
      ...(baseline.workspace ?? {}),
      git_worktree: branch,
    },
    context_window: {
      ...(drift.context_window ?? {}),
      used_percentage: ctxPct,
      remaining_percentage: round(100 - ctxPct, 1),
      total_input_tokens: Math.max(0, usedTokens - 12000),
      total_output_tokens: 12000,
    },
    rate_limits: {
      five_hour: {
        ...(baseline.rate_limits?.five_hour ?? {}),
        used_percentage: fiveHourPct,
      },
      seven_day: {
        ...(baseline.rate_limits?.seven_day ?? {}),
        used_percentage: sevenDayPct,
      },
    },
    output_style: { name: style },
    effort: { level: effort },
    fast_mode: fastMode,
  };
}
