import type {
  AnsiColor,
  AnsiStyle,
  ConditionExpr,
  ContextThresholds,
  Design,
  Element,
  ElementRef,
  SegmentStyle,
  TokenDisplayVariant,
} from "../types";
import { DEFAULT_CONTEXT_THRESHOLDS } from "../types";

export type CwdTransform = "basename" | "tilde" | "raw" | "compact";
export type ComputeExpr =
  | "duration_human"
  | "duration_hms"
  | "cost_fmt"
  | "git_branch"
  | "git_dirty"
  | "relative_time";

// Token-zone palette (matches YAS). 256-color SGR.
export const CONTEXT_ZONE_COLORS: {
  green: AnsiColor;
  yellow: AnsiColor;
  orange: AnsiColor;
  red: AnsiColor;
} = {
  green: { kind: "ansi256", index: 114 },
  yellow: { kind: "ansi256", index: 226 },
  orange: { kind: "ansi256", index: 214 },
  red: { kind: "ansi256", index: 167 },
};

export type RenderOp =
  | { op: "literal"; text: string; style: AnsiStyle }
  | {
      op: "field";
      path: string;
      style: AnsiStyle;
      transform?: CwdTransform;
      truncate?: number;
    }
  | { op: "cond"; expr: ConditionExpr; then: RenderOp[]; else?: RenderOp[] }
  | {
      op: "progressBar";
      pctPath: string;
      width: number;
      filled: string;
      empty: string;
      style: AnsiStyle;
    }
  | {
      op: "split";
      sourceOp: RenderOp;
      delimiter: string;
      segments: SegmentStyle[];
      joinWith?: string;
    }
  | {
      op: "compute";
      expr: ComputeExpr;
      argPath?: string;
      precision?: number;
      style: AnsiStyle;
    }
  | {
      op: "rotator";
      items: string[];
      intervalSeconds: number;
      pickMode: "cycle" | "random";
      style: AnsiStyle;
    }
  | {
      op: "tokenDisplay";
      variant: TokenDisplayVariant;
      compact: boolean;
      style: AnsiStyle;
    }
  | { op: "lineBreak" }
  | { op: "fixedSpacer"; width: number; char: string }
  | { op: "flexSpacer"; char: string };

const wrap = (ops: RenderOp[], prefix?: string, suffix?: string, baseStyle?: AnsiStyle): RenderOp[] => {
  const out: RenderOp[] = [];
  if (prefix) out.push({ op: "literal", text: prefix, style: baseStyle ?? {} });
  out.push(...ops);
  if (suffix) out.push({ op: "literal", text: suffix, style: baseStyle ?? {} });
  return out;
};

function resolveRefToOp(ref: ElementRef, style: AnsiStyle): RenderOp {
  switch (ref.kind) {
    case "literal":
      return { op: "literal", text: ref.text, style };
    case "field":
      return { op: "field", path: ref.path, style };
    case "element":
      return { op: "literal", text: "", style };
  }
}

function withFg(base: AnsiStyle, fg: AnsiColor): AnsiStyle {
  return { ...base, fg };
}

/**
 * Lower an absolute-token color zone into a nested cond chain.
 * Picks color band based on `context_window.total_input_tokens` and
 * returns an op produced by `make` (parameterized by the styled fg).
 *
 * Predicates use `gt` (already supported) — semantically:
 *   tokens > orange → red
 *   tokens > yellow → orange
 *   tokens > green  → yellow
 *   else            → green
 */
function buildAbsoluteZoneCond(
  thresholds: ContextThresholds | undefined,
  baseStyle: AnsiStyle,
  make: (style: AnsiStyle) => RenderOp,
): RenderOp {
  const th = thresholds ?? DEFAULT_CONTEXT_THRESHOLDS;
  const field = "context_window.total_input_tokens";
  return {
    op: "cond",
    expr: { field, op: "gt", value: th.orange },
    then: [make(withFg(baseStyle, CONTEXT_ZONE_COLORS.red))],
    else: [
      {
        op: "cond",
        expr: { field, op: "gt", value: th.yellow },
        then: [make(withFg(baseStyle, CONTEXT_ZONE_COLORS.orange))],
        else: [
          {
            op: "cond",
            expr: { field, op: "gt", value: th.green },
            then: [make(withFg(baseStyle, CONTEXT_ZONE_COLORS.yellow))],
            else: [make(withFg(baseStyle, CONTEXT_ZONE_COLORS.green))],
          },
        ],
      },
    ],
  };
}

