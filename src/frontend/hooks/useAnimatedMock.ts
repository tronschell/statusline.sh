import { useEffect, useRef, useState } from "react";
import { tweenMock } from "../../shared/animatedMocks";
import type { ClaudeStdin } from "@statusline/shared/types";

export interface UseAnimatedMockOptions {
  baseline: ClaudeStdin;
  paused: boolean;
  durationMs: number;
}

const FRAME_INTERVAL_MS = 1000 / 30; // ~30fps throttle

/**
 * requestAnimationFrame-driven tween. Returns a mock that loops through the
 * tween every `durationMs`. Throttled to ~30fps via a wall-clock delta check
 * so render cost stays bounded regardless of refresh rate. Pauses on
 * `paused === true` (the tween clock freezes; resumes from the same point) and
 * also whenever the user prefers reduced motion — in both cases the loop keeps
 * spinning but neither advances the clock nor re-renders, so the mock holds.
 */
export function useAnimatedMock(opts: UseAnimatedMockOptions): ClaudeStdin {
  const { baseline, paused, durationMs } = opts;
  const [mock, setMock] = useState<ClaudeStdin>(() =>
    tweenMock(baseline, 0, durationMs),
  );

  const elapsedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const pausedRef = useRef(paused);
  const reducedMotionRef = useRef(false);
  const baselineRef = useRef(baseline);
  const durationRef = useRef(durationMs);

  // Keep refs in sync without invalidating the rAF loop.
  pausedRef.current = paused;
  baselineRef.current = baseline;
  durationRef.current = durationMs;

  // Track prefers-reduced-motion so the hook freezes itself even if a caller
  // forgets to fold it into `paused`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    reducedMotionRef.current = mq.matches;
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener?.(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener?.(onChange);
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    let cancelled = false;

    const raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb: FrameRequestCallback): number =>
            setTimeout(() => cb(Date.now()), FRAME_INTERVAL_MS) as unknown as number;
    const caf =
      typeof cancelAnimationFrame !== "undefined"
        ? cancelAnimationFrame
        : (id: number): void => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

    const tick = (now: number) => {
      if (cancelled) return;
      const prev = lastTickRef.current;
      lastTickRef.current = now;
      const dt = prev == null ? 0 : Math.max(0, now - prev);
      const active = !pausedRef.current && !reducedMotionRef.current;
      if (active) {
        elapsedRef.current = (elapsedRef.current + dt) % durationRef.current;
        if (now - lastFrameRef.current >= FRAME_INTERVAL_MS) {
          lastFrameRef.current = now;
          setMock(
            tweenMock(
              baselineRef.current,
              elapsedRef.current,
              durationRef.current,
            ),
          );
        }
      }
      rafId = raf(tick);
    };

    rafId = raf(tick);
    return () => {
      cancelled = true;
      caf(rafId);
      lastTickRef.current = null;
    };
  }, []);

  return mock;
}
