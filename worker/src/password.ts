/**
 * Email + password accounts and their recovery flows.
 *
 *  - sign up / sign in (identifier = email OR username)
 *  - "forgot password": emailed single-use link (1h) -> reset (revokes all sessions)
 *  - "forgot username": emailed reminder
 *  - "forgot email": there is nothing to email, so the recovery path is signing in
 *    with the username (or GitHub/Google); the account page then shows the email.
 *  - change password (revokes every *other* session)
 *
 * Hashing is PBKDF2-SHA256 via Web Crypto at 100k iterations (the Workers
 * maximum). Forgot-* endpoints always answer {ok:true} so they can't be used to
 * discover which addresses have accounts.
 */

import {
  USER_COLS,
  bearerToken,
  createSession,
  createUser,
  freeUsername,
  isDevAuth,
  isUniqueViolation,
  publicUser,
  randomToken,
  requireUser,
  sha256Hex,
  toBase64Url,
  validateUsername,
  type UserRow,
} from "./auth";
import { isAllowedOrigin } from "./cors";
import { emailConfigured, sendEmail } from "./email";
import { DEFAULT_SITE_URL, type AccountEnv } from "./env";
import { privateJson, readJson } from "./http";
import { checkRateLimit } from "./ratelimit";
import { getClientIp } from "./turnstile";

const ITERATIONS = 100_000;
const RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(await pbkdf2(password, salt, ITERATIONS))}`;
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iters, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iters || !salt || !hash) return false;
  const n = Number(iters);
  if (!Number.isInteger(n) || n < 1 || n > ITERATIONS) return false;
  return timingSafeEqual(await pbkdf2(password, fromB64Url(salt), n), fromB64Url(hash));
}

// A real hash to verify against when the account doesn't exist, so "no such
// user" and "wrong password" cost the same.
let dummyHash: Promise<string> | null = null;

function checkPasswordShape(pw: unknown): string | null {
  if (typeof pw !== "string") return "password is required";
  if (pw.length < MIN_PASSWORD) return `password must be at least ${MIN_PASSWORD} characters`;
  if (pw.length > MAX_PASSWORD) return `password must be at most ${MAX_PASSWORD} characters`;
  return null;
}

function normEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

async function guard(req: Request, env: AccountEnv, extraKey?: string): Promise<Response | null> {
  const ip = getClientIp(req) ?? "anon";
  const rl = await checkRateLimit(env, "auth", ip);
  if (rl) return rl;
  return extraKey ? checkRateLimit(env, "auth", `id:${extraKey}`) : null;
}

function siteOrigin(req: Request, env: AccountEnv): string {
  const o = req.headers.get("origin");
  if (o && isAllowedOrigin(o, env)) return o;
  return (env.SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------

export async function handleSignup(req: Request, env: AccountEnv): Promise<Response> {
  const blocked = await guard(req, env);
  if (blocked) return blocked;
  const body = await readJson(req);
  const email = normEmail(body?.email);
  if (!email) return privateJson({ error: "email: enter a valid email address" }, 422);
  const pwErr = checkPasswordShape(body?.password);
  if (pwErr) return privateJson({ error: pwErr }, 422);
  const name = body?.username ? validateUsername(body.username) : { ok: true as const, value: await freeUsername(env, email.split("@")[0]!) };
  if (!name.ok) return privateJson({ error: `username: ${name.reason}` }, 422);

  try {
    const id = await createUser(env, {
      username: name.value,
      email,
      emailVerified: false,
      passwordHash: await hashPassword(body.password),
      displayName: name.value,
    });
    const user = (await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).bind(id).first()) as UserRow;
    return privateJson({ token: await createSession(env, id), user: publicUser(user) }, 201);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const msg = String((e as Error).message);
    return privateJson(
      { error: /email/.test(msg) ? "email: already registered — sign in instead" : "username: already taken" },
      409,
    );
  }
}

export async function handleLogin(req: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(req);
  const ident = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const blocked = await guard(req, env, ident || undefined);
  if (blocked) return blocked;
  if (!ident || typeof body?.password !== "string" || body.password.length > MAX_PASSWORD) {
    return privateJson({ error: "invalid credentials" }, 401);
  }
  // "@name" is a handle; anything else containing "@" is an email.
  const col = ident.startsWith("@") || !ident.includes("@") ? "username" : "email";
  const user = (await env.DB
    .prepare(`SELECT ${USER_COLS} FROM users WHERE ${col} = ?`)
    .bind(ident.replace(/^@/, ""))
    .first()) as UserRow | null;

  dummyHash ??= hashPassword("statusline-dummy-password");
  const ok = await verifyPassword(body.password, user?.password_hash ?? (await dummyHash));
  if (!user || !user.password_hash || !ok) return privateJson({ error: "invalid credentials" }, 401);
  return privateJson({ token: await createSession(env, user.id), user: publicUser(user) });
}

export async function handleForgotPassword(req: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(req);
  const email = normEmail(body?.email);
  const blocked = await guard(req, env, email ?? undefined);
  if (blocked) return blocked;
  if (!emailConfigured(env) && !isDevAuth(req, env)) return privateJson({ error: "email is not configured" }, 503);

  const out: Record<string, unknown> = { ok: true };
  const user = email
    ? ((await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`).bind(email).first()) as UserRow | null)
    : null;
  if (user && email) {
    const token = randomToken(32);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(user.id),
      env.DB
        .prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(await sha256Hex(token), user.id, Date.now() + RESET_TTL_MS),
    ]);
    const link = `${siteOrigin(req, env)}/reset-password?token=${token}`;
    await sendEmail(env, {
      to: email,
      subject: "Reset your statusline.sh password",
      text: `Hi @${user.username},\n\nSomeone asked to reset the password for this account. Open this link within an hour to choose a new one:\n\n${link}\n\nIf that wasn't you, ignore this email — nothing changes.`,
    });
    if (isDevAuth(req, env)) out.dev_token = token;
  }
  return privateJson(out);
}

