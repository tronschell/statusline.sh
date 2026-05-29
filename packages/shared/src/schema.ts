import type {
  AnsiColor,
  AnsiStyle,
  ConditionExpr,
  ContextColorMode,
  ContextThresholds,
  Design,
  Element,
  ElementRef,
  ElementType,
  RateLimitVariant,
  SegmentStyle,
  TokenDisplayVariant,
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

// Upper bounds on numeric design fields. These cap compiled-loop / resource
// cost so a published community design cannot DoS the terminals of users who
// install it: bar widths drive __repeat_char/__bar loops in the bash/PS
// compilers, truncate length and spacer width drive string allocation, and
// interval seconds gate refresh cost. Values are generous — they only reject
// absurd inputs (e.g. width: 1e9), not any realistic configuration.
const MAX_BAR_WIDTH = 200;
const MAX_TRUNCATE = 1000;
const MAX_SPACER_WIDTH = 1000;
const MAX_INTERVAL_SECONDS = 86400; // one day

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
  "contextTokens",
  "rateLimit5h",
  "rateLimit7d",
  "cost",
  "sessionDuration",
  "glyph",
  "separator",
  "rotator",
  "segmentSplit",
  "thinkingEffort",
  "outputStyle",
  "fastMode",
  "lineBreak",
  "spacer",
];

/**
 * Maps legacy element type aliases to their consolidated replacement.
 * Old community designs in D1 and locally-persisted state may still use
 * the four-way split (rateLimit5hPct/Bar, rateLimit7dPct/Bar); the
 * validator rewrites the type in-place and synthesizes a `variant`.
 */
const LEGACY_TYPE_ALIASES: Record<
  string,
  { type: ElementType; variant?: RateLimitVariant }
> = {
  rateLimit5hPct: { type: "rateLimit5h", variant: "pct" },
  rateLimit5hBar: { type: "rateLimit5h", variant: "bar" },
  rateLimit7dPct: { type: "rateLimit7d", variant: "pct" },
  rateLimit7dBar: { type: "rateLimit7d", variant: "bar" },
};

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

function vColorMode(v: unknown, path: string): ContextColorMode {
  if (v === "static" || v === "percentage" || v === "absolute") return v;
  throw new ValidationError(path, "expected static|percentage|absolute");
}

function vTokenVariant(v: unknown, path: string): TokenDisplayVariant {
  if (v === "ratio" || v === "used" || v === "remaining" || v === "ratioPct")
    return v;
  throw new ValidationError(path, "expected ratio|used|remaining|ratioPct");
}

function vRateLimitVariant(v: unknown, path: string): RateLimitVariant {
  if (v === "pct" || v === "bar") return v;
  throw new ValidationError(path, "expected pct|bar");
}

