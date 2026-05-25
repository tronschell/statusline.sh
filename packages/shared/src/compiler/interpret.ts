import { SGR_RESET, stripAnsi, wrapWithStyle } from "../ansi";
import { getField } from "../mockStdin";
import type { ClaudeStdin } from "../types";
import { compileToOps, type RenderOp } from "./ir";
import { renderBar } from "./progressBar";
import type { Design } from "../types";

// Default browser-preview width when no _terminalWidth is present in
// mockStdin. Mirrors the bash/PowerShell fallback so previews stay close
// to what the user will see in their actual terminal.
const DEFAULT_TERMINAL_WIDTH = 120;

function basename(p: string): string {
  if (!p) return "";
  const m = p.match(/[^/\\]+$/);
  return m ? m[0] : p;
}

function tildify(p: string): string {
  if (!p) return "";
  return p.replace(/^\/(?:Users|home)\/[^/]+/, "~");
}

function compactPath(p: string): string {
  if (!p) return "";
  // Detect whether the path uses backslash or forward-slash separators.
  // Mirrors the bash/PS impls which only handle `/`; we additionally handle
  // `\\` for Windows-style cwds to match the interpret-side `basename` regex
  // which already accepts both.
  const sep = p.includes("\\") && !p.includes("/") ? "\\" : "/";
  // Preserve a leading separator (absolute paths) so "/home/user/x" stays
  // anchored at "/".
  const leading = p.startsWith(sep) ? sep : "";
  const trimmed = leading ? p.slice(1) : p;
  if (trimmed === "") return leading;
  const parts = trimmed.split(sep);
  if (parts.length <= 1) return p;
  const last = parts[parts.length - 1]!;
  const collapsed: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i]!;
    if (seg.length === 0) {
      collapsed.push("");
      continue;
    }
    collapsed.push(seg[0]!);
  }
  collapsed.push(last);
  return leading + collapsed.join(sep);
}

function truncate(s: string, n: number | undefined): string {
  if (!n || s.length <= n) return s;
  if (n <= 1) return s.slice(0, n);
  return s.slice(0, n - 1) + "…";
}

function toNonNegInt(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function fmtTokenCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const whole = Math.floor(n / 1000);
    const rem = n - whole * 1000;
    const dec = Math.floor(rem / 100);
    return dec === 0 ? `${whole}k` : `${whole}.${dec}k`;
  }
  const whole = Math.floor(n / 1_000_000);
  const rem = n - whole * 1_000_000;
  const dec = Math.floor(rem / 100_000);
  return dec === 0 ? `${whole}M` : `${whole}.${dec}M`;
}

