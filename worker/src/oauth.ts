/**
 * OAuth sign-in with GitHub and Google.
 *
 * Both providers are reduced to the same `Profile` and resolved to a user by
 * `resolveOAuthUser`: known identity -> that user; else a *provider-verified*
 * email matching an existing account -> link to it; else create a new account.
 * Sessions are handed back to the SPA in the URL fragment (never sent to a
 * server, not logged) — see the SPA's /auth/callback.
 */

import { isAllowedOrigin } from "./cors";
import {
  STATE_TTL_MS,
  cleanDisplayName,
  createSession,
  createUser,
  freeUsername,
  isUniqueViolation,
  randomToken,
} from "./auth";
import type { AccountEnv } from "./env";
import { jsonResponse, redirect } from "./http";
import { checkRateLimit } from "./ratelimit";
import { getClientIp } from "./turnstile";

export type Provider = "github" | "google";

export interface Profile {
  providerId: string;
  /** Only ever a provider-VERIFIED address; null otherwise. */
  email: string | null;
  name: string | null;
  avatar: string;
  /** Preferred username seed (GitHub login / email local part). */
  handle: string;
}

function configured(env: AccountEnv, p: Provider): boolean {
  return p === "github"
    ? Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
    : Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function callbackUrl(req: Request, p: Provider): string {
  return `${new URL(req.url).origin}/auth/${p}/callback`;
}

export async function handleOAuthStart(req: Request, env: AccountEnv, p: Provider): Promise<Response> {
  if (!configured(env, p)) return jsonResponse({ error: `${p} sign-in is not configured` }, 503);
  const rl = await checkRateLimit(env, "auth", getClientIp(req) ?? "anon");
  if (rl) return rl;

  let ret: URL;
  try {
    ret = new URL(new URL(req.url).searchParams.get("return") ?? "");
  } catch {
    return jsonResponse({ error: "invalid return url" }, 400);
  }
  // Only ever bounce a session token back to an origin we already trust for CORS.
  if (!isAllowedOrigin(ret.origin, env)) return jsonResponse({ error: "return origin not allowed" }, 400);

  const state = randomToken(24);
  await env.DB
    .prepare("INSERT INTO oauth_states (state, provider, return_to, created_at) VALUES (?, ?, ?, ?)")
    .bind(state, p, ret.origin + ret.pathname, Date.now())
    .run();

  if (p === "github") {
    const u = new URL("https://github.com/login/oauth/authorize");
    u.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "read:user user:email");
    u.searchParams.set("allow_signup", "true");
    return redirect(u.toString());
  }
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri", callbackUrl(req, "google"));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return redirect(u.toString());
}

async function githubProfile(env: AccountEnv, code: string): Promise<Profile> {
  const tok = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  const { access_token } = (await tok.json()) as { access_token?: string };
  if (!tok.ok || !access_token) throw new Error("github token exchange failed");
  const headers = {
    authorization: `Bearer ${access_token}`,
    accept: "application/vnd.github+json",
    "user-agent": "statusline.sh",
  };
  const ures = await fetch("https://api.github.com/user", { headers });
  if (!ures.ok) throw new Error("github profile fetch failed");
  const u = (await ures.json()) as { id: number; login: string; name: string | null; avatar_url: string };
  if (typeof u.id !== "number" || typeof u.login !== "string") throw new Error("github profile malformed");

  let email: string | null = null;
  const eres = await fetch("https://api.github.com/user/emails", { headers });
  if (eres.ok) {
    const list = (await eres.json()) as { email: string; primary: boolean; verified: boolean }[];
    email = list.find((e) => e.primary && e.verified)?.email ?? list.find((e) => e.verified)?.email ?? null;
  }
  return { providerId: String(u.id), email, name: u.name, avatar: u.avatar_url ?? "", handle: u.login };
}

