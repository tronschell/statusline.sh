import type {
  AnsiStyle,
  ConditionExpr,
  Design,
  Element,
  ElementRef,
  SegmentStyle,
} from "../types";

export type CwdTransform = "basename" | "tilde" | "raw";
export type ComputeExpr =
  | "duration_human"
  | "duration_hms"
  | "cost_fmt"
  | "git_branch"
  | "git_dirty";

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
    };

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

function elementToOps(el: Element): RenderOp[] {
  const style = el.style;
  const inner: RenderOp[] = [];

  switch (el.type) {
    case "static":
      inner.push({ op: "literal", text: el.text, style });
      break;
    case "model":
      inner.push({ op: "field", path: "model.display_name", style });
      break;
    case "cwd":
      inner.push({
        op: "field",
        path: "workspace.current_dir",
        style,
        transform: el.mode === "basename" ? "basename" : el.mode === "tilde" ? "tilde" : "raw",
        truncate: el.maxLength,
      });
      break;
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
    case "contextPct":
      inner.push({ op: "field", path: "context_window.used_percentage", style });
      break;
    case "contextBar":
      inner.push({
        op: "progressBar",
        pctPath: "context_window.used_percentage",
        width: el.width,
        filled: el.filledChar,
        empty: el.emptyChar,
        style,
      });
      break;
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