function vThresholds(v: unknown, path: string): ContextThresholds {
  if (!isObj(v)) throw new ValidationError(path, "expected object");
  const out: ContextThresholds = { green: 0, yellow: 0, orange: 0 };
  for (const k of ["green", "yellow", "orange"] as const) {
    const n = v[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
      throw new ValidationError(`${path}.${k}`, "expected non-negative number");
    out[k] = n;
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
    if (typeof v.maxLength !== "number" || v.maxLength < 0 || v.maxLength > MAX_TRUNCATE)
      throw new ValidationError(
        path + ".maxLength",
        `expected non-negative number <= ${MAX_TRUNCATE}`,
      );
    base.maxLength = v.maxLength;
  }
  if (v.showWhen !== undefined) {
    base.showWhen = vCondition(v.showWhen, path + ".showWhen");
  }
  return base;
}

function vElement(raw: unknown, path: string): Element {
  if (!isObj(raw)) throw new ValidationError(path, "expected object");
  let v: Record<string, unknown> = raw;
  let t = v.type;
  if (typeof t === "string" && t in LEGACY_TYPE_ALIASES) {
    const alias = LEGACY_TYPE_ALIASES[t]!;
    const rewritten: Record<string, unknown> = { ...v, type: alias.type };
    if (alias.variant !== undefined && rewritten.variant === undefined) {
      rewritten.variant = alias.variant;
    }
    v = rewritten;
    t = alias.type;
  }
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
      if (
        v.mode !== "basename" &&
        v.mode !== "full" &&
        v.mode !== "tilde" &&
        v.mode !== "compact"
      )
        throw new ValidationError(
          path + ".mode",
          "expected basename|full|tilde|compact",
        );
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
    case "contextPct": {
      const out: Element = { ...base, type: "contextPct" };
      if (v.colorMode !== undefined)
        out.colorMode = vColorMode(v.colorMode, path + ".colorMode");
      if (v.thresholds !== undefined)
        out.thresholds = vThresholds(v.thresholds, path + ".thresholds");
      return out;
    }
    case "contextBar": {
      if (typeof v.width !== "number" || v.width < 1 || v.width > MAX_BAR_WIDTH)
        throw new ValidationError(path + ".width", `expected 1..${MAX_BAR_WIDTH}`);
      if (typeof v.filledChar !== "string" || v.filledChar.length === 0)
        throw new ValidationError(path + ".filledChar", "expected non-empty string");
      if (typeof v.emptyChar !== "string" || v.emptyChar.length === 0)
        throw new ValidationError(path + ".emptyChar", "expected non-empty string");
      const out: Element = {
        ...base,
        type: "contextBar",
        width: v.width,
        filledChar: v.filledChar,
        emptyChar: v.emptyChar,
      };
      if (v.colorMode !== undefined)
        out.colorMode = vColorMode(v.colorMode, path + ".colorMode");
      if (v.thresholds !== undefined)
        out.thresholds = vThresholds(v.thresholds, path + ".thresholds");
      return out;
    }
    case "contextTokens": {
      const variant = vTokenVariant(v.variant, path + ".variant");
      if (typeof v.compact !== "boolean")
        throw new ValidationError(path + ".compact", "expected boolean");
      const out: Element = {
        ...base,
        type: "contextTokens",
        variant,
        compact: v.compact,
      };
      if (v.colorMode !== undefined)
        out.colorMode = vColorMode(v.colorMode, path + ".colorMode");
      if (v.thresholds !== undefined)
        out.thresholds = vThresholds(v.thresholds, path + ".thresholds");
      return out;
    }
    case "rateLimit5h":
    case "rateLimit7d": {
      const variant = vRateLimitVariant(v.variant, path + ".variant");
      // Bar fields are always stored so users can switch variants without
      // losing their bar configuration. Defaults match the palette factory.
      const width = v.width === undefined ? 10 : v.width;
      const filledChar = v.filledChar === undefined ? "█" : v.filledChar;
      const emptyChar = v.emptyChar === undefined ? "░" : v.emptyChar;
      if (typeof width !== "number" || width < 1 || width > MAX_BAR_WIDTH)
        throw new ValidationError(path + ".width", `expected 1..${MAX_BAR_WIDTH}`);
      if (typeof filledChar !== "string" || filledChar.length === 0)
        throw new ValidationError(path + ".filledChar", "expected non-empty string");
      if (typeof emptyChar !== "string" || emptyChar.length === 0)
        throw new ValidationError(path + ".emptyChar", "expected non-empty string");
      const out: Extract<Element, { type: "rateLimit5h" | "rateLimit7d" }> = {
        ...base,
        type: t as "rateLimit5h" | "rateLimit7d",
        variant,
        width,
        filledChar,
        emptyChar,
      };
      if (v.showResetTime !== undefined) {
        if (typeof v.showResetTime !== "boolean")
          throw new ValidationError(path + ".showResetTime", "expected boolean");
        out.showResetTime = v.showResetTime;
      }
      return out;
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
      if (
        typeof v.intervalSeconds !== "number" ||
        v.intervalSeconds < 1 ||
        v.intervalSeconds > MAX_INTERVAL_SECONDS
      )
        throw new ValidationError(
          path + ".intervalSeconds",
          `expected 1..${MAX_INTERVAL_SECONDS}`,
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
    case "thinkingEffort":
      return { ...base, type: "thinkingEffort" };
    case "outputStyle": {
      const out: Element = { ...base, type: "outputStyle" };
      if (v.alwaysShow !== undefined) {
        if (typeof v.alwaysShow !== "boolean")
          throw new ValidationError(path + ".alwaysShow", "expected boolean");
        out.alwaysShow = v.alwaysShow;
      }
      return out;
    }
    case "fastMode": {
      const out: Element = { ...base, type: "fastMode" };
      if (v.text !== undefined) {
        if (typeof v.text !== "string")
          throw new ValidationError(path + ".text", "expected string");
        out.text = v.text;
      }
      return out;
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
    case "lineBreak":
      return { ...base, type: "lineBreak" };
    case "spacer": {
      if (v.mode !== "fixed" && v.mode !== "flex")
        throw new ValidationError(path + ".mode", "expected fixed|flex");
      const out: Element = { ...base, type: "spacer", mode: v.mode };
      if (v.width !== undefined) {
        if (
          typeof v.width !== "number" ||
          v.width < 0 ||
          v.width > MAX_SPACER_WIDTH ||
          !Number.isFinite(v.width)
        )
          throw new ValidationError(
            path + ".width",
            `expected non-negative number <= ${MAX_SPACER_WIDTH}`,
          );
        out.width = v.width;
      }
      if (v.char !== undefined) {
        if (typeof v.char !== "string")
          throw new ValidationError(path + ".char", "expected string");
        out.char = v.char;
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
    if (
      typeof raw.refreshInterval !== "number" ||
      raw.refreshInterval < 0 ||
      raw.refreshInterval > MAX_INTERVAL_SECONDS
    )
      throw new ValidationError(
        "$.refreshInterval",
        `expected non-negative number <= ${MAX_INTERVAL_SECONDS}`,
      );
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
