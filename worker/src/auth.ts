/**
 * Accounts core: users, usernames, bearer-token sessions, /me, donation links.
 * Sign-in methods live in oauth.ts (GitHub, Google) and password.ts (email +
 * password, reset, username reminder); they all end in createSession().
 *
 * Why bearer tokens and not cookies: the SPA lives on statusline.sh (Vercel)
 * while this Worker is on workers.dev, so a session cookie would be a
 * third-party cookie that Safari/Chrome block. The SPA keeps the token in
 * localStorage and sends `Authorization: Bearer <token>`. Only the SHA-256 of a
 * token is stored, so a leaked D1 dump can't be replayed.
 *
 * Anonymous use (build, one-off install, anonymous publish/fork) never touches
 * this module.
 */

import { nanoid } from "nanoid";
import { emailConfigured } from "./email";
import { PLAN, type AccountEnv } from "./env";
import { jsonResponse, privateJson, readJson } from "./http";
import { checkRateLimit } from "./ratelimit";
import { sanitizePublishField } from "./sanitize";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STATE_TTL_MS = 10 * 60 * 1000;

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  email_verified: number;
  password_hash: string | null;
  display_name: string;
  avatar_url: string;
  donation_url: string | null;
  pro_until: number;
  created_at: number;
}

export const USER_COLS =
  "id, username, email, email_verified, password_hash, display_name, avatar_url, donation_url, pro_until, created_at";

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto only — no nodejs_compat)
// ---------------------------------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Entitlement
// ---------------------------------------------------------------------------

export function isPro(user: Pick<UserRow, "pro_until">, now = Date.now()): boolean {
  return user.pro_until > now;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(env: AccountEnv, userId: string): Promise<string> {
  const token = randomToken(32);
  const now = Date.now();
  await env.DB
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(await sha256Hex(token), userId, now, now + SESSION_TTL_MS)
    .run();
  return token;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !/^Bearer /i.test(h)) return null;
  const t = h.slice(7).trim();
  return t || null;
}

export async function getSessionUser(
  env: AccountEnv,
  req: Request,
): Promise<UserRow | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const row = (await env.DB
    .prepare(
      `SELECT ${USER_COLS.split(", ").map((c) => "u." + c).join(", ")}
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await sha256Hex(token), Date.now())
    .first()) as UserRow | null;
  return row;
}

/** Resolve the caller or produce the 401/429 response to return. */
export async function requireUser(
  env: AccountEnv,
  req: Request,
): Promise<UserRow | Response> {
  const user = await getSessionUser(env, req);
  if (!user) return privateJson({ error: "unauthorized" }, 401);
  const rl = await checkRateLimit(env, "account", user.id);
  if (rl) return rl;
  return user;
}

export async function getUserById(
  env: AccountEnv,
  id: string,
): Promise<UserRow | null> {
  return (await env.DB
    .prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`)
    .bind(id)
    .first()) as UserRow | null;
}

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    donation_url: u.donation_url,
  };
}

function billingConfigured(env: AccountEnv): boolean {
  return Boolean(
    env.LEMONSQUEEZY_API_KEY &&
      env.LEMONSQUEEZY_STORE_ID &&
      env.LEMONSQUEEZY_VARIANT_ID &&
      env.LEMONSQUEEZY_WEBHOOK_SECRET,
  );
}

// ---------------------------------------------------------------------------
// Donation link validation
// ---------------------------------------------------------------------------

export type DonationResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: string };

/**
 * Donation links are user-supplied and rendered as a public outbound link, so
 * be strict: https only (rejects javascript:/data:/http:), no embedded
 * credentials, a real dotted hostname, bounded length. Normalised via URL so
 * what we store is what the browser would navigate to.
 */
export function validateDonationUrl(raw: unknown): DonationResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, reason: "must be a string" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > 300) return { ok: false, reason: "too long (max 300)" };
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "must start with https://" };
  if (u.username || u.password) return { ok: false, reason: "must not contain credentials" };
  if (!u.hostname.includes(".")) return { ok: false, reason: "must be a public https link" };
  const normalised = u.toString();
  if (normalised.length > 300) return { ok: false, reason: "too long (max 300)" };
  return { ok: true, value: normalised };
}

