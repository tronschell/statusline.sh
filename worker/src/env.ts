import type { RateLimitEnv } from "./ratelimit";

/**
 * Bindings + secrets used by the account / billing / library modules. Every
 * secret is optional: with none configured the new endpoints answer 503 (or
 * 404 for dev-only ones) and the existing anonymous product is untouched.
 */
export interface AccountEnv extends RateLimitEnv {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  /** Public SPA origin, used for post-checkout redirects. */
  SITE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Resend API key + verified sender ("statusline.sh <no-reply@statusline.sh>"); enables reset/reminder emails. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** "1" enables POST /auth/dev — local development only (also needs a localhost host). */
  DEV_AUTH?: string;
  /** Test billing is enabled only on the explicitly isolated Worker + DB. */
  BILLING_MODE?: "live" | "test";
  BILLING_TEST_DATABASE_ID?: string;
  LEMONSQUEEZY_API_KEY?: string;
  LEMONSQUEEZY_STORE_ID?: string;
  LEMONSQUEEZY_VARIANT_ID?: string;
  LEMONSQUEEZY_WEBHOOK_SECRET?: string;
  /** Override for tests; defaults to https://api.lemonsqueezy.com. */
  LEMONSQUEEZY_API_BASE?: string;
}

/** Plan limits. One place so the UI, API and tests agree. */
export const PLAN = {
  freeLibraryCap: 3,
  proLibraryCap: 200,
  featuredCap: 3,
  versionsKept: 20,
  teamCap: 3,
  teamMemberCap: 25,
  priceUsdPerMonth: 5,
} as const;

export const DEFAULT_SITE_URL = "https://statusline.sh";
