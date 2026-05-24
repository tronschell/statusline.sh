import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "./config";

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let turnstileScriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: {
        sitekey: string;
        callback?: (token: string) => void;
        // Per Turnstile docs the error-callback receives a string error code
        // (e.g. "110200" for hostname-not-allowed). Returning `false` lets
        // Cloudflare render its own inline error; returning anything else
        // suppresses it so we can render our own.
        "error-callback"?: (code: string) => void | boolean;
        "expired-callback"?: () => void;
        size?: "normal" | "compact" | "invisible";
        theme?: "light" | "dark" | "auto";
      }): string;
      remove(widgetId: string): void;
      reset(widgetId?: string): void;
    };
  }
}

export interface TurnstileWidgetProps {
  onToken(token: string): void;
  // Receives the Cloudflare error code (or "load" / "render" for our wrapper
  // failures) so callers can surface something useful instead of going silent.
  onError?(code: string): void;
  size?: "normal" | "compact" | "invisible";
  theme?: "light" | "dark" | "auto";
}

export function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function TurnstileWidget({ onToken, onError, size = "normal", theme = "dark" }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        try {
          const id = window.turnstile.render(ref.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: onToken,
            "error-callback": (code) => {
              onError?.(code || "unknown");
            },
            size,
            theme,
          });
          widgetIdRef.current = id;
        } catch (e) {
          onError?.(e instanceof Error ? `render: ${e.message}` : "render");
        }
      })
      .catch(() => {
        if (!cancelled) onError?.("load");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} />;
}
