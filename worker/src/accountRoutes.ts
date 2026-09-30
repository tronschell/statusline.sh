/**
 * Route table for accounts, billing, the cloud library, teams and the
 * owner-derived community features. `registerAccountRoutes()` is called from
 * index.ts before its own routes; every path here is new, so no existing route
 * is shadowed (and `/community/featured` lands ahead of `/community/:slug`).
 */

import { route } from "./router";
import {
  handleDevLogin,
  handleLogout,
  handleMe,
  handleProviders,
  handleUpdateMe,
  handleUsernameAvailable,
} from "./auth";
import {
  handleCancelSubscription,
  handleCheckout,
  handleLemonWebhook,
  handlePortal,
  handleResumeSubscription,
} from "./billing";
import { handleCloudScript } from "./handlers/installer";
import {
  handleCreateLibrary,
  handleDeleteLibrary,
  handleGetLibrary,
  handleListLibrary,
  handleListVersions,
  handlePublishFromLibrary,
  handleRestoreVersion,
  handleSetLink,
  handleUpdateLibrary,
} from "./library";
import { handleOAuthCallback, handleOAuthStart } from "./oauth";
import { handleMyDesigns, handlePublicProfile, handleSetFeatured, listFeatured } from "./owners";
import {
  handleChangePassword,
  handleForgotPassword,
  handleForgotUsername,
  handleLogin,
  handleResetPassword,
  handleSignup,
} from "./password";
import { checkRateLimit } from "./ratelimit";
import {
  handleCreateTeam,
  handleDeleteTeam,
  handleGetTeam,
  handleJoinTeam,
  handleListTeams,
  handleRemoveMember,
  handleRotateInvite,
} from "./teams";
import { jsonResponse } from "./http";
import { getClientIp } from "./turnstile";


export async function handleFeatured(req: Request, env: { DB: D1Database }): Promise<Response> {
  const rl = await checkRateLimit(env as never, "list", getClientIp(req) ?? "anon");
  if (rl) return rl;
  try {
    return jsonResponse({ items: await listFeatured(env) }, 200, { "cache-control": "public, s-maxage=60" });
  } catch (e) {
    // Accounts migration not applied yet: featured is simply empty.
    console.warn("featured lookup failed", e);
    return jsonResponse({ items: [] }, 200, { "cache-control": "public, s-maxage=30" });
  }
}
export function registerAccountRoutes(): void {
  // --- auth ---
  route("GET", "/auth/providers", (_req, env) => handleProviders(env));
  route("GET", "/auth/username-available", (req, env) => handleUsernameAvailable(req, env));
  route("GET", "/auth/github/start", (req, env) => handleOAuthStart(req, env, "github"));
  route("GET", "/auth/github/callback", (req, env) => handleOAuthCallback(req, env, "github"));
  route("GET", "/auth/google/start", (req, env) => handleOAuthStart(req, env, "google"));
  route("GET", "/auth/google/callback", (req, env) => handleOAuthCallback(req, env, "google"));
  route("POST", "/auth/signup", (req, env) => handleSignup(req, env));
  route("POST", "/auth/login", (req, env) => handleLogin(req, env));
  route("POST", "/auth/forgot-password", (req, env) => handleForgotPassword(req, env));
  route("POST", "/auth/reset-password", (req, env) => handleResetPassword(req, env));
  route("POST", "/auth/forgot-username", (req, env) => handleForgotUsername(req, env));
  route("POST", "/auth/change-password", (req, env) => handleChangePassword(req, env));
  route("POST", "/auth/dev", (req, env) => handleDevLogin(req, env));
  route("POST", "/auth/logout", (req, env) => handleLogout(req, env));
  route("GET", "/me", (req, env) => handleMe(req, env));
  route("PATCH", "/me", (req, env) => handleUpdateMe(req, env));
  route("GET", "/me/designs", (req, env) => handleMyDesigns(req, env));

  // --- billing ---
  route("POST", "/billing/checkout", (req, env) => handleCheckout(req, env));
  route("POST", "/billing/portal", (req, env) => handlePortal(req, env));
  route("POST", "/billing/cancel", (req, env) => handleCancelSubscription(req, env));
  route("POST", "/billing/resume", (req, env) => handleResumeSubscription(req, env));
  route("POST", "/webhooks/lemonsqueezy", (req, env) => handleLemonWebhook(req, env));

  // --- cloud library ---
  route("GET", "/library", (req, env) => handleListLibrary(req, env));
  route("POST", "/library", (req, env) => handleCreateLibrary(req, env));
  route("GET", "/library/:id", (req, env, _c, p) => handleGetLibrary(req, env, p.id!));
  route("PUT", "/library/:id", (req, env, _c, p) => handleUpdateLibrary(req, env, p.id!));
  route("DELETE", "/library/:id", (req, env, _c, p) => handleDeleteLibrary(req, env, p.id!));
  route("POST", "/library/:id/link", (req, env, _c, p) => handleSetLink(req, env, p.id!));
  route("GET", "/library/:id/versions", (req, env, _c, p) => handleListVersions(req, env, p.id!));
  route("POST", "/library/:id/restore", (req, env, _c, p) => handleRestoreVersion(req, env, p.id!));
  route("POST", "/library/:id/publish", (req, env, _c, p) => handlePublishFromLibrary(req, env, p.id!));

  // --- teams ---
  route("GET", "/teams", (req, env) => handleListTeams(req, env));
  route("POST", "/teams", (req, env) => handleCreateTeam(req, env));
  route("POST", "/teams/join", (req, env) => handleJoinTeam(req, env));
  route("GET", "/teams/:id", (req, env, _c, p) => handleGetTeam(req, env, p.id!));
  route("DELETE", "/teams/:id", (req, env, _c, p) => handleDeleteTeam(req, env, p.id!));
  route("POST", "/teams/:id/invite", (req, env, _c, p) => handleRotateInvite(req, env, p.id!));
  route("DELETE", "/teams/:id/members/:uid", (req, env, _c, p) =>
    handleRemoveMember(req, env, p.id!, p.uid!),
  );

  // --- community extras ---
  route("POST", "/designs/:id/feature", (req, env, _c, p) => handleSetFeatured(req, env, p.id!));
  route("GET", "/users/:username", async (req, env, _c, p) => {
    const rl = await checkRateLimit(env, "detail", getClientIp(req) ?? "anon");
    if (rl) return rl;
    return handlePublicProfile(env, p.username!);
  });

  // --- permanent-link updater target (polled by installed scripts) ---
  for (const ext of ["sh", "ps1"] as const) {
    route("GET", `/u/:id.${ext}`, async (req, env, _c, p) => {
      const rl = await checkRateLimit(env, "installer", getClientIp(req) ?? "anon");
      if (rl) return rl;
      return handleCloudScript(req, env, { id: p.id!, ext });
    });
  }

  route("GET", "/community/featured", (req, env) => handleFeatured(req, env));
}