// ---------------------------------------------------------------------------
// Usernames + user creation
// ---------------------------------------------------------------------------

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
// Paths/names that would be confusing or impersonating as a public @handle.
const RESERVED = new Set([
  "admin", "administrator", "api", "app", "auth", "account", "billing", "community", "designs",
  "help", "install", "library", "login", "logout", "me", "mod", "moderator", "null", "official",
  "pricing", "privacy", "root", "settings", "signin", "signup", "statusline", "support", "team",
  "teams", "terms", "undefined", "verified", "www",
]);

export type UsernameResult = { ok: true; value: string } | { ok: false; reason: string };

export function validateUsername(raw: unknown): UsernameResult {
  if (typeof raw !== "string") return { ok: false, reason: "must be a string" };
  const v = raw.trim().toLowerCase().replace(/^@/, "");
  if (!USERNAME_RE.test(v)) {
    return { ok: false, reason: "3-30 characters: letters, digits, dashes or underscores" };
  }
  if (RESERVED.has(v)) return { ok: false, reason: "that username is reserved" };
  return { ok: true, value: v };
}

export async function usernameTaken(env: AccountEnv, name: string): Promise<boolean> {
  return Boolean(await env.DB.prepare("SELECT 1 AS x FROM users WHERE username = ?").bind(name).first());
}

/** Turn a provider handle / email local-part into a free, valid username. */
export async function freeUsername(env: AccountEnv, hint: string): Promise<string> {
  let base = hint.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 24);
  if (base.length < 3) base = (base + "user").slice(0, 24);
  let cand = base;
  for (let i = 0; i < 8; i++) {
    const ok = validateUsername(cand);
    if (ok.ok && !(await usernameTaken(env, ok.value))) return ok.value;
    cand = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `user-${nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
}

export function cleanDisplayName(raw: string, fallback: string): string {
  const r = sanitizePublishField(raw || fallback, { maxLength: 60, multiline: false, allowEmpty: false });
  return r.ok ? r.value : fallback.slice(0, 60);
}

export function isUniqueViolation(e: unknown): boolean {
  return /UNIQUE constraint failed/i.test(e instanceof Error ? e.message : String(e));
}

export async function createUser(
  env: AccountEnv,
  u: {
    username: string;
    email: string | null;
    emailVerified: boolean;
    passwordHash: string | null;
    displayName: string;
    avatarUrl?: string;
  },
): Promise<string> {
  const id = nanoid(16);
  await env.DB
    .prepare(
      `INSERT INTO users (id, username, email, email_verified, password_hash, display_name, avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, u.username, u.email, u.emailVerified ? 1 : 0, u.passwordHash, u.displayName, u.avatarUrl ?? "", Date.now())
    .run();
  return id;
}

// ---------------------------------------------------------------------------
// Local-development sign-in (never reachable in production)
// ---------------------------------------------------------------------------

