import type { Design } from "@statusline/shared/types";
import { compileToBash } from "@statusline/shared/compiler/bash";
import { compileToPS } from "@statusline/shared/compiler/powershell";
import { bashInstallerTemplate } from "../install/bashTemplate";
import { psInstallerTemplate } from "../install/psTemplate";
import { getInstallTarget, incrementInstalls, type DbEnv } from "../designs";

export type InstallerEnv = DbEnv;

// Internal header stamped onto the cached body on a MISS so a HIT can
// replicate the install-count decision without re-reading D1. It is stripped
// from the response we return to the client (see handleInstaller).
const INSTALL_SOURCE_HEADER = "x-install-source";

// `caches.default` is a Workers-specific API. In Bun's test runtime there is
// no such global, so we feature-detect and silently no-op when absent —
// edge-caching here is a perf/D1-protection optimisation, not a correctness
// requirement. A small local copy (mirroring the one in index.ts) keeps this
// change confined to this file and avoids editing index.ts.
function getEdgeCache(): Cache | null {
  try {
    const g = globalThis as { caches?: { default?: Cache } };
    return g.caches?.default ?? null;
  } catch {
    return null;
  }
}

// Canonical cache key for a compiled installer body: keyed on `(id, ext)`
// only. The compiled body is byte-identical regardless of `?preview=1` or any
// cache-buster query param, and published designs / install_records are
// immutable, so dropping the query string maximises the hit rate without
// risking a stale body. Origin and arbitrary request headers are stripped too.
function buildInstallerCacheKey(id: string, ext: string): Request {
  const u = new URL("https://installer-cache.invalid/i/");
  u.pathname = `/i/${encodeURIComponent(id)}.${ext}`;
  return new Request(u.toString());
}

/**
 * Pure render step — no DB. The compiled-and-templated installer body for a
 * given Design + extension. Split out so tests can exercise the template
 * wiring without stubbing D1.
 *
 * Note: the underlying templates don't currently accept any options — the
 * `STATUSLINE_SELFHEAL=1` opt-in is read at install-time from the user's
 * env, not at template-generation time. The `selfheal` query param is
 * therefore accepted (for forward-compat / parity with the request shape)
 * but does not change the rendered output today.
 */
export function renderInstaller(
  _req: Request,
  design: Design,
  ext: string,
): Response | null {
  if (ext === "ps1") {
    const compiled = compileToPS(design);
    const body = psInstallerTemplate(compiled);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (ext === "sh") {
    const compiled = compileToBash(design);
    const body = bashInstallerTemplate(compiled);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/x-shellscript; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  return null;
}

export async function handleInstaller(
  req: Request,
  env: InstallerEnv,
  ctx: ExecutionContext,
  params: { id: string; ext: string },
): Promise<Response> {
  // `?preview=1` opts out of the install-count bump — the InstallDrawer
  // inspector uses it when fetching the script body for display so opening
  // the inspector doesn't inflate install counts. The compiled body is
  // identical either way, so preview and real requests share a cache entry.
  const isPreview = new URL(req.url).searchParams.get("preview") === "1";
  const cacheKey = buildInstallerCacheKey(params.id, params.ext);
  const edgeCache = getEdgeCache();

  // ----- Cache HIT -----
  // Avoid the D1 read + recompile entirely. We still need to bump the install
  // counter for published designs on real requests — the cached body carries
  // an internal `x-install-source` header so we can replicate that decision
  // without re-reading D1.
  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) {
      maybeIncrementInstalls(
        env,
        ctx,
        params.id,
        hit.headers.get(INSTALL_SOURCE_HEADER),
        isPreview,
      );
      // Rebuild the headers so we can strip the internal source marker and
      // stamp x-cache without mutating the (immutable) cached entry.
      const headers = new Headers(hit.headers);
      headers.delete(INSTALL_SOURCE_HEADER);
      headers.set("x-cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  // ----- Cache MISS -----
  const target = await getInstallTarget(env, params.id);
  if (!target) {
    // Never cache not-found responses — the id might be published later
    // (e.g. an install_records draft that then gets published as a design).
    return new Response("not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const res = renderInstaller(req, target.design, params.ext);
  if (!res) {
    return new Response("unknown installer extension", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Bump the per-design install counter for published community designs only.
  // Anonymous one-time drafts in `install_records` get no counter (they're
  // ephemeral).
  maybeIncrementInstalls(env, ctx, params.id, target.source, isPreview);

  // Build the response we serve to the client (with x-cache: MISS) and,
  // separately, the entry we stash in the edge cache (carrying the internal
  // x-install-source marker so future hits can replicate the increment
  // decision above).
  const body = await res.clone().text();
  const clientHeaders = new Headers(res.headers);
  clientHeaders.set("x-cache", "MISS");

  if (edgeCache) {
    const cacheHeaders = new Headers(res.headers);
    cacheHeaders.set(INSTALL_SOURCE_HEADER, target.source);
    const toCache = new Response(body, {
      status: res.status,
      headers: cacheHeaders,
    });
    ctx.waitUntil(
      edgeCache.put(cacheKey, toCache).catch((e) => {
        console.warn("installer edge-cache put failed", e);
      }),
    );
  }

  return new Response(body, { status: res.status, headers: clientHeaders });
}

// Bump the per-design install counter, but only for published `designs`
// targets on real (non-preview) requests. Anonymous `install_records` targets
// are ephemeral and never counted. Runs in the background via waitUntil so the
// response isn't blocked on the D1 write.
function maybeIncrementInstalls(
  env: InstallerEnv,
  ctx: ExecutionContext,
  id: string,
  source: string | null,
  isPreview: boolean,
): void {
  if (source !== "designs" || isPreview) return;
  ctx.waitUntil(
    incrementInstalls(env, id).catch((e) => {
      console.warn("installs increment failed", e);
    }),
  );
}
