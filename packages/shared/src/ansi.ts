import type { AnsiColor, AnsiStyle } from "./types";

export const ESC = "";
export const SGR_RESET = `${ESC}[0m`;

const ANSI16_FG = [30, 31, 32, 33, 34, 35, 36, 37, 90, 91, 92, 93, 94, 95, 96, 97];
const ANSI16_BG = [40, 41, 42, 43, 44, 45, 46, 47, 100, 101, 102, 103, 104, 105, 106, 107];

export const ANSI16_HEX: Record<number, string> = {
  0: "#000000", 1: "#cc0000", 2: "#4e9a06", 3: "#c4a000",
  4: "#3465a4", 5: "#75507b", 6: "#06989a", 7: "#d3d7cf",
  8: "#555753", 9: "#ef2929", 10: "#8ae234", 11: "#fce94f",
  12: "#729fcf", 13: "#ad7fa8", 14: "#34e2e2", 15: "#eeeeec",
};

export function ansi256ToRgb(idx: number): [number, number, number] {
  if (idx < 0 || idx > 255) return [0, 0, 0];
  if (idx < 16) {
    const hex = ANSI16_HEX[idx]!;
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  if (idx < 232) {
    const n = idx - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;
    const lvl = (c: number) => (c === 0 ? 0 : 55 + c * 40);
    return [lvl(r), lvl(g), lvl(b)];
  }
  const v = 8 + (idx - 232) * 10;
  return [v, v, v];
}

function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`;
}

export function colorToCss(c: AnsiColor | undefined, isFg: boolean): string | undefined {
  if (!c) return undefined;
  switch (c.kind) {
    case "default":
      return undefined;
    case "ansi16":
      return ANSI16_HEX[c.index] ?? (isFg ? "#cccccc" : undefined);
    case "ansi256": {
      const [r, g, b] = ansi256ToRgb(c.index);
      return rgbToCss(r, g, b);
    }
    case "rgb":
      return rgbToCss(c.r, c.g, c.b);
  }
}

export function colorToSgrCodes(c: AnsiColor | undefined, isFg: boolean): string[] {
  if (!c) return [];
  switch (c.kind) {
    case "default":
      return [isFg ? "39" : "49"];
    case "ansi16":
      return [String((isFg ? ANSI16_FG : ANSI16_BG)[c.index] ?? (isFg ? 39 : 49))];
    case "ansi256":
      return [isFg ? "38" : "48", "5", String(c.index)];
    case "rgb":
      return [
        isFg ? "38" : "48",
        "2",
        String(c.r),
        String(c.g),
        String(c.b),
      ];
  }
}

export function styleToSgr(s: AnsiStyle | undefined): string {
  if (!s) return "";
  const codes: string[] = [];
  if (s.bold) codes.push("1");
  if (s.dim) codes.push("2");
  if (s.italic) codes.push("3");
  if (s.underline) codes.push("4");
  if (s.fg) codes.push(...colorToSgrCodes(s.fg, true));
  if (s.bg) codes.push(...colorToSgrCodes(s.bg, false));
  if (codes.length === 0) return "";
  return `${ESC}[${codes.join(";")}m`;
}

export function wrapWithStyle(text: string, s: AnsiStyle | undefined): string {
  if (!s || (!s.bold && !s.dim && !s.italic && !s.underline && !s.fg && !s.bg))
    return text;
  return `${styleToSgr(s)}${text}${SGR_RESET}`;
}

export function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, "");
}

export interface HtmlSegment {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  underline?: boolean;
}

interface ParserState {
  fg?: string;
  bg?: string;
  bold: boolean;
  italic: boolean;
  dim: boolean;
  underline: boolean;
}

function emptyState(): ParserState {
  return { bold: false, italic: false, dim: false, underline: false };
}

function applyCodes(state: ParserState, codes: number[]): ParserState {
  const s = { ...state };
  let i = 0;
  while (i < codes.length) {
    const c = codes[i]!;
    if (c === 0) {
      i++;
      Object.assign(s, emptyState());
      s.fg = undefined;
      s.bg = undefined;
      continue;
    }
    if (c === 1) { s.bold = true; i++; continue; }
    if (c === 2) { s.dim = true; i++; continue; }
    if (c === 3) { s.italic = true; i++; continue; }
    if (c === 4) { s.underline = true; i++; continue; }
    if (c === 22) { s.bold = false; s.dim = false; i++; continue; }
    if (c === 23) { s.italic = false; i++; continue; }
    if (c === 24) { s.underline = false; i++; continue; }
    if (c === 39) { s.fg = undefined; i++; continue; }
    if (c === 49) { s.bg = undefined; i++; continue; }
    if (c >= 30 && c <= 37) {
      s.fg = ANSI16_HEX[c - 30];
      i++;
      continue;
    }
    if (c >= 90 && c <= 97) {
      s.fg = ANSI16_HEX[c - 90 + 8];
      i++;
      continue;
    }
    if (c >= 40 && c <= 47) {
      s.bg = ANSI16_HEX[c - 40];
      i++;
      continue;
    }
    if (c >= 100 && c <= 107) {
      s.bg = ANSI16_HEX[c - 100 + 8];
      i++;
      continue;
    }
    if (c === 38 || c === 48) {
      const isFg = c === 38;
      const mode = codes[i + 1];
      if (mode === 5) {
        const idx = codes[i + 2] ?? 0;
        const [r, g, b] = ansi256ToRgb(idx);
        if (isFg) s.fg = rgbToCss(r, g, b);
        else s.bg = rgbToCss(r, g, b);
        i += 3;
        continue;
      }
      if (mode === 2) {
        const r = codes[i + 2] ?? 0;
        const g = codes[i + 3] ?? 0;
        const b = codes[i + 4] ?? 0;
        if (isFg) s.fg = rgbToCss(r, g, b);
        else s.bg = rgbToCss(r, g, b);
        i += 5;
        continue;
      }
      i++;
      continue;
    }
    i++;
  }
  return s;
}

export function parseAnsi(input: string): HtmlSegment[] {
  const result: HtmlSegment[] = [];
  let state = emptyState();
  let buf = "";
  let i = 0;
  const flush = () => {
    if (!buf) return;
    result.push({
      text: buf,
      fg: state.fg,
      bg: state.bg,
      bold: state.bold || undefined,
      italic: state.italic || undefined,
      dim: state.dim || undefined,
      underline: state.underline || undefined,
    });
    buf = "";
  };
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === ESC && input[i + 1] === "[") {
      const end = input.indexOf("m", i + 2);
      if (end === -1) {
        buf += ch;
        i++;
        continue;
      }
      flush();
      const seq = input.slice(i + 2, end);
      const codes = seq === ""
        ? [0]
        : seq.split(";").map((p) => parseInt(p, 10) || 0);
      state = applyCodes(state, codes);
      i = end + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return result;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function segmentToStyle(seg: HtmlSegment): string {
  const parts: string[] = [];
  if (seg.fg) parts.push(`color:${seg.fg}`);
  if (seg.bg) parts.push(`background:${seg.bg}`);
  if (seg.bold) parts.push("font-weight:700");
  if (seg.italic) parts.push("font-style:italic");
  if (seg.dim) parts.push("opacity:0.6");
  if (seg.underline) parts.push("text-decoration:underline");
  return parts.join(";");
}
