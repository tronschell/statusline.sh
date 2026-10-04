import { useEffect, useRef, useState, type RefObject } from "react";
import { BAYER, CELL } from "../Account/DitherGlow";

type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}

/** Two neighbouring random pastel hues, so the glow has a little colour movement. */
export function randomPastelPair(): [RGB, RGB] {
  const h = Math.random() * 360;
  return [hslToRgb(h, 0.8, 0.8), hslToRgb((h + 45) % 360, 0.8, 0.8)];
}

/** True while the card is hovered/focused, or (touch devices) while it sits in the middle band of the viewport. */
export function useCardActive(ref: RefObject<HTMLElement | null>): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none)").matches) {
      const io = new IntersectionObserver(([e]) => setActive(Boolean(e?.isIntersecting)), { rootMargin: "-42% 0px -42% 0px" });
      io.observe(el);
      return () => io.disconnect();
    }
    const on = () => setActive(true);
    const off = () => setActive(false);
    const evs: [string, () => void][] = [["mouseenter", on], ["mouseleave", off], ["focusin", on], ["focusout", off]];
    evs.forEach(([n, f]) => el.addEventListener(n, f));
    return () => evs.forEach(([n, f]) => el.removeEventListener(n, f));
  }, [ref]);
  return active;
}

/** Ordered-dither glow (same Bayer thresholding as the hero), two soft blobs drifting in the given colours. */
export function CardGlow({ colors }: { colors: [RGB, RGB] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 60) return;
      last = now;
      const t = still ? 2 : now / 1000;
      const blobs = colors.map((rgb, i) => ({
        rgb,
        cx: 0.5 + 0.38 * Math.sin(t / 2.6 + i * 2.4),
        cy: 0.5 + 0.3 * Math.cos(t / 3.4 + i * 1.7),
      }));
      const img = ctx.createImageData(cols, rows);
      for (let y = 0; y < rows; y++) {
        const v = y / rows;
        for (let x = 0; x < cols; x++) {
          const u = x / cols;
          let sum = 0, r = 0, g = 0, b = 0;
          for (const s of blobs) {
            const dx = (u - s.cx) / 0.38;
            const dy = (v - s.cy) / 0.6;
            const w = Math.exp(-(dx * dx + dy * dy) * 1.3);
            sum += w;
            r += s.rgb[0] * w;
            g += s.rgb[1] * w;
            b += s.rgb[2] * w;
          }
          if (Math.min(1, sum * 1.2) > (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16) {
            const i = (y * cols + x) * 4;
            img.data[i] = r / sum;
            img.data[i + 1] = g / sum;
            img.data[i + 2] = b / sum;
            img.data[i + 3] = 190;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      if (still) cancelAnimationFrame(raf);
    };
    const size = () => {
      cancelAnimationFrame(raf);
      cols = Math.ceil(canvas.clientWidth / CELL);
      rows = Math.ceil(canvas.clientHeight / CELL);
      canvas.width = cols;
      canvas.height = rows;
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    size();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [colors]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute -inset-x-10 -inset-y-10 -z-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_60%,transparent_100%)] animate-[fadein_350ms_ease-out] [image-rendering:pixelated]"
    />
  );
}
