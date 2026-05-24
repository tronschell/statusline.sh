// CORS allowlist for the community worker.
//
// Installer endpoints (`/i/:id.{sh,ps1}`) must work without an Origin header —
// `curl` and `iwr` don't send one. In that case we simply return empty CORS
// headers and the caller proceeds normally; the request is not blocked.

// Production allowlist. Every entry is team/project scoped so a different
// Vercel team can't trivially get green-lit by spinning up a
// `statusline-maker-…` project. The production Vercel alias
// `statusline-maker.vercel.app` is also explicitly listed since it doesn't
// include the team slug.
//
// Dev origins (localhost / 127.0.0.1) are NOT baked in here — they're opted in
// via the `ALLOWED_ORIGINS` env var in `wrangler.toml`, which is comma-separated
// and accepts exact origins. That keeps the production deploy strict (the env
// var on prod doesn't include localhost) while letting `wrangler dev` allow
// the local SPA at :3001 to reach the local Worker at :8787.
const ALLOWED_PATTERNS: RegExp[] = [
  /^https:\/\/statusline\.sh$/,
  /^https:\/\/www\.statusline\.sh$/,
  /^https:\/\/statusline-maker\.vercel\.app$/,
  /^https:\/\/statusline-maker-[a-z0-9]+-tronschells-projects\.vercel\.app$/,
];

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export interface CorsResult {
  headers: Headers;
  preflightResponse: Response | null;
}

export function cors(
  req: Request,
  env: { ALLOWED_ORIGINS?: string },
): CorsResult {
  const origin = req.headers.get("origin");
  const envAllowlist = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const allowed =
    origin !== null &&
    (envAllowlist.has(origin) ||
      ALLOWED_PATTERNS.some((re) => re.test(origin)));
  const h = new Headers();
  if (allowed && origin) {
    h.set("access-control-allow-origin", origin);
    h.set("vary", "origin");
    h.set("access-control-allow-methods", "GET, POST, OPTIONS");
    h.set("access-control-allow-headers", "content-type");
    h.set("access-control-max-age", "86400");
  }
  if (req.method === "OPTIONS") {
    return {
      headers: h,
      preflightResponse: new Response(null, { status: 204, headers: h }),
    };
  }
  return { headers: h, preflightResponse: null };
}

export function mergeCorsHeaders(res: Response, corsHeaders: Headers): Response {
  corsHeaders.forEach((v, k) => res.headers.set(k, v));
  return res;
}