export function isDevAuth(req: Request, env: AccountEnv): boolean {
  const host = new URL(req.url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return env.DEV_AUTH === "1" && local;
}

export async function handleDevLogin(req: Request, env: AccountEnv): Promise<Response> {
  if (!isDevAuth(req, env)) return new Response("not found", { status: 404 });

  const body = await readJson(req);
  const name = validateUsername(body?.username);
  if (!name.ok) return jsonResponse({ error: `username: ${name.reason}` }, 422);
  let user = (await env.DB
    .prepare(`SELECT ${USER_COLS} FROM users WHERE username = ?`)
    .bind(name.value)
    .first()) as UserRow | null;
  if (!user) {
    const id = await createUser(env, {
      username: name.value,
      email: null,
      emailVerified: false,
      passwordHash: null,
      displayName: name.value,
    });
    user = (await getUserById(env, id))!;
  }
  if (body?.pro === true) {
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await env.DB.prepare("UPDATE users SET pro_until = ? WHERE id = ?").bind(until, user.id).run();
    user = { ...user, pro_until: until };
  }
  const token = await createSession(env, user.id);
  return privateJson({ token, user: publicUser(user) });
}

/** Which sign-in options the UI should offer (only what is actually configured). */
export function handleProviders(env: AccountEnv): Response {
  return jsonResponse(
    {
      github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      password: true,
      email: emailConfigured(env),
    },
    200,
    { "cache-control": "public, max-age=60" },
  );
}

export async function handleUsernameAvailable(req: Request, env: AccountEnv): Promise<Response> {
  const v = validateUsername(new URL(req.url).searchParams.get("u") ?? "");
  if (!v.ok) return jsonResponse({ available: false, reason: v.reason });
  return jsonResponse({ available: !(await usernameTaken(env, v.value)) });
}

// ---------------------------------------------------------------------------
// /me, logout
// ---------------------------------------------------------------------------

export async function handleMe(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;

  const sub = (await env.DB
    .prepare(
      `SELECT status, renews_at, ends_at FROM subscriptions
       WHERE user_id = ? ORDER BY ls_updated_at DESC LIMIT 1`,
    )
    .bind(user.id)
    .first()) as { status: string; renews_at: number | null; ends_at: number | null } | null;

  const ids = await env.DB
    .prepare("SELECT provider FROM identities WHERE user_id = ?")
    .bind(user.id)
    .all<{ provider: string }>();
  return privateJson({
    user: publicUser(user),
    // Private to the account owner: never part of publicUser().
    account: {
      email: user.email,
      email_verified: user.email_verified === 1,
      has_password: user.password_hash !== null,
      providers: ids.results.map((r) => r.provider),
    },
    pro: {
      active: isPro(user),
      until: user.pro_until || null,
      status: sub?.status ?? null,
      renews_at: sub?.renews_at ?? null,
      ends_at: sub?.ends_at ?? null,
    },
    plan: PLAN,
    billing_configured: billingConfigured(env),
  });
}

export async function handleUpdateMe(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const body = await readJson(req);
  if (!body || typeof body !== "object") return privateJson({ error: "invalid body" }, 400);

  let donation = user.donation_url;
  if ("donation_url" in body) {
    const r = validateDonationUrl(body.donation_url);
    if (!r.ok) return privateJson({ error: `donation_url: ${r.reason}` }, 422);
    donation = r.value;
  }
  let username = user.username;
  if ("username" in body) {
    const r = validateUsername(body.username);
    if (!r.ok) return privateJson({ error: `username: ${r.reason}` }, 422);
    username = r.value;
  }
  let displayName = user.display_name;
  if ("display_name" in body) {
    const r = sanitizePublishField(body.display_name ?? "", {
      maxLength: 60,
      multiline: false,
      allowEmpty: false,
    });
    if (!r.ok) return privateJson({ error: `display_name: ${r.reason}` }, 422);
    displayName = r.value;
  }
  try {
    await env.DB
      .prepare("UPDATE users SET donation_url = ?, display_name = ?, username = ? WHERE id = ?")
      .bind(donation, displayName, username, user.id)
      .run();
  } catch (e) {
    if (isUniqueViolation(e)) return privateJson({ error: "username: already taken" }, 409);
    throw e;
  }
  return privateJson({
    user: publicUser({ ...user, donation_url: donation, display_name: displayName, username }),
  });
}

export async function handleLogout(req: Request, env: AccountEnv): Promise<Response> {
  const token = bearerToken(req);
  if (token) {
    await env.DB
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256Hex(token))
      .run();
  }
  return privateJson({ ok: true });
}

/** Daily cron: expired sessions and stale OAuth states. */
export async function reapAuth(env: AccountEnv): Promise<void> {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
  await env.DB
    .prepare("DELETE FROM oauth_states WHERE created_at < ?")
    .bind(now - STATE_TTL_MS)
    .run();
  await env.DB.prepare("DELETE FROM password_resets WHERE expires_at < ?").bind(now).run();
}
