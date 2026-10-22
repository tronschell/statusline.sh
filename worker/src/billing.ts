/**
 * Lemon Squeezy billing.
 *
 * Source of truth for "is this user Pro" is the signed webhook, never the
 * checkout redirect: `POST /webhooks/lemonsqueezy` verifies the HMAC signature,
 * upserts the subscription row, and recomputes `users.pro_until`. Everything
 * else (badge, featured slots, permanent links) reads that single column.
 */

import { isAllowedOrigin } from "./cors";
import { DEFAULT_SITE_URL, type AccountEnv } from "./env";
import { jsonResponse, privateJson } from "./http";
import { requireUser } from "./auth";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Slack after a renewal date so a late webhook never flickers Pro off. */
const RENEWAL_GRACE_MS = 2 * DAY_MS;
/** Card-failure dunning: keep access this long after the last status change. */
const PAST_DUE_GRACE_MS = 3 * DAY_MS;

const LS_API = "https://api.lemonsqueezy.com";

// This opt-in is restricted to the approved test resource. A test setting on
// production fails closed; the default production policy remains live-only.
const TEST_BILLING_ORIGIN = "https://statusline-community-test.zoniixyt.workers.dev";
const TEST_BILLING_DATABASE_ID = "a57b8712-a932-4a66-b586-0a0717149640";
const TEST_STORE_ID = "487279";
const TEST_PRODUCT_ID = "1401667";

function billingMode(req: Request, env: AccountEnv): boolean | null {
  const origin = new URL(req.url).origin;
  if (env.BILLING_MODE === "test") {
    return origin === TEST_BILLING_ORIGIN &&
      env.BILLING_TEST_DATABASE_ID === TEST_BILLING_DATABASE_ID &&
      env.SITE_URL === "http://localhost:3001" ? true : null;
  }
  if (env.BILLING_MODE !== undefined && env.BILLING_MODE !== "live") return null;
  // Never use live billing on the isolated test hostname, even if misconfigured.
  return origin === TEST_BILLING_ORIGIN ? null : false;
}

function subscriptionMatches(attrs: any, mode: boolean, env: AccountEnv): boolean {
  if (attrs?.test_mode !== mode || !env.LEMONSQUEEZY_STORE_ID || !env.LEMONSQUEEZY_VARIANT_ID) return false;
  if (String(attrs.store_id) !== env.LEMONSQUEEZY_STORE_ID ||
      String(attrs.variant_id) !== env.LEMONSQUEEZY_VARIANT_ID) return false;
  return !mode || (
    env.LEMONSQUEEZY_STORE_ID === TEST_STORE_ID &&
    String(attrs.product_id) === TEST_PRODUCT_ID
  );
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  customer_id: string;
  status: string;
  renews_at: number | null;
  ends_at: number | null;
  ls_updated_at: number;
}

/**
 * Epoch-ms until which one subscription grants Pro (0 = no access).
 *  - active / on_trial: through the next renewal (+ grace)
 *  - cancelled: through the paid period (`ends_at`) — LS's own grace semantics
 *  - past_due: short dunning grace
 *  - paused / unpaid / expired / unknown: none
 */
export function entitlementUntil(
  s: Pick<SubscriptionRow, "status" | "renews_at" | "ends_at" | "ls_updated_at">,
  now = Date.now(),
): number {
  switch (s.status) {
    case "active":
    case "on_trial":
      return (s.renews_at ?? now + 7 * DAY_MS) + RENEWAL_GRACE_MS;
    case "cancelled":
      return s.ends_at ?? 0;
    case "past_due":
      return s.ls_updated_at + PAST_DUE_GRACE_MS;
    default:
      return 0;
  }
}