function fmtTokenFull(n: number): string {
  return n.toLocaleString("en-US");
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

// YAS-style relative duration. Returns "Xs", "XmYYs", or "XhYYm".
function fmtRelDur(secs: number): string {
  const s = Math.floor(secs);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m${String(rem).padStart(2, "0")}s`;
  }
  const h = Math.floor(s / 3600);
  const rem = Math.floor((s % 3600) / 60);
  return `${h}h${String(rem).padStart(2, "0")}m`;
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
  transform: "basename" | "tilde" | "raw" | "compact" | undefined,
  truncateAt: number | undefined,
): string {
  const v = getField(input, path);
  let s: string;
  if (v === undefined || v === null) s = "";
  else if (typeof v === "number") s = String(v);
  else s = String(v);
  if (transform === "basename") s = basename(s);
  else if (transform === "tilde") s = tildify(s);
  else if (transform === "compact") s = compactPath(s);
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
 * Deck-aware rendering with flex-spacer resolution.
 *
 * Splits `ops` into deck slices at each {op:"lineBreak"}; for each deck
 * splits further at each {op:"flexSpacer"}. Renders each chunk with the
 * normal `renderOps`, measures visible widths (ANSI-stripped), then
 * concatenates `chunk1 + pad1 + chunk2 + pad2 + ... + chunkN` where each
 * pad equals `floor(remaining / spacerCount)` with any 1-char remainder
 * distributed to the first padding slots.
 *
 * Note: width counting uses character length, not grapheme width — wide
 * glyphs (emoji, CJK) are treated as 1 column. This matches what the
 * bash/PowerShell backends compute via `wc -m` / `.Length`.
 */
function renderOpsWithDecks(ops: RenderOp[], input: ClaudeStdin): string {
  const cols = resolveTerminalWidth(input);

  // 1. Partition by lineBreak into deck slices. The lineBreak op itself
  //    is preserved (renders as "\x1b[0m\n") and emitted between decks.
  const decks: RenderOp[][] = [[]];
  for (const op of ops) {
    if (op.op === "lineBreak") {
      decks.push([]);
    } else {
      decks[decks.length - 1]!.push(op);
    }
  }

  let out = "";
  for (let d = 0; d < decks.length; d++) {
    out += renderDeck(decks[d]!, input, cols);
    if (d < decks.length - 1) {
      // Emit the same byte sequence that {op:"lineBreak"} produces, so
      // the boundary contract (reset-then-newline) is preserved.
      out += `${SGR_RESET}\n`;
    }
  }
  return out;
}

function renderDeck(
  deckOps: RenderOp[],
  input: ClaudeStdin,
  cols: number,
): string {
  // Fast path: no flex spacer in this deck → render straight through.
  const hasFlex = deckOps.some((op) => op.op === "flexSpacer");
  if (!hasFlex) return renderOps(deckOps, input);

  // Partition into chunks separated by flexSpacer markers.
  const chunks: RenderOp[][] = [[]];
  const spacerChars: string[] = [];
  for (const op of deckOps) {
    if (op.op === "flexSpacer") {
      spacerChars.push(op.char);
      chunks.push([]);
    } else {
      chunks[chunks.length - 1]!.push(op);
    }
  }

  const rendered = chunks.map((c) => renderOps(c, input));
  const widths = rendered.map((s) => stripAnsi(s).length);
  const contentWidth = widths.reduce((a, b) => a + b, 0);

  // Drop trailing flex spacer entirely (no right chunk to push toward).
  // A trailing empty chunk means the last spacer was at end-of-line.
  let activeSpacerCount = spacerChars.length;
  let lastChunkIdx = rendered.length - 1;
  if (
    activeSpacerCount > 0 &&
    rendered[lastChunkIdx]!.length === 0 &&
    widths[lastChunkIdx] === 0
  ) {
    // Trailing flex spacer — no content after it, so it would pad past
    // the terminal edge for nothing. Drop both the empty chunk and the
    // spacer that introduced it.
    activeSpacerCount--;
    lastChunkIdx--;
  }

  const remaining = Math.max(0, cols - contentWidth);
  const baseEach =
    activeSpacerCount > 0 ? Math.floor(remaining / activeSpacerCount) : 0;
  const leftover =
    activeSpacerCount > 0 ? remaining - baseEach * activeSpacerCount : 0;

  let out = "";
  let spacerSeen = 0;
  for (let i = 0; i <= lastChunkIdx; i++) {
    out += rendered[i]!;
    if (i < lastChunkIdx) {
      // The chunk at index i is followed by spacer #i (spacerChars[i]).
      // Spacers beyond activeSpacerCount won't be reached because we
      // capped lastChunkIdx above.
      const padCount = baseEach + (spacerSeen < leftover ? 1 : 0);
      spacerSeen++;
      if (padCount > 0) {
        const ch = spacerChars[i] ?? " ";
        out += ch.repeat(padCount);
      }
    }
  }
  return out;
}

function resolveTerminalWidth(input: ClaudeStdin): number {
  const raw = (input as { _terminalWidth?: unknown })._terminalWidth;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_TERMINAL_WIDTH;
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
    case "tokenDisplay": {
      const used = toNonNegInt(getField(input, "context_window.total_input_tokens"));
      const total = toNonNegInt(getField(input, "context_window.context_window_size"));
      const remaining = Math.max(0, total - used);
      const pct = Math.floor(
        ((): number => {
          const raw = getField(input, "context_window.used_percentage");
          const n = typeof raw === "number" ? raw : Number(raw);
          return Number.isFinite(n) && n >= 0 ? n : 0;
        })(),
      );
      const fmt = op.compact ? fmtTokenCompact : fmtTokenFull;
      let text = "";
      switch (op.variant) {
        case "used":
          text = fmt(used);
          break;
        case "remaining":
          text = fmt(remaining);
          break;
        case "ratio":
          text = `${fmt(used)}/${fmt(total)}`;
          break;
        case "ratioPct":
          text = `${fmt(used)}/${fmt(total)} (${pct}%)`;
          break;
      }
      return wrapWithStyle(text, op.style);
    }
    case "lineBreak":
      // Reset SGR state THEN emit newline so element-level or
      // design-level background colors do not bleed past the line.
      return `${SGR_RESET}\n`;
    case "fixedSpacer":
      return op.width > 0 ? op.char.repeat(op.width) : "";
    case "flexSpacer":
      // Flex spacers are resolved per-deck in renderOpsWithDecks. This
      // branch is unreachable in the top-level render path; for nested
      // calls (e.g. inside a cond), we have nothing to push against, so
      // emit nothing rather than producing inconsistent padding.
      return "";
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
    case "relative_time": {
      const raw = getField(input, op.argPath ?? "");
      const target =
        typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(target)) {
        text = "";
        break;
      }
      const secs = target - nowSeconds();
      text = secs <= 0 ? "" : `T-${fmtRelDur(secs)}`;
      break;
    }
  }
  return wrapWithStyle(text, op.style);
}

export function renderToAnsi(design: Design, input: ClaudeStdin): string {
  const ops = compileToOps(design);
  return renderOpsWithDecks(ops, input);
}

export { compileToOps };
