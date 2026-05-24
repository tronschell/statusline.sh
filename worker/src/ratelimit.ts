// Cloudflare Rate Limiting binding wrapper.
//
// Each endpoint gets its own binding so limits don't share counters. The
// binding API is `env.RATE_LIMITER_<NAME>.limit({ key })`. When the binding
// isn't configured (e.g. `wrangler dev --local` without the unsafe bindings),
// we treat the request as allowed.

export interface RateLimitBinding {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitEnv {
  RATE_LIMITER_PUBLISH?: RateLimitBinding;
  RATE_LIMITER_FORK?: RateLimitBinding;
  RATE_LIMITER_INSTALL?: RateLimitBinding;
  RATE_LIMITER_LIST?: RateLimitBinding;
  RATE_LIMITER_DETAIL?: RateLimitBinding;
  RATE_LIMITER_INSTALLER?: RateLimitBinding;
}

export type Endpoint = "publish" | "fork" | "install" | "list" | "detail" | "installer";

const BINDING_MAP: Record<Endpoint, keyof RateLimitEnv> = {
  publish: "RATE_LIMITER_PUBLISH",
  fork: "RATE_LIMITER_FORK",
  install: "RATE_LIMITER_INSTALL",
  list: "RATE_LIMITER_LIST",
  detail: "RATE_LIMITER_DETAIL",
  installer: "RATE_LIMITER_INSTALLER",
};

export async function checkRateLimit(
  env: RateLimitEnv,
  endpoint: Endpoint,
  key: string,
): Promise<Response | null> {
  const binding = env[BINDING_MAP[endpoint]];
  if (!binding) return null; // not configured (e.g. local dev): allow
  const { success } = await binding.limit({ key });
  if (success) return null;
  return new Response("rate limited", {
    status: 429,
    headers: { "retry-after": "60", "content-type": "text/plain" },
  });
}
