// The build inlines `process.env.NEXT_PUBLIC_*` literals via Bun.build's
// `define` map (see build.ts). At runtime in the browser there is no real
// `process.env` — the string `process.env.NEXT_PUBLIC_WORKER_URL` is replaced
// at build time with the value Vercel exposed during the build, or `undefined`
// if not set.

// @ts-expect-error process.env.X is replaced by the bundler with a string literal
const ENV_WORKER_URL: string | undefined = process.env.NEXT_PUBLIC_WORKER_URL;
// @ts-expect-error process.env.X is replaced by the bundler with a string literal
const ENV_TURNSTILE_SITE_KEY: string | undefined = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function inferWorkerUrl(): string {
  if (ENV_WORKER_URL) return ENV_WORKER_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8787";
  }
  return "https://api.statusline.sh"; // production fallback; maintainer overrides via env
}

function inferTurnstileSiteKey(): string {
  if (ENV_TURNSTILE_SITE_KEY) return ENV_TURNSTILE_SITE_KEY;
  // Cloudflare's "always passes" dev key — safe to commit, only useful in development.
  return "1x00000000000000000000AA";
}

export const WORKER_URL = inferWorkerUrl();
export const TURNSTILE_SITE_KEY = inferTurnstileSiteKey();
