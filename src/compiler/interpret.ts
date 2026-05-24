import { wrapWithStyle } from "../shared/ansi";
import { getField } from "../shared/mockStdin";
import type { ClaudeStdin } from "../shared/types";
import { compileToOps, type RenderOp } from "./ir";
import { renderBar } from "./progressBar";
import type { Design } from "../shared/types";

function basename(p: string): string {
  if (!p) return "";
  const m = p.match(/[^/\\]+$/);
  return m ? m[0] : p;
}

function tildify(p: string): string {
  if (!p) return "";
  return p.replace(/^\/(?:Users|home)\/[^/]+/, "~");
}

function truncate(s: string, n: number | undefined): string {
  if (!n || s.length <= n) return s;
  if (n <= 1) return s.slice(0, n);
  return s.slice(0, n - 1) + "…";
}

function formatCost(usd: number | undefined, precision: number): string {
  const n = typeof usd === "number" ? usd : 0;
  return `$${n.toFixed(precision)}`;
}

function formatDurationHms(ms: number | undefined): string {
  const total = Math.floor((ms ?? 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatDurationHuman(ms: number | undefined): string {
  const total = Math.floor((ms ?? 0) / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

function evalCondition(input: ClaudeStdin, expr: { field: string; op: string; value?: string | number }): boolean {
  const v = getField(input, expr.field);
  if (expr.op === "exists")
    return v !== undefined && v !== null && v !== "";
  if (v === undefined || v === null) return false;
  const cmpStr = String(v);
  const cmpNum = typeof v === "number" ? v : Number(v);
  if (expr.op === "eq") return cmpStr === String(expr.value);
  if (expr.op === "gt") return cmpNum > Number(expr.value);
  if (expr.op === "lt") return cmpNum < Number(expr.value);
  return false;
}

function fieldToString(
  input: ClaudeStdin,
  path: string,
  transform: "basename" | "tilde" | "raw" | undefined,
  truncateAt: number | undefined,
): string {
  const v = getField(input, path);
  let s: string;
  if (v === undefined || v === null) s = "";
  else if (typeof v === "number") s = String(v);
  else s = String(v);
  if (transform === "basename") s = basename(s);
  else if (transform === "tilde") s = tildify(s);
  return truncate(s, truncateAt);
}

function renderOps(ops: RenderOp[], input: ClaudeStdin): string {
  let out = "";
  for (const op of ops) {
    out += renderOp(op, input);
  }
  return out;
}

/**
 * Reads STATUSLINE_CLOCK_OVERRIDE (epoch seconds) from process.env if it
 * exists — used by parity tests to pin the clock so all three backends
 * produce identical rotator output. Browser preview falls through to
 * Date.now(), since process.env is undefined there.
 */
function nowSeconds(): number {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  const o = g.process?.env?.STATUSLINE_CLOCK_OVERRIDE;
  if (o) {
    const n = Number(o);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return Math.floor(Date.now() / 1000);
}

function renderOp(op: RenderOp, input: ClaudeStdin): string {
  switch (op.op) {
    case "literal":
      return wrapWithStyle(op.text, op.style);
    case "rotator": {
      if (op.items.length === 0) return "";
      const interval = Math.max(1, op.intervalSeconds);
      let idx: number;
      if (op.pickMode === "random") {
        idx = Math.floor(Math.random() * op.items.length);
      } else {
        idx = Math.floor(nowSeconds() / interval) % op.items.length;
      }
      return wrapWithStyle(op.items[idx]!, op.style);
    }
    case "field":
      return wrapWithStyle(
        fieldToString(input, op.path, op.transform, op.truncate),
        op.style,
      );
    case "cond": {
      const ok = evalCondition(input, op.expr);
      if (ok) return renderOps(op.then, input);
      return op.else ? renderOps(op.else, input) : "";
    }
    case "progressBar": {
      const raw = getField(input, op.pctPath);
      const pct = typeof raw === "number" ? raw : Number(raw) || 0;
      return wrapWithStyle(
        renderBar(pct, { width: op.width, filled: op.filled, empty: op.empty }),
        op.style,
      );
    }
    case "split": {
      const sourceText = stripStyleOnly(renderOp(op.sourceOp, input));
      if (sourceText === "") return "";
      const parts = sourceText.split(op.delimiter);
      const join = op.joinWith ?? op.delimiter;
      const segs = op.segments;
      const out: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const seg = segs[Math.min(i, segs.length - 1)]!;
        const piece = (seg.prefix ?? "") + parts[i]! + (seg.suffix ?? "");
        out.push(wrapWithStyle(piece, seg.style));
      }
      return out.join(join);
    }
    case "compute":
      return computeToString(op, input);
  }
}

function stripStyleOnly(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function computeToString(
  op: Extract<RenderOp, { op: "compute" }>,
  input: ClaudeStdin,
): string {
  let text = "";
  switch (op.expr) {
    case "duration_hms":
      text = formatDurationHms(getField(input, op.argPath ?? "cost.total_duration_ms") as number);
      break;
    case "duration_human":
      text = formatDurationHuman(getField(input, op.argPath ?? "cost.total_duration_ms") as number);
      break;
    case "cost_fmt":
      text = formatCost(
        getField(input, op.argPath ?? "cost.total_cost_usd") as number,
        op.precision ?? 2,
      );
      break;
    case "git_branch": {
      const wt = getField(input, "workspace.git_worktree");
      text = typeof wt === "string" ? wt : "";
      break;
    }
    case "git_dirty": {
      const wt = getField(input, "workspace.git_worktree");
      text = typeof wt === "string" && wt.length > 0 ? "1" : "0";
      break;
    }
  }
  return wrapWithStyle(text, op.style);
}

export function renderToAnsi(design: Design, input: ClaudeStdin): string {
  const ops = compileToOps(design);
  return renderOps(ops, input);
}

export { compileToOps };
