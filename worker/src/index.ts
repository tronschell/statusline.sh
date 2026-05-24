import type { Design } from "@statusline/shared/types";
import { validateDesign, ValidationError } from "@statusline/shared/schema";
import { cors, mergeCorsHeaders } from "./cors";
import { match, route } from "./router";
import { checkRateLimit } from "./ratelimit";
import { verifyTurnstile, getClientIp } from "./turnstile";
import { sanitizePublishField, LIMITS } from "./sanitize";
import {
  publishDesign,
  getCommunityBySlug,
  listCommunity,
  forkBump,
  insertInstallRecord,
  listCommunitySitemapEntries,
  getCommunitySeoBySlug,
  reapInstallRecords,
  decodeCursor,
} from "./designs";
import { handleInstaller } from "./handlers/installer";
import { renderCommunityOgSvg } from "./og";
import { renderRobotsTxt, renderSitemapXml } from "./seo";

export interface RateLimitBinding {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

// Hard cap on request body size. Element-tree size caps live downstream in
// `validateDesign`; this is the cheap rejection at the HTTP boundary.
const MAX_BODY_BYTES = 65536;

export interface Env {
  DB: D1Database;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGINS: string;
  VIEWS?: AnalyticsEngineDataset;
  RATE_LIMITER_PUBLISH?: RateLimitBinding;
  RATE_LIMITER_FORK?: RateLimitBinding;
  RATE_LIMITER_INSTALL?: RateLimitBinding;
  RATE_LIMITER_LIST?: RateLimitBinding;
  RATE_LIMITER_DETAIL?: RateLimitBinding;
  RATE_LIMITER_INSTALLER?: RateLimitBinding;
}

// ===== Route registration (executed at module load) =====
// Note: the router escapes regex metacharacters in the literal pattern before
// substituting `:param`, so a plain `.sh` / `.ps1` in the pattern is matched
// literally — no need to write `\\.`.
route("GET", "/community", (req, env, ctx, params) =>
  handleListCommunity(req, env as Env, ctx, params),
);
route("GET", "/robots.txt", () => handleRobotsTxt());
route("GET", "/sitemap.xml", (_req, env) => handleSitemapXml(env as Env));
route("GET", "/og/community/:slug.svg", (_req, env, _ctx, params) =>
  handleCommunityOgSvg(env as Env, params),
);
route("GET", "/community/:slug", (req, env, _ctx, params) =>
  handleGetCommunityBySlug(req, env as Env, params),
);
route("POST", "/community/:slug/fork", (req, env, _ctx, params) =>
  handleForkBump(req, env as Env, params),
);
route("POST", "/designs", (req, env, _ctx, params) =>
  handlePublish(req, env as Env, params),
);
route("POST", "/install", (req, env, _ctx, params) =>
  handleInstallAnonymous(req, env as Env, params),
);
route("GET", "/i/:id.sh", async (req, env, _ctx, params) => {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env as Env, "installer", ip);
  if (rl) return rl;
  return handleInstaller(req, env as Env, { id: params.id!, ext: "sh" });
});
route("GET", "/i/:id.ps1", async (req, env, _ctx, params) => {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env as Env, "installer", ip);
  if (rl) return rl;
  return handleInstaller(req, env as Env, { id: params.id!, ext: "ps1" });
});