async function googleProfile(req: Request, env: AccountEnv, code: string): Promise<Profile> {
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(req, "google"),
      grant_type: "authorization_code",
    }),
  });
  const { access_token } = (await tok.json()) as { access_token?: string };
  if (!tok.ok || !access_token) throw new Error("google token exchange failed");
  const ures = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!ures.ok) throw new Error("google profile fetch failed");
  const u = (await ures.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!u.sub) throw new Error("google profile malformed");
  const email = u.email && u.email_verified === true ? u.email.toLowerCase() : null;
  return {
    providerId: u.sub,
    email,
    name: u.name ?? null,
    avatar: u.picture ?? "",
    handle: email ? email.split("@")[0]! : "user",
  };
}

/** Exported for tests; the network fetching above is the only untested part. */
export async function resolveOAuthUser(env: AccountEnv, p: Provider, prof: Profile): Promise<string> {
  const known = (await env.DB
    .prepare("SELECT user_id FROM identities WHERE provider = ? AND provider_id = ?")
    .bind(p, prof.providerId)
    .first()) as { user_id: string } | null;
  if (known) return known.user_id;

  const email = prof.email?.toLowerCase() ?? null;
  const byEmail = email
    ? ((await env.DB
        .prepare("SELECT id, email_verified FROM users WHERE email = ?")
        .bind(email)
        .first()) as { id: string; email_verified: number } | null)
    : null;

  let userId: string;
  if (byEmail) {
    userId = byEmail.id;
    if (!byEmail.email_verified) {
      // The address was typed into a password sign-up nobody verified. Whoever
      // proved they own it now wins: drop that password and its sessions so a
      // squatter can't keep access to the account they pre-registered.
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET email_verified = 1, password_hash = NULL WHERE id = ?").bind(userId),
        env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
      ]);
    }
  } else {
    userId = await createUser(env, {
      username: await freeUsername(env, prof.handle),
      email,
      emailVerified: email !== null,
      passwordHash: null,
      displayName: cleanDisplayName(prof.name ?? "", prof.handle),
      avatarUrl: prof.avatar,
    });
  }
  try {
    await env.DB
      .prepare("INSERT INTO identities (provider, provider_id, user_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(p, prof.providerId, userId, Date.now())
      .run();
  } catch (e) {
    // Two concurrent first sign-ins: the other request won, use its identity.
    if (!isUniqueViolation(e)) throw e;
    return resolveOAuthUser(env, p, prof);
  }
  if (prof.avatar) {
    await env.DB
      .prepare("UPDATE users SET avatar_url = ? WHERE id = ? AND avatar_url = ''")
      .bind(prof.avatar, userId)
      .run();
  }
  return userId;
}

export async function handleOAuthCallback(req: Request, env: AccountEnv, p: Provider): Promise<Response> {
  if (!configured(env, p)) return jsonResponse({ error: `${p} sign-in is not configured` }, 503);
  const rl = await checkRateLimit(env, "auth", getClientIp(req) ?? "anon");
  if (rl) return rl;

  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state) return new Response("missing state", { status: 400 });

  const row = (await env.DB
    .prepare("SELECT provider, return_to, created_at FROM oauth_states WHERE state = ?")
    .bind(state)
    .first()) as { provider: string; return_to: string; created_at: number } | null;
  // Single use: burn the state whether or not the rest succeeds.
  await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
  if (!row || row.provider !== p || Date.now() - row.created_at > STATE_TTL_MS) {
    return new Response("invalid or expired state", { status: 400 });
  }
  const ret = new URL(row.return_to);
  const back = (frag: string) => redirect(`${ret.origin}/auth/callback#${frag}`);

  if (!code) return back("error=cancelled");
  try {
    const prof = p === "github" ? await githubProfile(env, code) : await googleProfile(req, env, code);
    const userId = await resolveOAuthUser(env, p, prof);
    const token = await createSession(env, userId);
    return back(`token=${token}&next=${encodeURIComponent(ret.pathname)}`);
  } catch (e) {
    console.warn(`${p} oauth failed`, e);
    return back(`error=${p}_failed`);
  }
}
