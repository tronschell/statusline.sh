// The build inlines `process.env.NEXT_PUBLIC_*` literals via Bun.build's
// `define` map (see build.ts). At runtime in the browser there is no real
// `process.env` — the string `process.env.NEXT_PUBLIC_WORKER_URL` is replaced
// at build time with the value Vercel exposed during the build, or `undefined`
// if not set.

const ENV_WORKER_URL: string | undefined = process.env.NEXT_PUBLIC_WORKER_URL;
const ENV_TURNSTILE_SITE_KEY: string | undefined = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function inferWorkerUrl(): string {
  if (ENV_WORKER_URL) return ENV_WORKER_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8787";
  }
  return "https://statusline-community.zoniixyt.workers.dev"; // production fallback; maintainer overrides via env
}

function inferTurnstileSiteKey(): string {
  if (ENV_TURNSTILE_SITE_KEY) return ENV_TURNSTILE_SITE_KEY;
  // Cloudflare's "always passes" dev key — safe to commit, only useful in development.
  return "1x00000000000000000000AA";
}

export const WORKER_URL = inferWorkerUrl();
export const TURNSTILE_SITE_KEY = inferTurnstileSiteKey();

// Accounts / Pro UI. Off in production builds until NEXT_PUBLIC_ACCOUNTS=1 is
// set (so the live site is unchanged until the Worker has the accounts
// migration + secrets); always on for local development.
let ENV_ACCOUNTS: string | undefined;
try {
  ENV_ACCOUNTS = process.env.NEXT_PUBLIC_ACCOUNTS;
} catch {
  ENV_ACCOUNTS = undefined; // no build-time define and no `process` in the browser
}

function inferAccountsEnabled(): boolean {
  if (ENV_ACCOUNTS === "1") return true;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
  }
  return false;
}

export const ACCOUNTS_ENABLED = inferAccountsEnabled();
