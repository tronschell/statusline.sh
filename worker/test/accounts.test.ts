import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import worker, { registerRoutes, type Env } from "../src/index";
import { _clearRoutes } from "../src/router";
import { makeD1 } from "./helpers/d1";
import { renderInstaller } from "../src/handlers/installer";
import { resolveOAuthUser } from "../src/oauth";
import { entitlementUntil } from "../src/billing";
import { AUTO_UPDATE_MARKER } from "../src/install/autoUpdate";

const SECRET = "whsec_test";
const DAY = 86_400_000;
const ORIGIN = "http://localhost:3001";

const DESIGN = {
  version: 1,
  name: "T",
  elements: [{ id: "e1", type: "static", text: "hi", style: { fg: { kind: "ansi16", index: 2 } } }],
};

let env: Env & { DB: ReturnType<typeof makeD1> };
let calls: { url: string; init?: RequestInit }[];
let fetchImpl: (url: string, init?: RequestInit) => Response | Promise<Response>;
const realFetch = globalThis.fetch;
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

beforeEach(() => {
  // router.test.ts clears the shared route table; rebuild it for every test.
  _clearRoutes();
  registerRoutes();
  env = {
    DB: makeD1(),
    TURNSTILE_SITE_KEY: "x",
    TURNSTILE_SECRET_KEY: "x",
    ALLOWED_ORIGINS: ORIGIN,
    DEV_AUTH: "1",
    SITE_URL: ORIGIN,
    LEMONSQUEEZY_API_KEY: "k",
    LEMONSQUEEZY_STORE_ID: "1",
    LEMONSQUEEZY_VARIANT_ID: "2",
    LEMONSQUEEZY_WEBHOOK_SECRET: SECRET,
    RESEND_API_KEY: "re_x",
    EMAIL_FROM: "statusline.sh <no-reply@statusline.sh>",
    GITHUB_CLIENT_ID: "gh",
    GITHUB_CLIENT_SECRET: "ghs",
    GOOGLE_CLIENT_ID: "go",
    GOOGLE_CLIENT_SECRET: "gos",
  } as never;
  calls = [];
  fetchImpl = () => new Response("{}", { status: 404 });
  globalThis.fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    calls.push({ url, init });
    return fetchImpl(url, init);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function api(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string>; workerOrigin?: string } = {}) {
  const headers: Record<string, string> = { origin: ORIGIN, ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await worker.fetch(
    new Request(`${opts.workerOrigin ?? "http://localhost:8787"}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    env,
    ctx,
  );
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

async function devUser(username: string, pro = false) {
  const r = await api("POST", "/auth/dev", { body: { username, pro } });
  expect(r.status).toBe(200);
  return { token: r.json.token as string, id: r.json.user.id as string };
}

async function signWebhook(body: object, secret = SECRET) {
  const raw = JSON.stringify(body);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return { raw, sig: [...sig].map((b) => b.toString(16).padStart(2, "0")).join("") };
}

async function sendWebhook(userId: string, attrs: Record<string, unknown>, subId = "sub_1", workerOrigin = "http://localhost:8787") {
  const { raw, sig } = await signWebhook({
    meta: { event_name: "subscription_updated", custom_data: { user_id: userId } },
    data: { type: "subscriptions", id: subId, attributes: attrs },
  });
  const res = await worker.fetch(
    new Request(`${workerOrigin}/webhooks/lemonsqueezy`, { method: "POST", body: raw, headers: { "x-signature": sig } }),
    env,
    ctx,
  );
  return { status: res.status, json: (await res.json()) as any };
}

const iso = (ms: number) => new Date(ms).toISOString();
function activeSub(over: Record<string, unknown> = {}) {
  return { test_mode: false, store_id: 1, variant_id: 2, status: "active", customer_id: 9, renews_at: iso(Date.now() + 20 * DAY), ends_at: null, updated_at: iso(Date.now()), ...over };
}

// ---------------------------------------------------------------------------
describe("password accounts", () => {
  test("sign up, /me, sign in by email and by username", async () => {
    const su = await api("POST", "/auth/signup", { body: { email: "Ada@Example.com", username: "Ada_L", password: "correct horse" } });
    expect(su.status).toBe(201);
    expect(su.json.user.username).toBe("ada_l");
    expect(su.json.user.email).toBeUndefined(); // never in the public shape
    const me = await api("GET", "/me", { token: su.json.token });
    expect(me.json.account).toMatchObject({ email: "ada@example.com", email_verified: false, has_password: true, providers: [] });

    const byEmail = await api("POST", "/auth/login", { body: { identifier: "ada@example.com", password: "correct horse" } });
    const byName = await api("POST", "/auth/login", { body: { identifier: "@ADA_L", password: "correct horse" } });
    expect(byEmail.status).toBe(200);
    expect(byName.status).toBe(200);
  });

  test("validation, duplicates and identical failure for unknown user vs wrong password", async () => {
    await api("POST", "/auth/signup", { body: { email: "a@b.co", username: "alice", password: "password1" } });
    expect((await api("POST", "/auth/signup", { body: { email: "nope", password: "password1" } })).status).toBe(422);
    expect((await api("POST", "/auth/signup", { body: { email: "c@d.co", password: "short" } })).status).toBe(422);
    expect((await api("POST", "/auth/signup", { body: { email: "c@d.co", username: "admin", password: "password1" } })).status).toBe(422);
    const dupEmail = await api("POST", "/auth/signup", { body: { email: "A@b.co", username: "other", password: "password1" } });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.json.error).toMatch(/email/);
    const dupName = await api("POST", "/auth/signup", { body: { email: "z@z.co", username: "ALICE", password: "password1" } });
    expect(dupName.status).toBe(409);
    expect(dupName.json.error).toMatch(/username/);

    const wrong = await api("POST", "/auth/login", { body: { identifier: "alice", password: "wrongwrong" } });
    const ghost = await api("POST", "/auth/login", { body: { identifier: "nobody", password: "wrongwrong" } });
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(wrong.text).toBe(ghost.text);
  });

  test("signup without a username derives a free one", async () => {
    const a = await api("POST", "/auth/signup", { body: { email: "sam@x.io", password: "password1" } });
    const b = await api("POST", "/auth/signup", { body: { email: "sam@y.io", password: "password1" } });
    expect(a.json.user.username).toBe("sam");
    expect(b.json.user.username).toMatch(/^sam-\d{4}$/);
  });

  test("forgot password -> emailed link -> reset; token single use; sessions revoked", async () => {
    const su = await api("POST", "/auth/signup", { body: { email: "r@x.io", username: "resetme", password: "oldpassword" } });
    const old = su.json.token;
    fetchImpl = (u) => (u.includes("resend") ? new Response("{}", { status: 200 }) : new Response("no", { status: 404 }));

    const f = await api("POST", "/auth/forgot-password", { body: { email: "R@x.io" } });
    expect(f.json.ok).toBe(true);
    const mail = calls.find((c) => c.url.includes("api.resend.com"))!;
    const sent = JSON.parse(String(mail.init!.body));
    expect(sent.to).toEqual(["r@x.io"]);
    const token = /reset-password\?token=([\w-]+)/.exec(sent.text)![1]!;
    expect(token).toBe(f.json.dev_token); // dev mode echoes it for local testing only

    const bad = await api("POST", "/auth/reset-password", { body: { token: "nope", password: "newpassword" } });
    expect(bad.status).toBe(400);
    const ok = await api("POST", "/auth/reset-password", { body: { token, password: "newpassword" } });
    expect(ok.status).toBe(200);
    expect((await api("GET", "/me", { token: old })).status).toBe(401); // old session revoked
    expect((await api("GET", "/me", { token: ok.json.token })).status).toBe(200); // auto sign-in
    expect((await api("POST", "/auth/login", { body: { identifier: "resetme", password: "oldpassword" } })).status).toBe(401);
    expect((await api("POST", "/auth/login", { body: { identifier: "resetme", password: "newpassword" } })).status).toBe(200);
    expect((await api("POST", "/auth/reset-password", { body: { token, password: "another-pass" } })).status).toBe(400); // single use
    expect((await api("GET", "/me", { token: ok.json.token })).json.account.email_verified).toBe(true);
  });

  test("expired reset token is rejected", async () => {
    await api("POST", "/auth/signup", { body: { email: "e@x.io", username: "expiry", password: "oldpassword" } });
    const f = await api("POST", "/auth/forgot-password", { body: { email: "e@x.io" } });
    env.DB.raw.exec("UPDATE password_resets SET expires_at = 1");
    const r = await api("POST", "/auth/reset-password", { body: { token: f.json.dev_token, password: "newpassword" } });
    expect(r.status).toBe(400);
  });

  test("forgot-* never reveal whether an address has an account", async () => {
    fetchImpl = () => new Response("{}", { status: 200 });
    const a = await api("POST", "/auth/forgot-password", { body: { email: "ghost@x.io" } });
    const b = await api("POST", "/auth/forgot-username", { body: { email: "ghost@x.io" } });
    expect(a.json).toEqual({ ok: true });
    expect(b.json).toEqual({ ok: true });
    expect(calls.some((c) => c.url.includes("resend"))).toBe(false);
  });

  test("forgot username emails the handle", async () => {
    await api("POST", "/auth/signup", { body: { email: "u@x.io", username: "remindme", password: "password1" } });
    fetchImpl = () => new Response("{}", { status: 200 });
    await api("POST", "/auth/forgot-username", { body: { email: "u@x.io" } });
    const sent = JSON.parse(String(calls.find((c) => c.url.includes("resend"))!.init!.body));
    expect(sent.text).toContain("@remindme");
  });

  test("forgot-* answer 503 (not a silent no-op) when email isn't configured in production", async () => {
    delete env.RESEND_API_KEY;
    delete (env as any).DEV_AUTH;
    expect((await api("POST", "/auth/forgot-password", { body: { email: "a@b.co" } })).status).toBe(503);
    expect((await api("GET", "/auth/providers")).json.email).toBe(false);
  });

  test("change password needs the current one and revokes other sessions", async () => {
    const su = await api("POST", "/auth/signup", { body: { email: "c@x.io", username: "changer", password: "oldpassword" } });
    const other = (await api("POST", "/auth/login", { body: { identifier: "changer", password: "oldpassword" } })).json.token;
    expect((await api("POST", "/auth/change-password", { token: su.json.token, body: { current: "wrong-pass", next: "newpassword" } })).status).toBe(403);
    expect((await api("POST", "/auth/change-password", { token: su.json.token, body: { current: "oldpassword", next: "newpassword" } })).status).toBe(200);
    expect((await api("GET", "/me", { token: su.json.token })).status).toBe(200);
    expect((await api("GET", "/me", { token: other })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe("oauth (github + google)", () => {
  test("both providers explicitly select the request-host callback for live and test login", async () => {
    for (const workerOrigin of ["https://statusline-community.zoniixyt.workers.dev", "https://statusline-community-test.zoniixyt.workers.dev"]) {
      for (const provider of ["github", "google"] as const) {
        calls = [];
        fetchImpl = (url) => {
          if (url.includes("/token") || url.endsWith("/access_token")) return Response.json({ access_token: "synthetic-token" });
          if (url.endsWith("/user/emails")) return Response.json([{ email: "oauth-test@example.com", primary: true, verified: true }]);
          if (url.endsWith("/user")) return Response.json({ id: 4242, login: "callback-test", name: "Callback Test", avatar_url: "" });
          if (url.includes("/userinfo")) return Response.json({ sub: "test-sub", email: "oauth-test@example.com", email_verified: true, name: "Callback Test" });
          return new Response("missing mock", { status: 404 });
        };
        const start = await api("GET", `/auth/${provider}/start?return=${encodeURIComponent(ORIGIN + "/account")}`, { workerOrigin });
        const authorize = new URL(start.headers.get("location")!);
        expect(authorize.searchParams.get("redirect_uri")).toBe(`${workerOrigin}/auth/${provider}/callback`);
        expect(authorize.searchParams.get("scope")).toBe(provider === "github" ? "read:user user:email" : "openid email profile");
        const state = authorize.searchParams.get("state")!;
        const callback = await api("GET", `/auth/${provider}/callback?code=synthetic-code&state=${state}`, { workerOrigin });
        const exchange = calls.find(call => call.url.includes("/token") || call.url.endsWith("/access_token"))!;
        const sent = provider === "github" ? JSON.parse(String(exchange.init!.body)) : Object.fromEntries(new URLSearchParams(String(exchange.init!.body)));
        expect(sent.redirect_uri).toBe(`${workerOrigin}/auth/${provider}/callback`);
        expect(new URL(callback.headers.get("location")!).origin).toBe(ORIGIN);
        expect(new URL(callback.headers.get("location")!).hash).toContain("token=");
      }
    }
  });
  test("providers endpoint reports configuration", async () => {
    expect((await api("GET", "/auth/providers")).json).toMatchObject({ github: true, google: true, password: true, email: true });
    delete env.GOOGLE_CLIENT_ID;
    expect((await api("GET", "/auth/providers")).json.google).toBe(false);
    expect((await api("GET", `/auth/google/start?return=${encodeURIComponent(ORIGIN + "/account")}`)).status).toBe(503);
  });

  test("start rejects untrusted return origins and redirects to the provider", async () => {
    const evil = await api("GET", `/auth/github/start?return=${encodeURIComponent("https://evil.example/x")}`);
    expect(evil.status).toBe(400);
    const g = await api("GET", `/auth/google/start?return=${encodeURIComponent(ORIGIN + "/pricing")}`);
    expect(g.status).toBe(302);
    const loc = new URL(g.headers.get("location")!);
    expect(loc.host).toBe("accounts.google.com");
    expect(loc.searchParams.get("redirect_uri")).toBe("http://localhost:8787/auth/google/callback");
    expect(loc.searchParams.get("scope")).toBe("openid email profile");
  });

  async function runCallback(provider: "github" | "google", extra: () => void) {
    const start = await api("GET", `/auth/${provider}/start?return=${encodeURIComponent(ORIGIN + "/pricing")}`);
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    extra();
    const res = await api("GET", `/auth/${provider}/callback?code=abc&state=${state}`);
    return { res, state };
  }

  test("github full flow: session in the URL fragment, verified email + username from login", async () => {
    fetchImpl = (u) => {
      if (u.endsWith("/login/oauth/access_token")) return Response.json({ access_token: "t" });
      if (u.endsWith("/user/emails")) return Response.json([{ email: "gh@x.io", primary: true, verified: true }]);
      if (u.endsWith("/user")) return Response.json({ id: 42, login: "Octo-Cat", name: "Octo Cat", avatar_url: "https://a/x.png" });
      return new Response("no", { status: 404 });
    };
    const { res, state } = await runCallback("github", () => {});
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe(`${ORIGIN}/auth/callback`);
    const frag = new URLSearchParams(loc.hash.slice(1));
    const me = await api("GET", "/me", { token: frag.get("token")! });
    expect(me.json.user.username).toBe("octo-cat");
    expect(me.json.user.display_name).toBe("Octo Cat");
    expect(me.json.account).toMatchObject({ email: "gh@x.io", email_verified: true, has_password: false, providers: ["github"] });
    expect(frag.get("next")).toBe("/pricing");
    // state is single use
    expect((await api("GET", `/auth/github/callback?code=abc&state=${state}`)).status).toBe(400);
  });

  test("google full flow; unverified email is never trusted", async () => {
    fetchImpl = (u) => {
      if (u.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "t" });
      if (u.includes("openidconnect")) return Response.json({ sub: "g1", email: "g@x.io", email_verified: false, name: "Gee", picture: "" });
      return new Response("no", { status: 404 });
    };
    const { res } = await runCallback("google", () => {});
    const token = new URLSearchParams(new URL(res.headers.get("location")!).hash.slice(1)).get("token")!;
    const me = await api("GET", "/me", { token });
    expect(me.json.account.email).toBeNull();
    expect(me.json.user.username).toBe("user");
  });

  test("callback failures bounce back with an error, not a 500", async () => {
    fetchImpl = () => new Response("nope", { status: 500 });
    const { res } = await runCallback("github", () => {});
    expect(new URL(res.headers.get("location")!).hash).toBe("#error=github_failed");
  });

  test("same identity twice -> same account; verified email links to an existing account", async () => {
    const su = await api("POST", "/auth/signup", { body: { email: "link@x.io", username: "linker", password: "password1" } });
    const prof = { providerId: "77", email: "link@x.io", name: "L", avatar: "", handle: "linker" };
    const a = await resolveOAuthUser(env, "google", prof);
    const b = await resolveOAuthUser(env, "google", prof);
    expect(a).toBe(b);
    expect(a).toBe(su.json.user.id);
    const me = await api("GET", "/me", { token: su.json.token });
    expect(me.status).toBe(401); // squatter defence: unverified password account was reset on takeover
    const row = env.DB.raw.query("SELECT email_verified, password_hash FROM users WHERE id = ?").get(a) as any;
    expect(row).toEqual({ email_verified: 1, password_hash: null });
  });

  test("linking to a *verified* account keeps its password", async () => {
    const su = await api("POST", "/auth/signup", { body: { email: "v@x.io", username: "verifieduser", password: "password1" } });
    env.DB.raw.exec("UPDATE users SET email_verified = 1 WHERE username = 'verifieduser'");
    await resolveOAuthUser(env, "github", { providerId: "5", email: "v@x.io", name: null, avatar: "", handle: "v" });
    expect((await api("GET", "/me", { token: su.json.token })).status).toBe(200);
    expect((await api("POST", "/auth/login", { body: { identifier: "verifieduser", password: "password1" } })).status).toBe(200);
  });

  test("username collisions get a numeric suffix", async () => {
    await devUser("taken");
    const id = await resolveOAuthUser(env, "github", { providerId: "9", email: null, name: null, avatar: "", handle: "taken" });
    const row = env.DB.raw.query("SELECT username FROM users WHERE id = ?").get(id) as any;
    expect(row.username).toMatch(/^taken-\d{4}$/);
  });
});

// ---------------------------------------------------------------------------
describe("profile: usernames, donation link", () => {
  test("change username; reserved/taken/invalid rejected", async () => {
    const a = await devUser("first");
    await devUser("second");
    expect((await api("PATCH", "/me", { token: a.token, body: { username: "second" } })).status).toBe(409);
    expect((await api("PATCH", "/me", { token: a.token, body: { username: "community" } })).status).toBe(422);
    expect((await api("PATCH", "/me", { token: a.token, body: { username: "a b" } })).status).toBe(422);
    const ok = await api("PATCH", "/me", { token: a.token, body: { username: "@Fresh-Name" } });
    expect(ok.status).toBe(200);
    expect(ok.json.user.username).toBe("fresh-name");
    expect((await api("GET", "/auth/username-available?u=fresh-name")).json.available).toBe(false);
    expect((await api("GET", "/auth/username-available?u=brand-new")).json.available).toBe(true);
  });

  test("donation link must be a public https URL", async () => {
    const a = await devUser("donor");
    for (const bad of ["javascript:alert(1)", "http://x.com/y", "https://u:p@x.com", "https://localhost/x", "not a url"]) {
      expect((await api("PATCH", "/me", { token: a.token, body: { donation_url: bad } })).status).toBe(422);
    }
    const ok = await api("PATCH", "/me", { token: a.token, body: { donation_url: "https://ko-fi.com/donor" } });
    expect(ok.json.user.donation_url).toBe("https://ko-fi.com/donor");
    expect((await api("PATCH", "/me", { token: a.token, body: { donation_url: "" } })).json.user.donation_url).toBeNull();
  });

  test("dev sign-in is 404 outside DEV_AUTH", async () => {
    delete (env as any).DEV_AUTH;
    expect((await api("POST", "/auth/dev", { body: { username: "x-user" } })).status).toBe(404);
  });

  test("protected endpoints reject anonymous callers", async () => {
    for (const [m, p] of [["GET", "/me"], ["GET", "/library"], ["POST", "/library"], ["GET", "/teams"], ["POST", "/billing/checkout"], ["GET", "/me/designs"]] as const) {
      expect((await api(m, p)).status).toBe(401);
    }
    expect((await api("GET", "/me", { token: "garbage" })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe("billing (Lemon Squeezy)", () => {
  test("entitlementUntil by status", () => {
    const now = 1_000_000_000_000;
    const base = { renews_at: now + 10 * DAY, ends_at: now + 5 * DAY, ls_updated_at: now };
    expect(entitlementUntil({ ...base, status: "active" }, now)).toBeGreaterThan(now + 10 * DAY);
    expect(entitlementUntil({ ...base, status: "cancelled" }, now)).toBe(now + 5 * DAY);
    expect(entitlementUntil({ ...base, status: "expired" }, now)).toBe(0);
    expect(entitlementUntil({ ...base, status: "paused" }, now)).toBe(0);
    expect(entitlementUntil({ ...base, status: "past_due" }, now)).toBe(now + 3 * DAY);
  });

  test("webhook rejects bad/missing signatures and is 503 when unconfigured", async () => {
    const u = await devUser("payer");
    const { raw } = await signWebhook({ data: { type: "subscriptions", id: "1", attributes: activeSub() }, meta: { custom_data: { user_id: u.id } } });
    const send = (sig: string) =>
      worker.fetch(new Request("http://localhost:8787/webhooks/lemonsqueezy", { method: "POST", body: raw, headers: { "x-signature": sig } }), env, ctx);
    expect((await send("")).status).toBe(401);
    expect((await send("00".repeat(32))).status).toBe(401);
    const forged = (await signWebhook(JSON.parse(raw), "wrong-secret")).sig;
    expect((await send(forged)).status).toBe(401);
    expect((await api("GET", "/me", { token: u.token })).json.pro.active).toBe(false);
    delete env.LEMONSQUEEZY_WEBHOOK_SECRET;
    expect((await send("aa")).status).toBe(503);
  });

  test("subscription lifecycle: created -> pro, replay idempotent, stale ignored, cancelled keeps access until ends_at, expired ends it", async () => {
    const u = await devUser("subscriber");
    const t0 = Date.now();
    const created = await sendWebhook(u.id, activeSub({ updated_at: iso(t0) }));
    expect(created.status).toBe(200);
    let me = await api("GET", "/me", { token: u.token });
    expect(me.json.pro.active).toBe(true);
    expect(me.json.pro.status).toBe("active");

    // replay of the same event
    await sendWebhook(u.id, activeSub({ updated_at: iso(t0) }));
    expect(env.DB.raw.query("SELECT COUNT(*) n FROM subscriptions").get()).toEqual({ n: 1 });

    // cancel (still inside the paid period) at t0+1s
    await sendWebhook(u.id, activeSub({ status: "cancelled", ends_at: iso(t0 + 20 * DAY), renews_at: null, updated_at: iso(t0 + 1000) }));
    me = await api("GET", "/me", { token: u.token });
    expect(me.json.pro).toMatchObject({ active: true, status: "cancelled" });

    // an OLDER 'active' event arriving late must not resurrect/overwrite
    await sendWebhook(u.id, activeSub({ updated_at: iso(t0 - 5000) }));
    expect((await api("GET", "/me", { token: u.token })).json.pro.status).toBe("cancelled");

    // period ends
    await sendWebhook(u.id, activeSub({ status: "expired", ends_at: iso(t0 - DAY), renews_at: null, updated_at: iso(t0 + 2000) }));
    me = await api("GET", "/me", { token: u.token });
    expect(me.json.pro.active).toBe(false);
  });

  test("non-subscription events and unattributed subscriptions are ignored (200, no state)", async () => {
    const { raw, sig } = await signWebhook({ meta: {}, data: { type: "orders", id: "5", attributes: { status: "paid" } } });
    const r = await worker.fetch(new Request("http://localhost:8787/webhooks/lemonsqueezy", { method: "POST", body: raw, headers: { "x-signature": sig } }), env, ctx);
    expect(r.status).toBe(200);
    const r2 = await sendWebhook("no-such-user", activeSub());
    expect(r2.json.ignored).toBeDefined();
    expect(env.DB.raw.query("SELECT COUNT(*) n FROM subscriptions").get()).toEqual({ n: 0 });
  });

  test("checkout: creates an LS checkout carrying the user id; 409 if already Pro", async () => {
    const u = await devUser("buyer");
    fetchImpl = () => Response.json({ data: { attributes: { url: "https://pay.lemonsqueezy.com/checkout/abc", test_mode: false } } });
    const r = await api("POST", "/billing/checkout", { token: u.token });
    expect(r.json.url).toBe("https://pay.lemonsqueezy.com/checkout/abc");
    const sent = JSON.parse(String(calls[0]!.init!.body));
    expect(sent.data.attributes.test_mode).toBe(false);
    expect(sent.data.attributes.checkout_data.custom.user_id).toBe(u.id);
    expect(sent.data.attributes.product_options.redirect_url).toBe(`${ORIGIN}/account?checkout=success`);
    expect((calls[0]!.init!.headers as any).authorization).toBe("Bearer k");
    const pro = await devUser("already", true);
    expect((await api("POST", "/billing/checkout", { token: pro.token })).status).toBe(409);
  });

  test("signed test or unknown billing modes cannot grant Pro", async () => {
    const u = await devUser("modeguard");
    env.SITE_URL = "https://statusline.sh";
    for (const mode of [true, undefined, "false", null, 0]) {
      const r = await sendWebhook(u.id, activeSub({ test_mode: mode }));
      expect(r.status).toBe(200);
      expect(r.json.ignored).toBe("not a live subscription");
      expect(env.DB.raw.query("SELECT COUNT(*) n FROM subscriptions").get()).toEqual({ n: 0 });
      expect((await api("GET", "/me", { token: u.token })).json.pro.active).toBe(false);
    }
    const { raw } = await signWebhook({
      meta: { custom_data: { user_id: u.id } },
      data: { type: "subscriptions", id: "test", attributes: activeSub({ test_mode: true }) },
    });
    const invalid = await worker.fetch(new Request("http://localhost:8787/webhooks/lemonsqueezy", {
      method: "POST", body: raw, headers: { "x-signature": "00".repeat(32) },
    }), env, ctx);
    expect(invalid.status).toBe(401);
  });

  test("live webhook rejects missing or different store/variant without changing entitlements", async () => {
    const u = await devUser("livecommerce");
    const t0 = Date.now();
    await sendWebhook(u.id, activeSub({ updated_at: iso(t0) }));
    const original = env.DB.raw.query("SELECT * FROM subscriptions").all();
    const entitlement = env.DB.raw.query("SELECT pro_until FROM users WHERE id = ?").get(u.id);
    for (const mismatch of [{ store_id: 99 }, { variant_id: 99 }, { store_id: undefined }, { variant_id: undefined }]) {
      const r = await sendWebhook(u.id, activeSub({ ...mismatch, status: "expired", updated_at: iso(t0 + 1000) }));
      expect(r.json.ignored).toBeDefined();
      expect(env.DB.raw.query("SELECT * FROM subscriptions").all()).toEqual(original);
      expect(env.DB.raw.query("SELECT pro_until FROM users WHERE id = ?").get(u.id)).toEqual(entitlement);
    }
  });

  test("live portal and subscription management withhold other mode/store/variant responses", async () => {
    let index = 0;
    for (const mismatch of [{ test_mode: true }, { test_mode: undefined }, { store_id: 99 }, { variant_id: 99 }, { store_id: undefined }, { variant_id: undefined }]) {
      const u = await devUser(`liveportal${index++}`);
      const t0 = Date.now();
      await sendWebhook(u.id, activeSub({ updated_at: iso(t0) }), `liveportal_${index}`);
      const original = env.DB.raw.query("SELECT * FROM subscriptions WHERE user_id = ?").all(u.id);
      fetchImpl = () => Response.json({ data: { attributes: activeSub({
        ...mismatch, status: "cancelled", updated_at: iso(t0 + 1000),
        urls: { customer_portal: "https://x.lemonsqueezy.com/billing" },
      }) } });
      const portal = await api("POST", "/billing/portal", { token: u.token });
      expect(portal.status).toBe(502);
      expect(portal.json.url).toBeUndefined();
      expect((await api("POST", "/billing/cancel", { token: u.token })).status).toBe(502);
      expect(env.DB.raw.query("SELECT * FROM subscriptions WHERE user_id = ?").all(u.id)).toEqual(original);
    }
  });

  test("test cancellation and expiration cannot overwrite live entitlements", async () => {
    const u = await devUser("livepayer");
    env.SITE_URL = "https://statusline.sh";
    const t0 = Date.now();
    await sendWebhook(u.id, activeSub({ updated_at: iso(t0) }));
    const original = env.DB.raw.query("SELECT * FROM subscriptions").all();
    const entitlement = env.DB.raw.query("SELECT pro_until FROM users WHERE id = ?").get(u.id);
    for (const status of ["cancelled", "expired"]) {
      const r = await sendWebhook(u.id, activeSub({
        test_mode: true, status, ends_at: iso(t0 - DAY), renews_at: null, updated_at: iso(t0 + 1000),
      }));
      expect(r.json.ignored).toBe("not a live subscription");
      expect(env.DB.raw.query("SELECT * FROM subscriptions").all()).toEqual(original);
      expect(env.DB.raw.query("SELECT pro_until FROM users WHERE id = ?").get(u.id)).toEqual(entitlement);
    }
  });

  test("checkout withholds test or unknown mode responses", async () => {
    const u = await devUser("checkoutguard");
    env.SITE_URL = "https://statusline.sh";
    for (const mode of [true, undefined, "false", null]) {
      fetchImpl = () => Response.json({ data: { attributes: {
        url: "https://pay.lemonsqueezy.com/checkout/test", test_mode: mode,
      } } });
      const r = await api("POST", "/billing/checkout", { token: u.token });
      expect(r.status).toBe(502);
      expect(r.json.url).toBeUndefined();
    }
  });

  test("cancel and resume cannot apply test or unknown mode API responses", async () => {
    let index = 0;
    env.SITE_URL = "https://statusline.sh";
    for (const cancel of [true, false]) {
      for (const mode of [true, undefined, "false", null]) {
        const u = await devUser(`manageguard${index++}`);
        const t0 = Date.now();
        await sendWebhook(u.id, activeSub({
          status: cancel ? "active" : "cancelled", updated_at: iso(t0), ends_at: iso(t0 + 20 * DAY),
        }), `managed_${index}`);
        const original = env.DB.raw.query("SELECT * FROM subscriptions WHERE user_id = ?").all(u.id);
        const entitlement = env.DB.raw.query("SELECT pro_until FROM users WHERE id = ?").get(u.id);
        fetchImpl = () => Response.json({ data: { attributes: activeSub({
          test_mode: mode, status: cancel ? "cancelled" : "active", updated_at: iso(t0 + 1000),
        }) } });
        const r = await api("POST", cancel ? "/billing/cancel" : "/billing/resume", { token: u.token });
        expect(r.status).toBe(502);
        expect(env.DB.raw.query("SELECT * FROM subscriptions WHERE user_id = ?").all(u.id)).toEqual(original);
        expect(env.DB.raw.query("SELECT pro_until FROM users WHERE id = ?").get(u.id)).toEqual(entitlement);
      }
    }
  });

  test("manage subscription: portal links, cancel, resume", async () => {
    const u = await devUser("manager");
    expect((await api("POST", "/billing/portal", { token: u.token })).status).toBe(404);
    const t0 = Date.now();
    await sendWebhook(u.id, activeSub({ updated_at: iso(t0) }), "sub_9");

    fetchImpl = (url, init) => {
      if (init?.method === "PATCH") {
        const cancelled = JSON.parse(String(init.body)).data.attributes.cancelled;
        return Response.json({
          data: { attributes: { test_mode: false, store_id: 1, variant_id: 2, ...(cancelled
            ? { status: "cancelled", customer_id: 9, renews_at: null, ends_at: iso(t0 + 20 * DAY), updated_at: iso(t0 + 5000) }
            : { status: "active", customer_id: 9, renews_at: iso(t0 + 20 * DAY), ends_at: null, updated_at: iso(t0 + 9000) }) } },
        });
      }
      return Response.json({ data: { attributes: { test_mode: false, store_id: 1, variant_id: 2, urls: { customer_portal: "https://x.lemonsqueezy.com/billing", update_payment_method: "https://x.lemonsqueezy.com/pm" } } } });
    };
    const portal = await api("POST", "/billing/portal", { token: u.token });
    expect(portal.json).toEqual({ url: "https://x.lemonsqueezy.com/billing", update_payment_method_url: "https://x.lemonsqueezy.com/pm" });

    expect((await api("POST", "/billing/resume", { token: u.token })).status).toBe(409); // nothing to resume
    expect((await api("POST", "/billing/cancel", { token: u.token })).status).toBe(200);
    let me = await api("GET", "/me", { token: u.token });
    expect(me.json.pro).toMatchObject({ active: true, status: "cancelled" }); // access continues to period end
    expect((await api("POST", "/billing/cancel", { token: u.token })).status).toBe(409);
    expect((await api("POST", "/billing/resume", { token: u.token })).status).toBe(200);
    me = await api("GET", "/me", { token: u.token });
    expect(me.json.pro.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
describe("isolated test billing", () => {
  const testOrigin = "https://statusline-community-test.zoniixyt.workers.dev";
  const productionOrigin = "https://statusline-community.zoniixyt.workers.dev";
  function configureTest() {
    env.BILLING_MODE = "test";
    env.BILLING_TEST_DATABASE_ID = "a57b8712-a932-4a66-b586-0a0717149640";
    env.LEMONSQUEEZY_STORE_ID = "487279";
  }
  function testSub(over: Record<string, unknown> = {}) {
    return activeSub({ test_mode: true, store_id: 487279, product_id: 1401667, variant_id: 2, ...over });
  }
  test("test OAuth and CORS accept only the explicitly configured local frontend", async () => {
    configureTest();
    for (const origin of [ORIGIN, "http://127.0.0.1:3001", "https://statusline.sh", "https://statusline-maker.vercel.app", "https://unrelated.example"]) {
      env.ALLOWED_ORIGINS = `${ORIGIN},http://127.0.0.1:3001,https://unrelated.example`;
      const response = await api("GET", "/auth/providers", { workerOrigin: testOrigin, headers: { origin } });
      expect(response.headers.get("access-control-allow-origin")).toBe(origin.startsWith("http://") ? origin : null);
      const start = await api("GET", `/auth/github/start?return=${encodeURIComponent(origin + "/account")}`, { workerOrigin: testOrigin });
      expect(start.status).toBe(origin.startsWith("http://") ? 302 : 400);
    }
  });
  test("test configuration cannot enable billing on production or with another DB/site", async () => {
    const user = await devUser("isolation-check");
    configureTest();
    expect((await sendWebhook(user.id, testSub(), "sub", productionOrigin)).status).toBe(503);
    expect((await api("POST", "/billing/checkout", { token: user.token, workerOrigin: productionOrigin })).status).toBe(503);
    expect(calls).toHaveLength(0);
    for (const databaseId of [undefined, "c14c1902-21df-4cdd-a7bb-29921e8203d2", "another-db"]) {
      env.BILLING_TEST_DATABASE_ID = databaseId;
      expect((await sendWebhook(user.id, testSub(), "sub", testOrigin)).status).toBe(503);
    }
    configureTest();
    env.SITE_URL = "https://statusline.sh";
    expect((await sendWebhook(user.id, testSub(), "sub", testOrigin)).status).toBe(503);
    env.SITE_URL = ORIGIN;
    env.BILLING_MODE = undefined;
    expect((await sendWebhook(user.id, activeSub(), "sub", testOrigin)).status).toBe(503);
    expect(env.DB.raw.query("SELECT COUNT(*) n FROM subscriptions").get()).toEqual({ n: 0 });
  });
  test("isolated webhook rejects live/unknown modes, other commerce data and forged signatures", async () => {
    const user = await devUser("test-mode-check");
    configureTest();
    for (const changes of [{ test_mode: false }, { test_mode: undefined }, { test_mode: "true" }, { store_id: 406791 }, { variant_id: 3 }, { product_id: 1 }]) {
      const response = await sendWebhook(user.id, testSub(changes), "sub", testOrigin);
      expect(response.json.ignored).toBe("not a matching test subscription");
    }
    const { raw, sig } = await signWebhook({ meta: { custom_data: { user_id: user.id } }, data: { type: "subscriptions", id: "sub", attributes: testSub() } }, "wrong-key");
    expect((await worker.fetch(new Request(`${testOrigin}/webhooks/lemonsqueezy`, { method: "POST", body: raw, headers: { "x-signature": sig } }), env, ctx)).status).toBe(401);
    expect(env.DB.raw.query("SELECT COUNT(*) n FROM subscriptions").get()).toEqual({ n: 0 });
    expect((await api("GET", "/me", { token: user.token })).json.pro.active).toBe(false);
  });
  test("test lifecycle grants only test access and preserves replay/stale/cancel/resume/expiry behavior", async () => {
    const user = await devUser("test-lifecycle");
    configureTest();
    const now = Date.now();
    const send = (changes: Record<string, unknown>) => sendWebhook(user.id, testSub(changes), "test-sub", testOrigin);
    expect((await send({ updated_at: iso(now) })).status).toBe(200);
    expect((await api("GET", "/me", { token: user.token })).json.pro.active).toBe(true);
    await send({ updated_at: iso(now) });
    expect(env.DB.raw.query("SELECT COUNT(*) n FROM subscriptions").get()).toEqual({ n: 1 });
    await send({ status: "cancelled", ends_at: iso(now + 20 * DAY), renews_at: null, updated_at: iso(now + 1000) });
    await send({ updated_at: iso(now - 1000) });
    expect((await api("GET", "/me", { token: user.token })).json.pro.status).toBe("cancelled");
    await send({ updated_at: iso(now + 2000) });
    expect((await api("GET", "/me", { token: user.token })).json.pro.status).toBe("active");
    await send({ status: "expired", ends_at: iso(now - DAY), renews_at: null, updated_at: iso(now + 3000) });
    expect((await api("GET", "/me", { token: user.token })).json.pro.active).toBe(false);
  });
  test("test checkout requests test mode and withholds live/unknown response URLs", async () => {
    const user = await devUser("test-buyer");
    configureTest();
    fetchImpl = () => Response.json({ data: { attributes: { test_mode: true, url: "https://test.lemonsqueezy.com/checkout/example" } } });
    expect((await api("POST", "/billing/checkout", { token: user.token, workerOrigin: testOrigin })).status).toBe(200);
    const posted = JSON.parse(String(calls[0]!.init!.body));
    expect(posted.data.attributes.test_mode).toBe(true);
    expect(posted.data.relationships.store.data.id).toBe("487279");
    expect(posted.data.attributes.product_options.redirect_url).toBe(`${ORIGIN}/account?checkout=success`);
    for (const mode of [false, undefined, "true"]) {
      fetchImpl = () => Response.json({ data: { attributes: { test_mode: mode, url: "https://test.lemonsqueezy.com/checkout/example" } } });
      const response = await api("POST", "/billing/checkout", { token: user.token, workerOrigin: testOrigin });
      expect(response.status).toBe(502);
      expect(response.json.url).toBeUndefined();
    }
  });
  test("test cancel/resume and portal reject live or other-store responses before entitlement writes", async () => {
    const user = await devUser("test-manager");
    configureTest();
    const now = Date.now();
    await sendWebhook(user.id, testSub({ updated_at: iso(now) }), "test-managed", testOrigin);
    const original = env.DB.raw.query("SELECT * FROM subscriptions").all();
    for (const changes of [{ test_mode: false }, { store_id: 406791 }, { variant_id: 3 }]) {
      fetchImpl = () => Response.json({ data: { attributes: testSub({ ...changes, status: "cancelled", updated_at: iso(now + 1000), urls: { customer_portal: "https://test.lemonsqueezy.com/portal" } }) } });
      expect((await api("POST", "/billing/cancel", { token: user.token, workerOrigin: testOrigin })).status).toBe(502);
      expect((await api("POST", "/billing/portal", { token: user.token, workerOrigin: testOrigin })).status).toBe(502);
      expect(env.DB.raw.query("SELECT * FROM subscriptions").all()).toEqual(original);
    }
    fetchImpl = () => Response.json({ data: { attributes: testSub({ status: "cancelled", ends_at: iso(now + 20 * DAY), updated_at: iso(now + 1000) }) } });
    expect((await api("POST", "/billing/cancel", { token: user.token, workerOrigin: testOrigin })).status).toBe(200);
    const cancelled = env.DB.raw.query("SELECT * FROM subscriptions").all();
    fetchImpl = () => Response.json({ data: { attributes: testSub({ test_mode: false, updated_at: iso(now + 2000) }) } });
    expect((await api("POST", "/billing/resume", { token: user.token, workerOrigin: testOrigin })).status).toBe(502);
    expect(env.DB.raw.query("SELECT * FROM subscriptions").all()).toEqual(cancelled);
    fetchImpl = () => Response.json({ data: { attributes: testSub({ updated_at: iso(now + 2000) }) } });
    expect((await api("POST", "/billing/resume", { token: user.token, workerOrigin: testOrigin })).status).toBe(200);
    expect((await api("GET", "/me", { token: user.token })).json.pro.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
describe("cloud library + permanent links", () => {
  test("free: 3 designs, then a 402; no permanent link", async () => {
    const u = await devUser("freebie");
    for (let i = 0; i < 3; i++) {
      const r = await api("POST", "/library", { token: u.token, body: { design: DESIGN, name: `d${i}` } });
      expect(r.status).toBe(201);
      expect(r.json.link_enabled).toBe(false);
    }
    const over = await api("POST", "/library", { token: u.token, body: { design: DESIGN, name: "d4" } });
    expect(over.status).toBe(402);
    expect(over.json.error).toBe("pro_required");
    const first = (await api("GET", "/library", { token: u.token })).json.items[0];
    expect((await api("POST", `/library/${first.id}/link`, { token: u.token, body: { enabled: true } })).status).toBe(402);
    expect((await api("GET", `/i/${first.id}.sh`)).status).toBe(404); // private until link enabled
  });

  test("private designs are only visible to their owner", async () => {
    const a = await devUser("owner-a");
    const b = await devUser("owner-b");
    const d = await api("POST", "/library", { token: a.token, body: { design: DESIGN, name: "mine" } });
    expect((await api("GET", `/library/${d.json.id}`, { token: a.token })).status).toBe(200);
    expect((await api("GET", `/library/${d.json.id}`, { token: b.token })).status).toBe(404);
    expect((await api("PUT", `/library/${d.json.id}`, { token: b.token, body: { design: DESIGN } })).status).toBe(404);
    expect((await api("DELETE", `/library/${d.json.id}`, { token: b.token })).status).toBe(404);
    expect((await api("GET", "/community")).text).not.toContain("mine");
  });

  test("pro: auto link, versions, optimistic concurrency, restore, install script + updater stay in sync", async () => {
    const u = await devUser("pro-user", true);
    const c = await api("POST", "/library", { token: u.token, body: { design: DESIGN, name: "Live" } });
    expect(c.json.link_enabled).toBe(true);
    const id = c.json.id as string;
    expect(id).toHaveLength(12);

    const inst = await api("GET", `/i/${id}.sh`);
    expect(inst.status).toBe(200);
    expect(inst.headers.get("cache-control")).toBe("no-store");
    expect(inst.text).toContain(AUTO_UPDATE_MARKER);
    expect(inst.text).toContain(`http://localhost:8787/u/${id}.sh`);
    expect(inst.text).toContain("hi");

    const v2 = { ...DESIGN, elements: [{ ...DESIGN.elements[0]!, text: "second" }] };
    const upd = await api("PUT", `/library/${id}`, { token: u.token, body: { design: v2, expected_version: 1 } });
    expect(upd.json.version).toBe(2);
    expect((await api("PUT", `/library/${id}`, { token: u.token, body: { design: v2, expected_version: 1 } })).status).toBe(409);

    const script = await api("GET", `/u/${id}.sh`);
    expect(script.status).toBe(200);
    expect(script.text.startsWith("#!")).toBe(true);
    expect(script.text).toContain("second");
    expect(script.text).toContain(AUTO_UPDATE_MARKER);
    expect(inst.text).not.toContain("second"); // earlier fetch was v1

    const versions = await api("GET", `/library/${id}/versions`, { token: u.token });
    expect(versions.json.versions.map((v: any) => v.version)).toEqual([2, 1]);
    const rest = await api("POST", `/library/${id}/restore`, { token: u.token, body: { version: 1 } });
    expect(rest.json.version).toBe(3);
    expect((await api("GET", `/u/${id}.sh`)).text).toContain(">hi<".replace(/[<>]/g, "") );

    // turning the link off makes both endpoints 404
    await api("POST", `/library/${id}/link`, { token: u.token, body: { enabled: false } });
    expect((await api("GET", `/i/${id}.sh`)).status).toBe(404);
    expect((await api("GET", `/u/${id}.sh`)).status).toBe(404);
  });

  test("lapse: installed link keeps serving the last version, edits are blocked until renewed", async () => {
    const u = await devUser("lapser", true);
    const id = (await api("POST", "/library", { token: u.token, body: { design: DESIGN, name: "L" } })).json.id;
    env.DB.raw.exec("UPDATE users SET pro_until = 0 WHERE username = 'lapser'");
    expect((await api("GET", `/u/${id}.sh`)).status).toBe(200);
    const blocked = await api("PUT", `/library/${id}`, { token: u.token, body: { design: DESIGN } });
    expect(blocked.status).toBe(402);
    expect((await api("POST", `/library/${id}/link`, { token: u.token, body: { enabled: false } })).status).toBe(200);
    expect((await api("PUT", `/library/${id}`, { token: u.token, body: { design: DESIGN } })).status).toBe(200);
  });

  test("bad designs are rejected with 422", async () => {
    const u = await devUser("baddie");
    expect((await api("POST", "/library", { token: u.token, body: { design: { nope: 1 } } })).status).toBe(422);
  });

  test("legacy /i/:id installers are byte-identical to the pre-accounts renderer", async () => {
    env.DB.raw.exec(`INSERT INTO install_records (id, json, created_at) VALUES ('abcdefghij', '${JSON.stringify(DESIGN)}', ${Date.now()})`);
    const res = await api("GET", "/i/abcdefghij.sh");
    const expected = await renderInstaller(new Request("http://x"), DESIGN as never, "sh")!.text();
    expect(res.text).toBe(expected);
    expect(res.text).not.toContain(AUTO_UPDATE_MARKER);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect((await api("GET", "/u/abcdefghij.sh")).status).toBe(404); // legacy ids never served by the updater
  });

  test("updater prelude sits right after the shebang", async () => {
    const u = await devUser("updater", true);
    const id = (await api("POST", "/library", { token: u.token, body: { design: DESIGN, name: "U" } })).json.id;
    const lines = (await api("GET", `/u/${id}.sh`)).text.split("\n");
    expect(lines[0]).toMatch(/^#!/);
    expect(lines[1]).toContain(AUTO_UPDATE_MARKER);
  });
});

// ---------------------------------------------------------------------------
describe("teams", () => {
  test("Pro required to create; members join by invite, edit, and are removable; outsiders can't see it", async () => {
    const free = await devUser("nopro");
    expect((await api("POST", "/teams", { token: free.token, body: { name: "T", design: DESIGN } })).status).toBe(402);

    const owner = await devUser("boss", true);
    const mate = await devUser("mate");
    const out = await devUser("outsider");
    const t = await api("POST", "/teams", { token: owner.token, body: { name: "Platform", design: DESIGN } });
    expect(t.status).toBe(201);
    const team = t.json;
    expect(team.invite_token).toBeTruthy();
    const designId = team.design.id;
    expect((await api("GET", `/i/${designId}.sh`)).text).toContain(AUTO_UPDATE_MARKER); // team link is live immediately

    expect((await api("GET", `/teams/${team.id}`, { token: out.token })).status).toBe(404);
    expect((await api("POST", "/teams/join", { token: mate.token, body: { token: "bogus" } })).status).toBe(404);
    const join = await api("POST", "/teams/join", { token: mate.token, body: { token: team.invite_token } });
    expect(join.json.team_id).toBe(team.id);
    expect((await api("POST", "/teams/join", { token: mate.token, body: { token: team.invite_token } })).json.already_member).toBe(true);

    const view = await api("GET", `/teams/${team.id}`, { token: mate.token });
    expect(view.json.invite_token).toBeNull(); // only owners see/rotate the invite
    expect(view.json.members).toHaveLength(2);

    // free member edits the shared design; owner Pro powers it
    const v2 = { ...DESIGN, elements: [{ ...DESIGN.elements[0]!, text: "team-v2" }] };
    expect((await api("PUT", `/library/${designId}`, { token: mate.token, body: { design: v2 } })).status).toBe(200);
    expect((await api("GET", `/u/${designId}.sh`)).text).toContain("team-v2");
    expect((await api("PUT", `/library/${designId}`, { token: out.token, body: { design: v2 } })).status).toBe(404);

    // rotate invite invalidates the old one
    const rot = await api("POST", `/teams/${team.id}/invite`, { token: owner.token });
    expect((await api("POST", "/teams/join", { token: out.token, body: { token: team.invite_token } })).status).toBe(404);
    expect((await api("POST", "/teams/join", { token: out.token, body: { token: rot.json.invite_token } })).status).toBe(200);

    // member can leave; can't remove others; owner can't leave
    expect((await api("DELETE", `/teams/${team.id}/members/${owner.id}`, { token: mate.token })).status).toBe(409);
    expect((await api("DELETE", `/teams/${team.id}/members/${out.id}`, { token: mate.token })).status).toBe(404);
    expect((await api("DELETE", `/teams/${team.id}/members/${mate.id}`, { token: mate.token })).status).toBe(200);
    expect((await api("PUT", `/library/${designId}`, { token: mate.token, body: { design: v2 } })).status).toBe(404);

    // owner lapses -> team edits blocked but install keeps working
    env.DB.raw.exec("UPDATE users SET pro_until = 0 WHERE username = 'boss'");
    expect((await api("PUT", `/library/${designId}`, { token: owner.token, body: { design: v2 } })).status).toBe(402);
    expect((await api("GET", `/u/${designId}.sh`)).status).toBe(200);

    // deleting the team removes its design + link
    expect((await api("DELETE", `/teams/${team.id}`, { token: mate.token })).status).toBe(404);
    expect((await api("DELETE", `/teams/${team.id}`, { token: owner.token })).status).toBe(200);
    expect((await api("GET", `/u/${designId}.sh`)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe("community: owners, verified badge, featured, profiles", () => {
  async function publish(token: string, name: string) {
    const r = await api("POST", "/designs", { token, body: { design: DESIGN, name, description: "d" } });
    expect(r.status).toBe(200);
    return r.json as { id: string; slug: string };
  }

  test("signed-in publish skips Turnstile and attaches the owner; anonymous publish still needs Turnstile", async () => {
    const anon = await api("POST", "/designs", { body: { design: DESIGN, name: "Anon", author_name: "me", description: "" } });
    expect(anon.status).toBe(400);
    expect(anon.json.error).toBe("missing turnstile_token");

    const u = await devUser("maker");
    const d = await publish(u.token, "Owned One");
    const detail = await api("GET", `/community/${d.slug}`);
    expect(detail.json.author_name).toBe("maker");
    expect(detail.json.owner).toMatchObject({ username: "maker", verified: false, donation_url: null });
    expect((await api("POST", "/designs", { token: "junk", body: { design: DESIGN, name: "x", description: "" } })).status).toBe(401);
  });

  test("anonymous designs are returned in exactly the pre-accounts shape", async () => {
    const now = Date.now();
    env.DB.raw
      .query("INSERT INTO designs (id, json, slug, name, author_name, description, forked_from, published_at) VALUES ('anon000001', ?, 'old-one-abcd', 'Old', 'someone', '', NULL, ?)")
      .run(JSON.stringify(DESIGN), now);
    const list = await api("GET", "/community");
    expect(Object.keys(list.json.items[0]).sort()).toEqual(["author_name", "description", "design", "forked_from", "forks", "id", "installs", "name", "published_at", "slug", "views"]);
    const detail = await api("GET", "/community/old-one-abcd");
    expect(detail.json.owner).toBeUndefined();
  });

  test("verified badge + donation link + featured slots follow live Pro status", async () => {
    const u = await devUser("creator", true);
    await api("PATCH", "/me", { token: u.token, body: { donation_url: "https://ko-fi.com/creator" } });
    const ds = [];
    for (let i = 0; i < 4; i++) ds.push(await publish(u.token, `Design ${i}`));

    const detail = await api("GET", `/community/${ds[0]!.slug}`);
    expect(detail.json.owner).toMatchObject({ username: "creator", verified: true, donation_url: "https://ko-fi.com/creator" });

    for (let i = 0; i < 3; i++) expect((await api("POST", `/designs/${ds[i]!.id}/feature`, { token: u.token, body: { featured: true } })).status).toBe(200);
    const over = await api("POST", `/designs/${ds[3]!.id}/feature`, { token: u.token, body: { featured: true } });
    expect(over.status).toBe(409);
    expect(over.json.error).toBe("featured_limit");

    const feat = await api("GET", "/community/featured");
    expect(feat.json.items).toHaveLength(3);
    expect(feat.json.items[0].owner.verified).toBe(true);
    expect((await api("GET", "/community")).json.items.filter((i: any) => i.featured)).toHaveLength(3);

    // un-feature frees a slot
    await api("POST", `/designs/${ds[0]!.id}/feature`, { token: u.token, body: { featured: false } });
    expect((await api("POST", `/designs/${ds[3]!.id}/feature`, { token: u.token, body: { featured: true } })).status).toBe(200);

    // lapse: badge and featured placement vanish immediately, designs stay published
    env.DB.raw.exec("UPDATE users SET pro_until = 0 WHERE username = 'creator'");
    expect((await api("GET", "/community/featured")).json.items).toHaveLength(0);
    const after = await api("GET", `/community/${ds[1]!.slug}`);
    expect(after.json.owner.verified).toBe(false);
    expect(after.json.featured).toBeUndefined();
    expect((await api("POST", `/designs/${ds[0]!.id}/feature`, { token: u.token, body: { featured: true } })).status).toBe(402);
  });

  test("only the owner can feature a design", async () => {
    const a = await devUser("pro-a", true);
    const b = await devUser("pro-b", true);
    const d = await publish(a.token, "Mine");
    expect((await api("POST", `/designs/${d.id}/feature`, { token: b.token, body: { featured: true } })).status).toBe(404);
  });

  test("public profile page + my designs", async () => {
    const u = await devUser("profiled", true);
    await publish(u.token, "P One");
    const prof = await api("GET", "/users/profiled");
    expect(prof.status).toBe(200);
    expect(prof.json.user).toMatchObject({ username: "profiled", verified: true });
    expect(prof.json.user.email).toBeUndefined();
    expect(prof.json.designs).toHaveLength(1);
    expect((await api("GET", "/users/nobody-here")).status).toBe(404);
    expect((await api("GET", "/users/%20bad")).status).toBe(404);
    const mine = await api("GET", "/me/designs", { token: u.token });
    expect(mine.json).toMatchObject({ featured_cap: 3, featured_count: 0 });
    expect(mine.json.items).toHaveLength(1);
  });
});
