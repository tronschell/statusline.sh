import type { ClaudeStdin } from "./types";

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