export async function recomputeProUntil(env: AccountEnv, userId: string): Promise<number> {
  const res = await env.DB
    .prepare(
      `SELECT id, user_id, customer_id, status, renews_at, ends_at, ls_updated_at
       FROM subscriptions WHERE user_id = ?`,
    )
    .bind(userId)
    .all<SubscriptionRow>();
  const now = Date.now();
  const until = res.results.reduce((m, s) => Math.max(m, entitlementUntil(s, now)), 0);
  await env.DB.prepare("UPDATE users SET pro_until = ? WHERE id = ?").bind(until, userId).run();
  return until;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Constant-time HMAC-SHA256 check of `X-Signature` (hex) over the raw body. */
export async function verifyLemonSignature(
  secret: string,
  rawBody: string,
  signatureHex: string,
): Promise<boolean> {
  const sig = hexToBytes(signatureHex.trim());
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(rawBody));
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

function parseTime(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Store one subscription snapshot. The WHERE clause makes replays idempotent
 * and drops older, out-of-order deliveries instead of letting them overwrite
 * newer state. Used by both the webhook and the in-app cancel/resume calls.
 */
async function upsertSubscription(
  env: AccountEnv,
  userId: string,
  subId: string,
  attrs: any,
): Promise<void> {
  const now = Date.now();
  const lsUpdated = parseTime(attrs.updated_at) ?? now;
  await env.DB
    .prepare(
      `INSERT INTO subscriptions
         (id, user_id, customer_id, status, renews_at, ends_at, ls_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         customer_id = excluded.customer_id,
         status = excluded.status,
         renews_at = excluded.renews_at,
         ends_at = excluded.ends_at,
         ls_updated_at = excluded.ls_updated_at,
         updated_at = excluded.updated_at
       WHERE excluded.ls_updated_at >= subscriptions.ls_updated_at`,
    )
    .bind(
      subId,
      userId,
      attrs.customer_id != null ? String(attrs.customer_id) : "",
      String(attrs.status ?? ""),
      parseTime(attrs.renews_at),
      parseTime(attrs.ends_at),
      lsUpdated,
      now,
      now,
    )
    .run();
}

export async function handleLemonWebhook(req: Request, env: AccountEnv): Promise<Response> {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return jsonResponse({ error: "billing not configured" }, 503);
  const mode = billingMode(req, env);
  if (mode === null) return jsonResponse({ error: "billing environment mismatch" }, 503);

  // Raw text first: the signature covers the exact bytes LS sent.
  const raw = await req.text();
  const ok = await verifyLemonSignature(secret, raw, req.headers.get("x-signature") ?? "");
  if (!ok) return jsonResponse({ error: "invalid signature" }, 401);

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const data = payload?.data;
  // Orders / invoices etc. also hit this endpoint if subscribed; the
  // subscription object carries the state we need, so ignore the rest.
  if (data?.type !== "subscriptions" || typeof data.id !== "string" && typeof data.id !== "number") {
    return jsonResponse({ ok: true, ignored: "not a subscription event" });
  }
  const subId = String(data.id);
  const attrs = data.attributes ?? {};
  // Both modes require their configured store and variant. Production also
  // requires an explicit live marker; test pins the approved product as well.
  if (!subscriptionMatches(attrs, mode, env)) {
    return jsonResponse({ ok: true, ignored: mode ? "not a matching test subscription" : "not a live subscription" });
  }
  const status = typeof attrs.status === "string" ? attrs.status : "";
  if (!status) return jsonResponse({ ok: true, ignored: "no status" });

  // Attribute to a user: custom data set at checkout, else the row we already
  // stored for this subscription id.
  const customUser = payload?.meta?.custom_data?.user_id;
  let userId: string | null = customUser != null ? String(customUser) : null;
  if (!userId) {
    const existing = (await env.DB
      .prepare("SELECT user_id FROM subscriptions WHERE id = ?")
      .bind(subId)
      .first()) as { user_id: string } | null;
    userId = existing?.user_id ?? null;
  }
  if (!userId) return jsonResponse({ ok: true, ignored: "unattributed subscription" });
  const user = (await env.DB
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(userId)
    .first()) as { id: string } | null;
  if (!user) return jsonResponse({ ok: true, ignored: "unknown user" });

  await upsertSubscription(env, userId, subId, attrs);

  const until = await recomputeProUntil(env, userId);
  return jsonResponse({ ok: true, status, pro_until: until });
}

// ---------------------------------------------------------------------------
// Checkout + customer portal
// ---------------------------------------------------------------------------

function lsBase(env: AccountEnv): string {
  return (env.LEMONSQUEEZY_API_BASE ?? LS_API).replace(/\/+$/, "");
}

function lsHeaders(env: AccountEnv): Record<string, string> {
  return {
    accept: "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
    authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
  };
}

function checkoutConfigured(env: AccountEnv): boolean {
  return Boolean(
    env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID && env.LEMONSQUEEZY_VARIANT_ID,
  );
}

function returnOrigin(req: Request, env: AccountEnv): string {
  const o = req.headers.get("origin");
  if (o && isAllowedOrigin(o, env)) return o;
  return (env.SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export async function handleCheckout(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  if (!checkoutConfigured(env) || !env.LEMONSQUEEZY_WEBHOOK_SECRET) return privateJson({ error: "billing not configured" }, 503);
  const mode = billingMode(req, env);
  if (mode === null || mode && env.LEMONSQUEEZY_STORE_ID !== TEST_STORE_ID) {
    return privateJson({ error: "billing environment mismatch" }, 503);
  }
  if (user.pro_until > Date.now()) {
    return privateJson({ error: "already subscribed" }, 409);
  }

  const res = await fetch(`${lsBase(env)}/v1/checkouts`, {
    method: "POST",
    headers: lsHeaders(env),
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          test_mode: mode,
          product_options: {
            redirect_url: `${returnOrigin(req, env)}/account?checkout=success`,
            enabled_variants: [Number(env.LEMONSQUEEZY_VARIANT_ID)],
          },
          checkout_data: { custom: { user_id: user.id } },
        },
        relationships: {
          store: { data: { type: "stores", id: String(env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(env.LEMONSQUEEZY_VARIANT_ID) } },
        },
      },
    }),
  });
  if (!res.ok) {
    console.warn("lemonsqueezy checkout failed", res.status);
    return privateJson({ error: "could not start checkout" }, 502);
  }
  const json = (await res.json()) as { data?: { attributes?: { url?: string; test_mode?: unknown } } };
  const url = json.data?.attributes?.url;
  if (json.data?.attributes?.test_mode !== mode || typeof url !== "string" || !url.startsWith("https://")) {
    return privateJson({ error: "could not start checkout" }, 502);
  }
  return privateJson({ url });
}

async function latestSubscription(env: AccountEnv, userId: string) {
  return (await env.DB
    .prepare("SELECT id, status FROM subscriptions WHERE user_id = ? ORDER BY ls_updated_at DESC LIMIT 1")
    .bind(userId)
    .first()) as { id: string; status: string } | null;
}

export async function handlePortal(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  if (!checkoutConfigured(env)) return privateJson({ error: "billing not configured" }, 503);
  const mode = billingMode(req, env);
  if (mode === null || mode && env.LEMONSQUEEZY_STORE_ID !== TEST_STORE_ID) {
    return privateJson({ error: "billing environment mismatch" }, 503);
  }

  const sub = await latestSubscription(env, user.id);
  if (!sub) return privateJson({ error: "no subscription" }, 404);

  // Portal URLs are pre-signed and expire after 24h, so fetch fresh ones.
  const res = await fetch(`${lsBase(env)}/v1/subscriptions/${encodeURIComponent(sub.id)}`, {
    headers: lsHeaders(env),
  });
  if (!res.ok) return privateJson({ error: "could not load billing portal" }, 502);
  const json = (await res.json()) as {
    data?: { attributes?: { test_mode?: unknown; store_id?: unknown; product_id?: unknown; variant_id?: unknown; urls?: { customer_portal?: string; update_payment_method?: string } } };
  };
  if (!subscriptionMatches(json.data?.attributes, mode, env)) {
    return privateJson({ error: "could not load billing portal" }, 502);
  }
  const urls = json.data?.attributes?.urls;
  const ok = (u: unknown): u is string => typeof u === "string" && u.startsWith("https://");
  if (!ok(urls?.customer_portal)) return privateJson({ error: "could not load billing portal" }, 502);
  return privateJson({
    url: urls.customer_portal,
    update_payment_method_url: ok(urls.update_payment_method) ? urls.update_payment_method : null,
  });
}

/** Cancel at period end (`cancel: true`) or undo a pending cancellation (`false`). */
async function setCancelled(req: Request, env: AccountEnv, cancel: boolean): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  if (!checkoutConfigured(env)) return privateJson({ error: "billing not configured" }, 503);
  const mode = billingMode(req, env);
  if (mode === null || mode && env.LEMONSQUEEZY_STORE_ID !== TEST_STORE_ID) {
    return privateJson({ error: "billing environment mismatch" }, 503);
  }
  const sub = await latestSubscription(env, user.id);
  if (!sub) return privateJson({ error: "no subscription" }, 404);
  // Only meaningful states: can't cancel what is already cancelled/expired, and
  // LS refuses to resume an expired subscription.
  const allowed = cancel ? ["active", "on_trial", "past_due"] : ["cancelled"];
  if (!allowed.includes(sub.status)) {
    return privateJson({ error: `subscription is ${sub.status}` }, 409);
  }

  const res = await fetch(`${lsBase(env)}/v1/subscriptions/${encodeURIComponent(sub.id)}`, {
    method: "PATCH",
    headers: lsHeaders(env),
    body: JSON.stringify({ data: { type: "subscriptions", id: sub.id, attributes: { cancelled: cancel } } }),
  });
  if (!res.ok) {
    console.warn("lemonsqueezy subscription update failed", res.status);
    return privateJson({ error: "could not update subscription" }, 502);
  }
  // Apply the response now so the page reflects it immediately; the follow-up
  // webhook re-applies the same state idempotently.
  const json = (await res.json()) as { data?: { attributes?: unknown } };
  const attrs = json.data?.attributes as { test_mode?: unknown } | undefined;
  if (!subscriptionMatches(attrs, mode, env)) {
    return privateJson({ error: "could not update subscription" }, 502);
  }
  await upsertSubscription(env, user.id, sub.id, attrs);
  const until = await recomputeProUntil(env, user.id);
  return privateJson({ ok: true, pro_until: until });
}

export const handleCancelSubscription = (req: Request, env: AccountEnv) => setCancelled(req, env, true);
export const handleResumeSubscription = (req: Request, env: AccountEnv) => setCancelled(req, env, false);
