import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Eyedropper } from "@phosphor-icons/react";
import type { AnsiColor } from "@statusline/shared/types";
import { ANSI16_HEX, ansi256ToRgb } from "@statusline/shared/ansi";

export interface ColorPickerProps {
  value: AnsiColor | undefined;
  onChange: (v: AnsiColor) => void;
  /**
   * Accessible label for the picker. Rendered visually as a small caption
   * above the surface and forwarded to all inner controls via aria-label.
   */
  label: string;
}

type Tab = "picker" | "ansi16" | "ansi256";
type Format = "hex" | "rgb" | "hsl";

// --- Color math --------------------------------------------------------

type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };
type Hsl = { h: number; s: number; l: number };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0));
    else if (max === gg) h = ((bb - rr) / d + 2);
    else h = ((rr - gg) / d + 4);
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh < 60) { r1 = c; g1 = x; }
  else if (hh < 120) { r1 = x; g1 = c; }
  else if (hh < 180) { g1 = c; b1 = x; }
  else if (hh < 240) { g1 = x; b1 = c; }
  else if (hh < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0));
    else if (max === gg) h = ((bb - rr) / d + 2);
    else h = ((rr - gg) / d + 4);
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hh = (((h % 360) + 360) % 360) / 360;
  const conv = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(conv(hh + 1 / 3) * 255),
    g: Math.round(conv(hh) * 255),
    b: Math.round(conv(hh - 1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function parseHex(input: string): Rgb | null {
  let v = input.trim().replace(/^#/, "");
  if (v.length === 3) {
    v = v.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function colorToRgb(c: AnsiColor | undefined): Rgb {
  if (!c || c.kind === "default") return { r: 200, g: 200, b: 200 };
  if (c.kind === "ansi16") {
    const hex = ANSI16_HEX[c.index] ?? "#cccccc";
    return parseHex(hex) ?? { r: 200, g: 200, b: 200 };
  }
  if (c.kind === "ansi256") {
    const [r, g, b] = ansi256ToRgb(c.index);
    return { r, g, b };
  }
  return { r: c.r, g: c.g, b: c.b };
}

function colorsEqual(a: AnsiColor | undefined, b: AnsiColor | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "default":
      return true;
    case "ansi16":
    case "ansi256":
      return a.index === (b as { index: number }).index;
    case "rgb": {
      const bb = b as { r: number; g: number; b: number };
      return a.r === bb.r && a.g === bb.g && a.b === bb.b;
    }
  }
}

function nearestAnsi256(r: number, g: number, b: number): number {
  let bestIdx = 16;
  let bestDist = Infinity;
  for (let i = 16; i < 256; i++) {
    const [cr, cg, cb] = ansi256ToRgb(i);
    const dr = cr - r;
    const dg = cg - g;
    const db = cb - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function initialTab(value: AnsiColor | undefined): Tab {
  if (!value) return "picker";
  if (value.kind === "ansi16") return "ansi16";
  if (value.kind === "ansi256") return "ansi256";
  return "picker";
}

function ansi16Hex(idx: number): string {
  return ANSI16_HEX[idx] ?? "#000000";
}

function ansi256Css(idx: number): string {
  const [r, g, b] = ansi256ToRgb(idx);
  return `rgb(${r},${g},${b})`;
}

// --- EyeDropper API typing -------------------------------------------

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperLike {
  open(opts?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
}
type EyeDropperCtor = new () => EyeDropperLike;

function getEyeDropper(): EyeDropperCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { EyeDropper?: EyeDropperCtor };
  return w.EyeDropper ?? null;
}

// --- Component --------------------------------------------------------

export default function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [tab, setTab] = useState<Tab>(() => initialTab(value));

  const previewCss = useMemo(() => {
    if (!value || value.kind === "default") return null;
    if (value.kind === "ansi16") return ansi16Hex(value.index);
    if (value.kind === "ansi256") return ansi256Css(value.index);
    return `rgb(${value.r},${value.g},${value.b})`;
  }, [value]);

  const subLabel = useMemo(() => {
    if (!value || value.kind === "default") return "Default";
    if (value.kind === "ansi16") return `ANSI 16 · ${value.index}`;
    if (value.kind === "ansi256") return `ANSI 256 · ${value.index}`;
    return rgbToHex(value.r, value.g, value.b).toUpperCase();
  }, [value]);

  const tabs: { value: Tab; label: string }[] = [
    { value: "picker", label: "Picker" },
    { value: "ansi16", label: "ANSI 16" },
    { value: "ansi256", label: "ANSI 256" },
  ];

  const isDefault = !value || value.kind === "default";
  const valueIsCode = !isDefault;

  return (
    <div className="flex flex-col gap-4" role="group" aria-label={label}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-block h-[22px] w-[22px] rounded-[4px] border border-white/[0.12]"
          style={{
            background:
              previewCss ??
              "repeating-linear-gradient(45deg,#1C1C1F,#1C1C1F 4px,#2A2A2D 4px,#2A2A2D 8px)",
          }}
        />
        <span
          className={`text-xs text-[var(--color-text)] ${
            valueIsCode ? "font-mono" : ""
          }`}
        >
          {subLabel}
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange({ kind: "default" })}
            className="ml-auto bg-transparent px-1 py-0.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
          >
            Use default
          </button>
        )}
      </div>

      <div
        role="tablist"
        aria-label={`${label} format`}
        className="flex gap-1 border-b border-[var(--color-border)]"
      >
        {tabs.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={`-mb-px border-b px-3 py-2 text-xs uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40 ${
                active
                  ? "border-[var(--color-text)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "picker" && (
        <CanvasPicker value={value} onChange={onChange} label={label} />
      )}
      {tab === "ansi16" && <Ansi16Grid value={value} onChange={onChange} />}
      {tab === "ansi256" && <Ansi256Grid value={value} onChange={onChange} />}
    </div>
  );
}

// --- Canvas (HSV) picker ----------------------------------------------

function CanvasPicker({
  value,
  onChange,
  label,
}: {
  value: AnsiColor | undefined;
  onChange: (v: AnsiColor) => void;
  label: string;
}) {
  const baseRgb = useMemo(() => colorToRgb(value), [value]);
  const baseHsv = useMemo(() => rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b), [baseRgb]);

  /**
   * Hue is preserved locally so that as the user drags toward s=0 or v=0
   * (where hue becomes mathematically ambiguous) the column doesn't snap
   * back to red. Synced from props whenever the upstream color materially
   * disagrees with our cached hue (i.e. user picked via 16/256/eyedropper).
   */
  const [hue, setHue] = useState(baseHsv.h);
  const lastUpstream = useRef<AnsiColor | undefined>(value);
  useEffect(() => {
    if (lastUpstream.current === value) return;
    lastUpstream.current = value;
    const next = rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b);
    if (next.s > 0.02 && next.v > 0.02) setHue(next.h);
  }, [value, baseRgb]);

  const sat = baseHsv.s;
  const val = baseHsv.v;

  const commitRgb = useCallback(
    (rgb: Rgb) => {
      const cr = clamp(Math.round(rgb.r), 0, 255);
      const cg = clamp(Math.round(rgb.g), 0, 255);
      const cb = clamp(Math.round(rgb.b), 0, 255);
      onChange({ kind: "rgb", r: cr, g: cg, b: cb });
    },
    [onChange],
  );

  const applyHsv = useCallback(
    (h: number, s: number, v: number) => {
      setHue(h);
      commitRgb(hsvToRgb(h, s, v));
    },
    [commitRgb],
  );

  // --- Area pointer drag ---
  const areaRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = areaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      applyHsv(hue, x, 1 - y);
    },
    [applyHsv, hue],
  );

  const onAreaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };
  const onAreaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromEvent(e.clientX, e.clientY);
  };
  const onAreaPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const onAreaKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    let handled = true;
    let ns = sat;
    let nv = val;
    switch (e.key) {
      case "ArrowLeft": ns = clamp(sat - step, 0, 1); break;
      case "ArrowRight": ns = clamp(sat + step, 0, 1); break;
      case "ArrowUp": nv = clamp(val + step, 0, 1); break;
      case "ArrowDown": nv = clamp(val - step, 0, 1); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      applyHsv(hue, ns, nv);
    }
  };

  const onHueChange = (h: number) => applyHsv(h, sat, val);

  // --- Eyedropper ---
  const eyeDropperCtor = useMemo(() => getEyeDropper(), []);
  const [eyeError, setEyeError] = useState<string | null>(null);
  const onEyeDrop = async () => {
    if (!eyeDropperCtor) return;
    setEyeError(null);
    try {
      const inst = new eyeDropperCtor();
      const { sRGBHex } = await inst.open();
      const parsed = parseHex(sRGBHex);
      if (parsed) commitRgb(parsed);
    } catch {
      // user aborted — no-op
    }
  };

  // --- Format inputs ---
  const [format, setFormat] = useState<Format>("hex");
  const [hexDraft, setHexDraft] = useState(() => rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b));
  useEffect(() => {
    setHexDraft(rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b));
  }, [baseRgb]);

  const snap = () => {
    onChange({
      kind: "ansi256",
      index: nearestAnsi256(baseRgb.r, baseRgb.g, baseRgb.b),
    });
  };

  const hueCss = `hsl(${hue} 100% 50%)`;
  const thumbLeft = `${sat * 100}%`;
  const thumbTop = `${(1 - val) * 100}%`;

  const areaLabelId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={areaRef}
        role="application"
        aria-label={`${label} saturation and brightness`}
        aria-describedby={areaLabelId}
        tabIndex={0}
        onPointerDown={onAreaPointerDown}
        onPointerMove={onAreaPointerMove}
        onPointerUp={onAreaPointerUp}
        onPointerCancel={onAreaPointerUp}
        onKeyDown={onAreaKeyDown}
        className="relative h-40 w-full select-none rounded-[8px] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
        style={{
          background: hueCss,
          touchAction: "none",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[8px]"
          style={{
            background:
              "linear-gradient(to right, #fff, transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[8px]"
          style={{
            background:
              "linear-gradient(to top, #000, transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{
            left: thumbLeft,
            top: thumbTop,
            background: `rgb(${baseRgb.r},${baseRgb.g},${baseRgb.b})`,
          }}
        />
      </div>
      <span id={areaLabelId} className="sr-only">
        Use arrow keys to adjust saturation and brightness. Hold Shift for
        larger steps.
      </span>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(hue)}
            onChange={(e) => onHueChange(Number(e.target.value))}
            aria-label={`${label} hue`}
            className="hue-slider h-3 w-full appearance-none rounded-full"
            style={{
              background:
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
          />
        </div>
        {eyeDropperCtor && (
          <button
            type="button"
            onClick={onEyeDrop}
            title="Pick color from screen"
            aria-label="Pick color from screen with eyedropper"
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] transition-colors hover:border-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
          >
            <Eyedropper size={14} weight="bold" />
          </button>
        )}
      </div>

      {eyeError && (
        <p className="text-xs text-[#E89B9E]">{eyeError}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            Format
          </label>
          <select
            aria-label="Color format"
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
            className="h-7 rounded-[4px] border-0 bg-[var(--color-surface-2)] px-2 text-xs uppercase tracking-wider text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
          >
            <option value="hex">HEX</option>
            <option value="rgb">RGB</option>
            <option value="hsl">HSL</option>
          </select>
        </div>

        {format === "hex" && (
          <input
            type="text"
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => {
              const parsed = parseHex(hexDraft);
              if (parsed) commitRgb(parsed);
              else setHexDraft(rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label={`${label} hex value`}
            placeholder="#aabbcc"
            className="w-full rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]"
          />
        )}

        {format === "rgb" && (
          <RgbInputs
            label={label}
            value={baseRgb}
            onChange={(rgb) => commitRgb(rgb)}
          />
        )}

        {format === "hsl" && (
          <HslInputs
            label={label}
            rgb={baseRgb}
            onChange={(rgb) => commitRgb(rgb)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={snap}
        className="self-start bg-transparent px-0 py-0.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
      >
        Snap to nearest ANSI 256
      </button>

      <p className="text-[11px] italic text-[var(--color-text-muted)]">
        Truecolor may not render in every terminal — snap to ANSI 256 for the
        widest compatibility.
      </p>
    </div>
  );
}

function RgbInputs({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Rgb;
  onChange: (rgb: Rgb) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["r", "g", "b"] as const).map((k) => (
        <div key={k} className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            {k.toUpperCase()}
          </label>
          <input
            type="number"
            min={0}
            max={255}
            value={value[k]}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange({ ...value, [k]: clamp(Math.round(n), 0, 255) });
            }}
            aria-label={`${label} ${k.toUpperCase()}`}
            className="w-full rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]"
          />
        </div>
      ))}
    </div>
  );
}

function HslInputs({
  label,
  rgb,
  onChange,
}: {
  label: string;
  rgb: Rgb;
  onChange: (rgb: Rgb) => void;
}) {
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);
  const set = (patch: Partial<{ h: number; s: number; l: number }>) => {
    const h = patch.h ?? hsl.h;
    const s = patch.s ?? hsl.s;
    const l = patch.l ?? hsl.l;
    onChange(hslToRgb(h, s, l));
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">H</label>
        <input
          type="number"
          min={0}
          max={360}
          value={Math.round(hsl.h)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            set({ h: clamp(n, 0, 360) });
          }}
          aria-label={`${label} hue degrees`}
          className="w-full rounded-[4px] border border-white/[0.06] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">S %</label>
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(hsl.s * 100)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            set({ s: clamp(n / 100, 0, 1) });
          }}
          aria-label={`${label} saturation percent`}
          className="w-full rounded-[4px] border border-white/[0.06] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">L %</label>
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(hsl.l * 100)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            set({ l: clamp(n / 100, 0, 1) });
          }}
          aria-label={`${label} lightness percent`}
          className="w-full rounded-[4px] border border-white/[0.06] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-sm text-[var(--color-text)] focus:outline-none focus:border-[#8FB8DA]"
        />
      </div>
    </div>
  );
}

// --- ANSI swatches ----------------------------------------------------

function Swatch({
  bg,
  selected,
  onClick,
  title,
  size = 22,
  ariaLabel,
}: {
  bg: string;
  selected: boolean;
  onClick: () => void;
  title?: string;
  size?: number;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      className="relative rounded-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
      style={{
        width: size,
        height: size,
        background: bg,
        outline: selected
          ? "2px solid var(--color-text)"
          : "1px solid var(--color-border)",
        outlineOffset: selected ? "1px" : "0",
      }}
    />
  );
}

function Ansi16Grid({
  value,
  onChange,
}: {
  value: AnsiColor | undefined;
  onChange: (v: AnsiColor) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1" role="grid" aria-label="ANSI 16 palette">
      {Array.from({ length: 16 }, (_, i) => i).map((i) => {
        const sel: AnsiColor = { kind: "ansi16", index: i };
        return (
          <Swatch
            key={i}
            bg={ansi16Hex(i)}
            size={28}
            selected={colorsEqual(value, sel)}
            onClick={() => onChange(sel)}
            title={`ANSI 16 — index ${i}`}
            ariaLabel={`ANSI 16 color index ${i}`}
          />
        );
      })}
    </div>
  );
}

function Ansi256Grid({
  value,
  onChange,
}: {
  value: AnsiColor | undefined;
  onChange: (v: AnsiColor) => void;
}) {
  return (
    <div
      className="grid gap-1"
      role="grid"
      aria-label="ANSI 256 palette"
      style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
    >
      {Array.from({ length: 256 }, (_, i) => i).map((i) => {
        const sel: AnsiColor = { kind: "ansi256", index: i };
        return (
          <Swatch
            key={i}
            bg={ansi256Css(i)}
            size={14}
            selected={colorsEqual(value, sel)}
            onClick={() => onChange(sel)}
            title={`ANSI 256 — index ${i}`}
            ariaLabel={`ANSI 256 color index ${i}`}
          />
        );
      })}
    </div>
  );
}
