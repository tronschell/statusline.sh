// CORS allowlist for the community worker.
//
// Installer endpoints (`/i/:id.{sh,ps1}`) must work without an Origin header —
// `curl` and `iwr` don't send one. In that case we simply return empty CORS
// headers and the caller proceeds normally; the request is not blocked.

// Allowlist is the authoritative list of origins the Worker accepts requests
// from. Every entry is team/project scoped so a different Vercel team can't
// trivially get green-lit by spinning up a `statusline-maker-…` project. The
// production Vercel alias `statusline-maker.vercel.app` is also explicitly
// listed since it doesn't include the team slug.
//
// Dev origins (localhost / 127.0.0.1) are intentionally NOT in the production
// allowlist — local development uses `wrangler dev --local` which spins up a
// separate worker on :8787. If you ever need to point a localhost SPA at the
// production Worker for debugging, add the origin temporarily.
const ALLOWED_PATTERNS: RegExp[] = [
  /^https:\/\/statusline\.sh$/,
  /^https:\/\/www\.statusline\.sh$/,
  /^https:\/\/statusline-maker\.vercel\.app$/,
  /^https:\/\/statusline-maker-[a-z0-9]+-tronschells-projects\.vercel\.app$/,
];

export interface CorsResult {
  headers: Headers;
  preflightResponse: Response | null;
}

export function cors(req: Request, _env: { ALLOWED_ORIGINS?: string }): CorsResult {
  const origin = req.headers.get("origin");
  const allowed = origin !== null && ALLOWED_PATTERNS.some((re) => re.test(origin));
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
