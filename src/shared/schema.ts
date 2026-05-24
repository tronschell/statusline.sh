import type {
  AnsiColor,
  AnsiStyle,
  ConditionExpr,
  Design,
  Element,
  ElementRef,
  ElementType,
  SegmentStyle,
} from "./types";

export class ValidationError extends Error {
  path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ELEMENT_TYPES: ReadonlyArray<ElementType> = [
  "static",
  "model",
  "cwd",
  "gitBranch",
  "gitStatus",
  "linesAdded",
  "linesRemoved",
  "contextPct",
  "contextBar",
  "cost",
  "sessionDuration",
  "glyph",
  "separator",
  "rotator",
  "segmentSplit",
];

function vColor(v: unknown, path: string): AnsiColor {
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  const kind = v.kind;
  switch (kind) {
    case "default":
      return { kind: "default" };
    case "ansi16": {
      const idx = v.index;
      if (typeof idx !== "number" || idx < 0 || idx > 15)
        throw new ValidationError(path + ".index", "expected 0..15");
      return { kind: "ansi16", index: idx };
    }
    case "ansi256": {
      const idx = v.index;
      if (typeof idx !== "number" || idx < 0 || idx > 255)
        throw new ValidationError(path + ".index", "expected 0..255");
      return { kind: "ansi256", index: idx };
    }
    case "rgb": {
      const r = v.r, g = v.g, b = v.b;
      if (
        typeof r !== "number" || typeof g !== "number" || typeof b !== "number"
        || r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255
      )
        throw new ValidationError(path, "rgb requires {r,g,b} in 0..255");
      return { kind: "rgb", r, g, b };
    }
    default:
      throw new ValidationError(path + ".kind", `unknown color kind: ${String(kind)}`);
  }
}

function vStyle(v: unknown, path: string): AnsiStyle {
  if (v === undefined) return {};
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  const out: AnsiStyle = {};
  if (v.fg !== undefined) out.fg = vColor(v.fg, path + ".fg");
  if (v.bg !== undefined) out.bg = vColor(v.bg, path + ".bg");
  for (const k of ["bold", "italic", "dim", "underline"] as const) {
    if (v[k] !== undefined) {
      if (typeof v[k] !== "boolean")
        throw new ValidationError(`${path}.${k}`, "expected boolean");
      out[k] = v[k] as boolean;
    }
  }
  return out;
}

function vCondition(v: unknown, path: string): ConditionExpr {
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  if (typeof v.field !== "string")
    throw new ValidationError(path + ".field", "expected string");
  if (v.op === "exists") return { field: v.field, op: "exists" };
  if (v.op === "gt" || v.op === "lt" || v.op === "eq") {
    if (typeof v.value !== "string" && typeof v.value !== "number")
      throw new ValidationError(path + ".value", "expected string | number");
    return { field: v.field, op: v.op, value: v.value };
  }
  throw new ValidationError(path + ".op", `unknown op: ${String(v.op)}`);
}

function vSegmentStyle(v: unknown, path: string): SegmentStyle {
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  const out: SegmentStyle = { style: vStyle(v.style, path + ".style") };
  if (v.prefix !== undefined) {
    if (typeof v.prefix !== "string")
      throw new ValidationError(path + ".prefix", "expected string");
    out.prefix = v.prefix;
  }
  if (v.suffix !== undefined) {
    if (typeof v.suffix !== "string")
      throw new ValidationError(path + ".suffix", "expected string");
    out.suffix = v.suffix;
  }
  return out;
}

function vElementRef(v: unknown, path: string): ElementRef {
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  switch (v.kind) {
    case "literal":
      if (typeof v.text !== "string")
        throw new ValidationError(path + ".text", "expected string");
      return { kind: "literal", text: v.text };
    case "field":
      if (typeof v.path !== "string")
        throw new ValidationError(path + ".path", "expected string");
      return { kind: "field", path: v.path };
    case "element":
      if (typeof v.refId !== "string")
        throw new ValidationError(path + ".refId", "expected string");
      return { kind: "element", refId: v.refId };
    default:
      throw new ValidationError(path + ".kind", `unknown ref kind: ${String(v.kind)}`);
  }
}

function vBaseFields(v: Record<string, unknown>, path: string) {
  if (typeof v.id !== "string")
    throw new ValidationError(path + ".id", "expected string");
  const base = {
    id: v.id,
    style: vStyle(v.style, path + ".style"),
  } as { id: string; style: AnsiStyle; prefix?: string; suffix?: string; maxLength?: number; showWhen?: ConditionExpr };
  if (v.prefix !== undefined) {
    if (typeof v.prefix !== "string")
      throw new ValidationError(path + ".prefix", "expected string");
    base.prefix = v.prefix;
  }
  if (v.suffix !== undefined) {
    if (typeof v.suffix !== "string")
      throw new ValidationError(path + ".suffix", "expected string");
    base.suffix = v.suffix;
  }
  if (v.maxLength !== undefined) {
    if (typeof v.maxLength !== "number" || v.maxLength < 0)
      throw new ValidationError(path + ".maxLength", "expected non-negative number");
    base.maxLength = v.maxLength;
  }
  if (v.showWhen !== undefined) {
    base.showWhen = vCondition(v.showWhen, path + ".showWhen");
  }
  return base;
}

function vElement(v: unknown, path: string): Element {
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  const t = v.type;
  if (typeof t !== "string" || !ELEMENT_TYPES.includes(t as ElementType))
    throw new ValidationError(path + ".type", `unknown element type: ${String(t)}`);
  const base = vBaseFields(v, path);
  switch (t as ElementType) {
    case "static": {
      if (typeof v.text !== "string")
        throw new ValidationError(path + ".text", "expected string");
      return { ...base, type: "static", text: v.text };
    }
    case "model":
      return { ...base, type: "model" };
    case "cwd": {
      if (v.mode !== "basename" && v.mode !== "full" && v.mode !== "tilde")
        throw new ValidationError(path + ".mode", "expected basename|full|tilde");
      return { ...base, type: "cwd", mode: v.mode };
    }
    case "gitBranch":
      return { ...base, type: "gitBranch" };
    case "gitStatus": {
      const out: Element = { ...base, type: "gitStatus" };
      if (v.dirtyText !== undefined) {
        if (typeof v.dirtyText !== "string")
          throw new ValidationError(path + ".dirtyText", "expected string");
        out.dirtyText = v.dirtyText;
      }
      if (v.cleanText !== undefined) {
        if (typeof v.cleanText !== "string")
          throw new ValidationError(path + ".cleanText", "expected string");
        out.cleanText = v.cleanText;
      }
      if (v.dirtyStyle !== undefined) out.dirtyStyle = vStyle(v.dirtyStyle, path + ".dirtyStyle");
      if (v.cleanStyle !== undefined) out.cleanStyle = vStyle(v.cleanStyle, path + ".cleanStyle");
      return out;
    }
    case "linesAdded":
      return { ...base, type: "linesAdded" };
    case "linesRemoved":
      return { ...base, type: "linesRemoved" };
    case "contextPct":
      return { ...base, type: "contextPct" };
    case "contextBar": {
      if (typeof v.width !== "number" || v.width < 1)
        throw new ValidationError(path + ".width", "expected positive number");
      if (typeof v.filledChar !== "string" || v.filledChar.length === 0)
        throw new ValidationError(path + ".filledChar", "expected non-empty string");
      if (typeof v.emptyChar !== "string" || v.emptyChar.length === 0)
        throw new ValidationError(path + ".emptyChar", "expected non-empty string");
      return {
        ...base,
        type: "contextBar",
        width: v.width,
        filledChar: v.filledChar,
        emptyChar: v.emptyChar,
      };
    }
    case "cost": {
      const p = v.precision;
      if (typeof p !== "number" || p < 0 || p > 6)
        throw new ValidationError(path + ".precision", "expected 0..6");
      return { ...base, type: "cost", precision: p };
    }
    case "sessionDuration": {
      if (v.format !== "hms" && v.format !== "human")
        throw new ValidationError(path + ".format", "expected hms|human");
      return { ...base, type: "sessionDuration", format: v.format };
    }
    case "glyph": {
      if (typeof v.char !== "string" || v.char.length === 0)
        throw new ValidationError(path + ".char", "expected non-empty string");
      return { ...base, type: "glyph", char: v.char };
    }
    case "separator": {
      if (typeof v.text !== "string")
        throw new ValidationError(path + ".text", "expected string");
      return { ...base, type: "separator", text: v.text };
    }
    case "rotator": {
      if (!Array.isArray(v.items) || v.items.length === 0)
        throw new ValidationError(path + ".items", "expected non-empty array");
      const items = v.items.map((it, i) => {
        if (typeof it !== "string")
          throw new ValidationError(`${path}.items[${i}]`, "expected string");
        return it;
      });
      if (typeof v.intervalSeconds !== "number" || v.intervalSeconds < 1)
        throw new ValidationError(
          path + ".intervalSeconds",
          "expected number >= 1",
        );
      if (v.pickMode !== "cycle" && v.pickMode !== "random")
        throw new ValidationError(path + ".pickMode", "expected cycle|random");
      return {
        ...base,
        type: "rotator",
        items,
        intervalSeconds: v.intervalSeconds,
        pickMode: v.pickMode,
      };
    }
    case "segmentSplit": {
      const source = vElementRef(v.source, path + ".source");
      if (typeof v.delimiter !== "string" || v.delimiter.length === 0)
        throw new ValidationError(path + ".delimiter", "expected non-empty string");
      if (!Array.isArray(v.segments))
        throw new ValidationError(path + ".segments", "expected array");
      const segments = v.segments.map((s, i) =>
        vSegmentStyle(s, `${path}.segments[${i}]`),
      );
      const out: Element = {
        ...base,
        type: "segmentSplit",
        source,
        delimiter: v.delimiter,
        segments,
      };
      if (v.joinWith !== undefined) {
        if (typeof v.joinWith !== "string")
          throw new ValidationError(path + ".joinWith", "expected string");
        out.joinWith = v.joinWith;
      }
      return out;
    }
  }
}

export function validateDesign(raw: unknown): Design {
  if (!isObj(raw)) throw new ValidationError("$", "expected object");
  if (raw.version !== 1)
    throw new ValidationError("$.version", "expected 1");
  if (typeof raw.name !== "string")
    throw new ValidationError("$.name", "expected string");
  if (!Array.isArray(raw.elements))
    throw new ValidationError("$.elements", "expected array");

  const elements = raw.elements.map((el, i) =>
    vElement(el, `$.elements[${i}]`),
  );

  const out: Design = { version: 1, name: raw.name, elements };

  if (raw.refreshInterval !== undefined) {
    if (typeof raw.refreshInterval !== "number" || raw.refreshInterval < 0)
      throw new ValidationError("$.refreshInterval", "expected non-negative number");
    out.refreshInterval = raw.refreshInterval;
  }
  if (raw.background !== undefined)
    out.background = vColor(raw.background, "$.background");

  return out;
}

export function safeValidateDesign(
  raw: unknown,
): { ok: true; design: Design } | { ok: false; error: ValidationError } {
  try {
    return { ok: true, design: validateDesign(raw) };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e };
    throw e;
  }
}