export default {
  async fetch(
    req: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    // Compute CORS once, outside the try, so the catch block can merge headers
    // onto a 500 response (without this the SPA sees an opaque network failure
    // on any unexpected server error).
    const { headers: corsHeaders, preflightResponse } = cors(req, env);
    if (preflightResponse) return preflightResponse;

    // Reject oversize bodies BEFORE parsing JSON. The SQL CHECK on `length(json)`
    // would catch a 50MB payload anyway, but only after the Worker spent CPU
    // parsing it — that's a free DoS amplifier.
    const len = req.headers.get("content-length");
    if (len && Number(len) > MAX_BODY_BYTES) {
      return mergeCorsHeaders(
        new Response("payload too large", { status: 413 }),
        corsHeaders,
      );
    }

    try {
      const url = new URL(req.url);
      const matched = match(req.method, url.pathname);
      if (!matched) {
        return mergeCorsHeaders(
          new Response("not found", { status: 404 }),
          corsHeaders,
        );
      }

      const res = await matched.handler(
        req,
        env,
        _ctx,
        matched.params,
      );
      return mergeCorsHeaders(res, corsHeaders);
    } catch (err) {
      console.error("worker fetch error", err);
      return mergeCorsHeaders(
        new Response("internal error", { status: 500 }),
        corsHeaders,
      );
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Daily cron — reaps install_records older than 7 days. View rollup
    // happens elsewhere (Analytics Engine writes are live; the rollup-to-D1
    // task can be added once we have real Analytics Engine query usage to
    // inform a sane cadence).
    const { deleted } = await reapInstallRecords(env);
    console.log(`reaper: deleted ${deleted} install_records`);
  },
};

// ===========================================================================
// Handlers
// ===========================================================================

// Edge-cache TTL for /community list responses. With 24 items/page and a
// 60s window, the steady-state DB hit rate is at most ~1 query / minute /
// (sort, cursor) tuple regardless of traffic — which is what protects D1
// when a design goes viral. Trade-off: a freshly-published design can be
// invisible on the Recent feed for up to 60s, which is acceptable.
const LIST_CACHE_TTL_SECONDS = 60;

async function handleListCommunity(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(req.url);
  const sortRaw = url.searchParams.get("sort");
  const sort: "recent" | "popular" =
    sortRaw === "popular" ? "popular" : "recent";
  const limitRaw = Number(url.searchParams.get("limit") ?? "24");
  const limit = Math.min(
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 24),
    50,
  );
  const cursor = url.searchParams.get("cursor");

  // Validate cursor BEFORE the cache lookup so a malformed cursor still 400s
  // instead of being treated as a unique cache key (and a 400 we never want
  // to cache).
  if (cursor && decodeCursor(cursor) === null) {
    return jsonResponse({ error: "invalid cursor" }, 400);
  }

  // Cache key is built from canonical params only — origin and arbitrary
  // headers are stripped so two requests with the same query share an entry.
  const cacheKey = buildListCacheKey(sort, limit, cursor);
  const edgeCache = getEdgeCache();

  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) {
      // Clone via the Response constructor so we can stamp x-cache without
      // mutating the cached entry (Cache API returns immutable Responses).
      const headers = new Headers(hit.headers);
      headers.set("x-cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  // Cache miss — apply rate limit then hit D1.
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env, "list", ip);
  if (rl) return rl;

  const result = await listCommunity(env, { sort, limit, cursor });
  const response = jsonResponse(result, 200, {
    "cache-control": `public, s-maxage=${LIST_CACHE_TTL_SECONDS}`,
    "x-cache": "MISS",
  });

  if (edgeCache) {
    ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
  }
  return response;
}

function buildListCacheKey(
  sort: "recent" | "popular",
  limit: number,
  cursor: string | null,
): Request {
  const u = new URL("https://list-cache.invalid/community");
  u.searchParams.set("sort", sort);
  u.searchParams.set("limit", String(limit));
  if (cursor) u.searchParams.set("cursor", cursor);
  return new Request(u.toString());
}

// `caches.default` is a Workers-specific API. In Bun's test runtime there is
// no such global, so we feature-detect and silently no-op when absent —
// caching is a perf optimisation, not a correctness requirement.
function getEdgeCache(): Cache | null {
  try {
    const g = globalThis as { caches?: { default?: Cache } };
    return g.caches?.default ?? null;
  } catch {
    return null;
  }
}

function handleRobotsTxt(): Response {
  return new Response(renderRobotsTxt(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600",
    },
  });
}

async function handleSitemapXml(env: Env): Promise<Response> {
  const entries = await listCommunitySitemapEntries(env);
  return new Response(renderSitemapXml(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600",
    },
  });
}

