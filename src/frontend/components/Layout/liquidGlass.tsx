import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Physically-based "liquid glass" (after https://kube.io/blog/liquid-glass-css-svg):
 * a convex squircle bezel refracts the backdrop per Snell's law (n = 1.5), encoded as an
 * SVG displacement map sized to the element. (The rim-light specular is pure CSS, see
 * `.glass-box::after`, so it scales smoothly while the box animates.) Only Chromium accepts an SVG filter as `backdrop-filter`; everywhere else the CSS
 * fallback (blur + saturate, see `.glass-box` in index.css) stays in effect.
 */

const N_GLASS = 1.5;
const BEZEL = 22; // px from the edge over which the surface curves
const RISE = 14; // px the bezel rises above the flat surface
const BASE = 12; // px of glass under the flat surface
const SAMPLES = 128;

const squircle = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

/** Displacement magnitude (px) at normalised distance x ∈ [0,1) from the edge. */
function displacementLut(): { lut: number[]; max: number } {
  const lut: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i + 0.5) / SAMPLES;
    const dx = 0.001;
    const slope = (RISE * (squircle(Math.min(x + dx, 1)) - squircle(Math.max(x - dx, 0)))) / (2 * dx) / BEZEL;
    const t1 = Math.atan(slope);
    const t2 = Math.asin(Math.sin(t1) / N_GLASS);
    lut.push((RISE * squircle(x) + BASE) * Math.tan(t1 - t2));
  }
  return { lut, max: Math.max(...lut) };
}

function buildMaps(w: number, h: number, radius: number) {
  const { lut, max } = displacementLut();
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    return { c, ctx, img: ctx.createImageData(w, h) };
  };
  const D = mk();
  const cx = w / 2;
  const cy = h / 2;
  const hx = w / 2 - radius;
  const hy = h / 2 - radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const d = -sdf;
      D.img.data[i] = 128;
      D.img.data[i + 1] = 128;
      D.img.data[i + 2] = 128;
      D.img.data[i + 3] = 255;
      if (d < 0 || d >= BEZEL) continue;
      // Outward normal = gradient of the signed distance field.
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy);
        nx = (qx / l) * Math.sign(px);
        ny = (qy / l) * Math.sign(py);
      } else if (qx > qy) {
        nx = Math.sign(px);
        ny = 0;
      } else {
        nx = 0;
        ny = Math.sign(py);
      }
      const t = d / BEZEL;
      const mag = (lut[Math.min(SAMPLES - 1, Math.floor(t * SAMPLES))] ?? 0) / max;
      // Convex glass bends rays inward: sample the backdrop from further inside.
      D.img.data[i] = 128 - nx * mag * 127;
      D.img.data[i + 1] = 128 - ny * mag * 127;
    }
  }
  D.ctx.putImageData(D.img, 0, 0);
  return { disp: D.c.toDataURL(), scale: 2 * max };
}

const chromium = () => typeof navigator !== "undefined" && /Chrome\//.test(navigator.userAgent);

/**
 * Returns a ref for the glass element, the `<svg>` filter to render somewhere in the tree, and
 * a style that points `--glass-filter` at it. Maps are rebuilt (throttled) whenever the element
 * resizes, since a backdrop SVG filter does not stretch with its box.
 */
export function useLiquidGlass(radius: number) {
  const ref = useRef<HTMLDivElement>(null);
  const id = "lg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [m, setM] = useState<{ w: number; h: number; disp: string; scale: number } | null>(null);
  // False while the box is mid-resize (e.g. the drawer animating): the stale-size filter is
  // swapped for a matching plain blur, then rebuilt once the size settles.
  const [settled, setSettled] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || !chromium()) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      setSettled(true);
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w < 20 || h < 20) return;
      setM((p) => (p && p.w === w && p.h === h ? p : { w, h, ...buildMaps(w, h, radius) }));
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(raf);
      setSettled(false);
      raf = window.setTimeout(run, 120) as unknown as number;
    });
    ro.observe(el);
    run();
    return () => {
      ro.disconnect();
      clearTimeout(raf);
    };
  }, [radius]);

  const filter: ReactNode = m ? (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }} colorInterpolationFilters="sRGB">
      <filter id={id} x="0" y="0" width={m.w} height={m.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="frost" />
        <feImage href={m.disp} x="0" y="0" width={m.w} height={m.h} result="map" />
        <feDisplacementMap in="frost" in2="map" scale={m.scale} xChannelSelector="R" yChannelSelector="G" result="refracted" />
        <feColorMatrix in="refracted" type="saturate" values="1.7" />
      </filter>
    </svg>
  ) : null;

  // While resizing, stand in with the filter's own blur/saturation so only the bezel refraction pops in.
  const style = m
    ? ({ "--glass-filter": settled ? `url(#${id})` : "blur(3px) saturate(1.7)" } as React.CSSProperties)
    : undefined;
  return { ref, filter, style };
}
