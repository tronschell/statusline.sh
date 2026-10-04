import { useEffect, useRef } from "react";

// Bayer 4x4 ordered-dither thresholds (0..15)
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const CELL = 3; // CSS px per dither cell

/** Blue glow rising from the bottom edge to ~half the card, rendered as an ordered dither. */
export function DitherGlow({ className = "h-1/2" }: { className?: string }) {
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
      if (now - last < 60) return; // ~16fps is plenty for a slow shimmer
      last = now;
      const img = ctx.createImageData(cols, rows);
      const t = still ? 0 : now / 1800;
      for (let y = 0; y < rows; y++) {
        // 0 at the top of the canvas (half-way up the card) → 1 at the bottom edge
        const v = y / (rows - 1);
        for (let x = 0; x < cols; x++) {
          const wave = 0.1 * Math.sin(x * 0.11 + t + y * 0.06) + 0.06 * Math.sin(x * 0.037 - t * 0.7);
          const level = Math.pow(v, 2.2) * 0.8 + wave * v * 0.6;
          if (level > (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16) {
            const i = (y * cols + x) * 4;
            img.data[i] = 95;
            img.data[i + 1] = 165;
            img.data[i + 2] = 240;
            img.data[i + 3] = 45 + 95 * v;
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
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 ${className} bg-gradient-to-t from-[#5FA5F0]/[0.10] to-transparent`}
      />
      <canvas
        ref={ref}
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 ${className} w-full [image-rendering:pixelated]`}
      />
    </>
  );
}