async function handleCommunityOgSvg(
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const row = await getCommunitySeoBySlug(env, params.slug!);
  if (!row) return new Response("not found", { status: 404 });

  return new Response(renderCommunityOgSvg(row), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

async function handleGetCommunityBySlug(
  req: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env, "detail", ip);
  if (rl) return rl;

  const row = await getCommunityBySlug(env, params.slug!);
  if (!row) return jsonResponse({ error: "not found" }, 404);

  // Track view via Workers Analytics Engine — never touches D1.
  if (env.VIEWS) {
    try {
      env.VIEWS.writeDataPoint({
        blobs: [row.slug],
        doubles: [1],
        indexes: [row.slug],
      });
    } catch (e) {
      console.warn("analytics write failed", e);
    }
  }

  return jsonResponse(row);
}

async function handleForkBump(
  req: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env, "fork", ip);
  if (rl) return rl;

  const body = await readJson(req);
  if (!body || typeof body.turnstile_token !== "string") {
    return jsonResponse({ error: "missing turnstile_token" }, 400);
  }
  const turnstileOk = await verifyTurnstile(
    body.turnstile_token,
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!turnstileOk) return jsonResponse({ error: "turnstile failed" }, 401);

  const result = await forkBump(env, params.slug!);
  if (!result) return jsonResponse({ error: "not found" }, 404);
  return jsonResponse({ ok: true });
}

async function handlePublish(
  req: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env, "publish", ip);
  if (rl) return rl;

  const body = await readJson(req);
  if (!body || typeof body.turnstile_token !== "string") {
    return jsonResponse({ error: "missing turnstile_token" }, 400);
  }
  const turnstileOk = await verifyTurnstile(
    body.turnstile_token,
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!turnstileOk) return jsonResponse({ error: "turnstile failed" }, 401);

  // Validate design shape. `validateDesign` throws ValidationError on bad
  // input — wrap it into a 422 response.
  let design: Design;
  try {
    design = validateDesign(body.design);
  } catch (e) {
    const message =
      e instanceof ValidationError
        ? e.message
        : e instanceof Error
          ? e.message
          : "invalid design";
    return jsonResponse({ error: "invalid design", detail: message }, 422);
  }

  // Sanitize the three text fields.
  const nameRes = sanitizePublishField(body.name ?? "", {
    maxLength: LIMITS.name,
    multiline: false,
    allowEmpty: false,
  });
  if (!nameRes.ok)
    return jsonResponse({ error: `name: ${nameRes.reason}` }, 422);

  const authorRes = sanitizePublishField(body.author_name ?? "", {
    maxLength: LIMITS.author,
    multiline: false,
    allowEmpty: false,
  });
  if (!authorRes.ok)
    return jsonResponse({ error: `author_name: ${authorRes.reason}` }, 422);

  const descRes = sanitizePublishField(body.description ?? "", {
    maxLength: LIMITS.description,
    multiline: true,
    allowEmpty: true,
  });
  if (!descRes.ok)
    return jsonResponse({ error: `description: ${descRes.reason}` }, 422);

  try {
    const { id, slug } = await publishDesign(env, {
      design,
      name: nameRes.value,
      author_name: authorRes.value,
      description: descRes.value,
    });
    return jsonResponse({ id, slug }, 200);
  } catch (e) {
    if ((e as Error).message === "SLUG_COLLISION") {
      return jsonResponse(
        { error: "slug collision — please try again" },
        409,
      );
    }
    throw e;
  }
}

async function handleInstallAnonymous(
  req: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env, "install", ip);
  if (rl) return rl;

  const body = await readJson(req);
  if (!body || typeof body.turnstile_token !== "string") {
    return jsonResponse({ error: "missing turnstile_token" }, 400);
  }
  const turnstileOk = await verifyTurnstile(
    body.turnstile_token,
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!turnstileOk) return jsonResponse({ error: "turnstile failed" }, 401);

  let design: Design;
  try {
    design = validateDesign(body.design);
  } catch (e) {
    const message =
      e instanceof ValidationError
        ? e.message
        : e instanceof Error
          ? e.message
          : "invalid design";
    return jsonResponse({ error: "invalid design", detail: message }, 422);
  }

  const { id } = await insertInstallRecord(env, design);
  return jsonResponse({ id }, 201);
}

// ===========================================================================
// Helpers
// ===========================================================================

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function readJson(req: Request): Promise<any | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Exported for direct-handler tests (avoids the cost of unstable_dev).
export {
  handleListCommunity,
  handleGetCommunityBySlug,
  handleForkBump,
  handlePublish,
  handleInstallAnonymous,
  handleRobotsTxt,
  handleSitemapXml,
  handleCommunityOgSvg,
};