export async function handleResetPassword(req: Request, env: AccountEnv): Promise<Response> {
  const blocked = await guard(req, env);
  if (blocked) return blocked;
  const body = await readJson(req);
  const pwErr = checkPasswordShape(body?.password);
  if (pwErr) return privateJson({ error: pwErr }, 422);
  if (typeof body?.token !== "string" || !body.token) return privateJson({ error: "invalid or expired link" }, 400);

  const hash = await sha256Hex(body.token);
  const row = (await env.DB
    .prepare("SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?")
    .bind(hash)
    .first()) as { user_id: string; expires_at: number } | null;
  // Single use whether or not it was still valid.
  await env.DB.prepare("DELETE FROM password_resets WHERE token_hash = ?").bind(hash).run();
  if (!row || row.expires_at < Date.now()) return privateJson({ error: "invalid or expired link" }, 400);

  // Following the emailed link proves control of the address, so mark it verified.
  await env.DB.batch([
    env.DB
      .prepare("UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?")
      .bind(await hashPassword(body.password), row.user_id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
  ]);
  const user = (await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).bind(row.user_id).first()) as UserRow;
  return privateJson({ token: await createSession(env, user.id), user: publicUser(user) });
}

export async function handleForgotUsername(req: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(req);
  const email = normEmail(body?.email);
  const blocked = await guard(req, env, email ?? undefined);
  if (blocked) return blocked;
  if (!emailConfigured(env) && !isDevAuth(req, env)) return privateJson({ error: "email is not configured" }, 503);
  const user = email
    ? ((await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`).bind(email).first()) as UserRow | null)
    : null;
  if (user && email) {
    await sendEmail(env, {
      to: email,
      subject: "Your statusline.sh username",
      text: `Your statusline.sh username is @${user.username}.\n\nSign in at ${siteOrigin(req, env)}/signin — with your password, or with GitHub/Google if you used one of those.`,
    });
  }
  return privateJson({ ok: true });
}

export async function handleChangePassword(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const body = await readJson(req);
  const pwErr = checkPasswordShape(body?.next);
  if (pwErr) return privateJson({ error: pwErr }, 422);
  if (user.password_hash) {
    const ok = typeof body?.current === "string" && (await verifyPassword(body.current, user.password_hash));
    if (!ok) return privateJson({ error: "current password is incorrect" }, 403);
  }
  const keep = await sha256Hex(bearerToken(req) ?? "");
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(body.next), user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, keep),
  ]);
  return privateJson({ ok: true });
}