function elementToOps(el: Element): RenderOp[] {
  // lineBreak is a structural primitive: no prefix/suffix wrapping, no
  // styled context. It always emits a bare {op:"lineBreak"} so the
  // three backends can each follow it with their native reset+newline.
  if (el.type === "lineBreak") {
    const op: RenderOp = { op: "lineBreak" };
    if (el.showWhen) {
      return [{ op: "cond", expr: el.showWhen, then: [op] }];
    }
    return [op];
  }

  // Spacer is a structural primitive (like lineBreak). The flex variant
  // requires deck-aware partitioning at render time, so we emit a bare
  // marker op instead of wrapping it. Fixed spacers lower to a literal
  // run of `char` so they participate in left/right chunk width measurement
  // exactly like any other element.
  if (el.type === "spacer") {
    const ch = el.char && el.char.length > 0 ? el.char.slice(0, 1) : " ";
    let op: RenderOp;
    if (el.mode === "fixed") {
      const w = Math.max(
        0,
        Math.floor(typeof el.width === "number" ? el.width : 1),
      );
      op = { op: "fixedSpacer", width: w, char: ch };
    } else {
      op = { op: "flexSpacer", char: ch };
    }
    if (el.showWhen) {
      return [{ op: "cond", expr: el.showWhen, then: [op] }];
    }
    return [op];
  }

  const style = el.style;
  const inner: RenderOp[] = [];

  switch (el.type) {
    case "static":
      inner.push({ op: "literal", text: el.text, style });
      break;
    case "model":
      inner.push({ op: "field", path: "model.display_name", style });
      break;
    case "cwd": {
      const transform: CwdTransform =
        el.mode === "basename"
          ? "basename"
          : el.mode === "tilde"
            ? "tilde"
            : el.mode === "compact"
              ? "compact"
              : "raw";
      inner.push({
        op: "field",
        path: "workspace.current_dir",
        style,
        transform,
        truncate: el.maxLength,
      });
      break;
    }
    case "gitBranch":
      inner.push({ op: "compute", expr: "git_branch", style });
      break;
    case "gitStatus": {
      const dirtyStyle = el.dirtyStyle ?? style;
      const cleanStyle = el.cleanStyle ?? style;
      inner.push({
        op: "cond",
        expr: { field: "__computed.git_dirty", op: "eq", value: "1" },
        then: [{ op: "literal", text: el.dirtyText ?? "✗", style: dirtyStyle }],
        else: [{ op: "literal", text: el.cleanText ?? "✓", style: cleanStyle }],
      });
      break;
    }
    case "linesAdded":
      inner.push({ op: "field", path: "cost.total_lines_added", style });
      break;
    case "linesRemoved":
      inner.push({ op: "field", path: "cost.total_lines_removed", style });
      break;
    case "contextPct": {
      const fieldOp = (s: AnsiStyle): RenderOp => ({
        op: "field",
        path: "context_window.used_percentage",
        style: s,
      });
      if (el.colorMode === "absolute") {
        inner.push(buildAbsoluteZoneCond(el.thresholds, style, fieldOp));
      } else {
        inner.push(fieldOp(style));
      }
      break;
    }
    case "contextBar": {
      const barOp = (s: AnsiStyle): RenderOp => ({
        op: "progressBar",
        pctPath: "context_window.used_percentage",
        width: el.width,
        filled: el.filledChar,
        empty: el.emptyChar,
        style: s,
      });
      if (el.colorMode === "absolute") {
        inner.push(buildAbsoluteZoneCond(el.thresholds, style, barOp));
      } else {
        inner.push(barOp(style));
      }
      break;
    }
    case "contextTokens": {
      const tokenOp = (s: AnsiStyle): RenderOp => ({
        op: "tokenDisplay",
        variant: el.variant,
        compact: el.compact,
        style: s,
      });
      if (el.colorMode === "absolute") {
        inner.push(buildAbsoluteZoneCond(el.thresholds, style, tokenOp));
      } else {
        inner.push(tokenOp(style));
      }
      break;
    }
    case "rateLimit5hPct":
      inner.push({ op: "field", path: "rate_limits.five_hour.used_percentage", style });
      break;
    case "rateLimit5hBar":
      inner.push({
        op: "progressBar",
        pctPath: "rate_limits.five_hour.used_percentage",
        width: el.width,
        filled: el.filledChar,
        empty: el.emptyChar,
        style,
      });
      break;
    case "rateLimit7dPct":
      inner.push({ op: "field", path: "rate_limits.seven_day.used_percentage", style });
      break;
    case "rateLimit7dBar":
      inner.push({
        op: "progressBar",
        pctPath: "rate_limits.seven_day.used_percentage",
        width: el.width,
        filled: el.filledChar,
        empty: el.emptyChar,
        style,
      });
      break;
    case "cost":
      inner.push({
        op: "compute",
        expr: "cost_fmt",
        argPath: "cost.total_cost_usd",
        precision: el.precision,
        style,
      });
      break;
    case "sessionDuration":
      inner.push({
        op: "compute",
        expr: el.format === "hms" ? "duration_hms" : "duration_human",
        argPath: "cost.total_duration_ms",
        style,
      });
      break;
    case "glyph":
      inner.push({ op: "literal", text: el.char, style });
      break;
    case "separator":
      inner.push({ op: "literal", text: el.text, style });
      break;
    case "rotator":
      inner.push({
        op: "rotator",
        items: el.items,
        intervalSeconds: el.intervalSeconds,
        pickMode: el.pickMode,
        style,
      });
      break;
    case "thinkingEffort": {
      // Compare against the stringified boolean so falsy thinking.enabled is
      // hidden (the `exists` op cannot distinguish `false` from `true`).
      inner.push({
        op: "cond",
        expr: { field: "thinking.enabled", op: "eq", value: "true" },
        then: [{ op: "field", path: "effort.level", style }],
      });
      break;
    }
    case "outputStyle": {
      const fieldOp: RenderOp = {
        op: "field",
        path: "output_style.name",
        style,
      };
      if (el.alwaysShow) {
        inner.push(fieldOp);
      } else {
        // Show when output_style.name != "default". Implement via
        // `eq "default"` with then=[] and else=[fieldOp] so we don't need a
        // new ConditionExpr op variant.
        inner.push({
          op: "cond",
          expr: { field: "output_style.name", op: "eq", value: "default" },
          then: [],
          else: [fieldOp],
        });
      }
      break;
    }
    case "fastMode": {
      const text = el.text && el.text.length > 0 ? el.text : "⚡fast";
      // Compare against "true" (not `exists`) — both bash and the interpret
      // backend stringify a boolean field as "true"/"false", so `eq "true"`
      // correctly distinguishes `fast_mode: true` from `fast_mode: false`.
      inner.push({
        op: "cond",
        expr: { field: "fast_mode", op: "eq", value: "true" },
        then: [{ op: "literal", text, style }],
      });
      break;
    }
    case "segmentSplit": {
      const sourceOp = resolveRefToOp(el.source, style);
      inner.push({
        op: "split",
        sourceOp,
        delimiter: el.delimiter,
        segments: el.segments,
        joinWith: el.joinWith,
      });
      break;
    }
  }

  let ops = wrap(inner, el.prefix, el.suffix, style);

  // Append reset-time suffix AFTER the user's suffix, so a design with
  // `suffix: "%"` renders as "61%T-1h01m" rather than "61T-1h01m%".
  // The compute itself emits "T-…" only when the target is in the future,
  // and an empty string otherwise — so no stale "T-" artifacts.
  if (el.type === "rateLimit5hPct" && el.showResetTime) {
    ops = ops.concat({
      op: "compute",
      expr: "relative_time",
      argPath: "rate_limits.five_hour.resets_at",
      style,
    });
  } else if (el.type === "rateLimit7dPct" && el.showResetTime) {
    ops = ops.concat({
      op: "compute",
      expr: "relative_time",
      argPath: "rate_limits.seven_day.resets_at",
      style,
    });
  }

  if (el.showWhen) {
    ops = [{ op: "cond", expr: el.showWhen, then: ops }];
  }

  return ops;
}

export function compileToOps(design: Design): RenderOp[] {
  const out: RenderOp[] = [];
  for (const el of design.elements) {
    out.push(...elementToOps(el));
  }
  return out;
}
