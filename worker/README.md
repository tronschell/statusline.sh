# statusline-community-worker

The Cloudflare Worker that owns the community gallery: publish, browse, fork,
and short-lived anonymous installs. It is the only thing that talks to the D1
database — the SPA on Vercel makes cross-origin `fetch` calls here, and D1 is
never publicly reachable.

## Local dev

Run the Worker against a local SQLite-emulated D1:

```sh
bun --cwd worker dev
```

The Worker listens on `http://localhost:8787`. That starts `wrangler dev
--local` against miniflare-managed SQLite, so no Cloudflare account is needed.

### Turnstile dev keys (Cloudflare-published)

These keys ALWAYS pass (never serve a real challenge). For local-only use.

- Site key (always passes): `1x00000000000000000000AA`
- Secret (always passes): `1x0000000000000000000000000000000AA`

The site key is already set as the default in `wrangler.toml`. Put the secret
in `worker/.dev.vars` (gitignored):

```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

For production, the maintainer runs `wrangler secret put TURNSTILE_SECRET_KEY`
with a real secret.

## Seeding

Generate seed SQL from the bundled templates:

```sh
bun --cwd worker run seed > /tmp/seed.sql
```

Apply to local D1:

```sh
bun --cwd worker exec wrangler d1 execute statusline-community --local --file=/tmp/seed.sql
```

Apply to production (maintainer only):

```sh
bun --cwd worker exec wrangler d1 execute statusline-community --remote --file=/tmp/seed.sql
```

The seed uses `INSERT OR IGNORE`, so re-running it is safe — it won't duplicate
rows or overwrite existing data.

### Seeding only specific templates

When adding new templates to a DB that already has the originals, pass
`--only=<ids>` to skip the existing rows:

```sh
bun worker/scripts/seed.ts --only=vital-signs,two-line-cockpit,mode-switcher,neon-pulse,ocean-wave > /tmp/new.sql
bun --cwd worker exec wrangler d1 execute statusline-community --remote --file=/tmp/new.sql
```

Invoke the script directly — `bun run seed -- --only=…` doesn't forward
flags, but `bun worker/scripts/seed.ts --only=…` does. Template ids match
`TEMPLATES[*].id` in `packages/shared/src/templates.ts`. Unknown ids cause
the script to exit non-zero before producing any output.

## Accounts & Pro

Optional sign-in, a private library, permanent auto-updating install links,
team statuslines, featured slots and a verified badge (Pro, $5/month via
Lemon Squeezy). Everything is additive: with none of the secrets below set the
new endpoints answer 503 and the anonymous product behaves exactly as before.
Code: `src/{auth,oauth,password,billing,library,teams,owners,email}.ts`, routed
from `src/accountRoutes.ts`; schema in `migrations/0004_accounts.sql`.

### Rollout order

1. `wrangler d1 migrations apply <db> --remote` — **before** deploying the
   Worker. The migration only adds tables/columns.
2. Set secrets (`wrangler secret put <NAME>`), see below.
3. Deploy the Worker, then the SPA with `NEXT_PUBLIC_ACCOUNTS=1` (the account
   UI stays hidden without it).

### Secrets and vars

| Name | What |
| --- | --- |
| `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID` | checkout + customer portal + cancel/resume |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | HMAC secret for `POST /webhooks/lemonsqueezy` |
| `GITHUB_CLIENT_ID` / `_SECRET` | GitHub sign-in; callback `https://<worker>/auth/github/callback` |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google sign-in; redirect URI `https://<worker>/auth/google/callback` |
| `RESEND_API_KEY`, `EMAIL_FROM` | password-reset and forgot-username emails (verified sender) |
| `SITE_URL` (var) | SPA origin for checkout/reset links (default `https://statusline.sh`) |

In Lemon Squeezy, point the webhook at `https://<worker>/webhooks/lemonsqueezy`
and subscribe to the `subscription_*` events. Pro is granted only by that signed
webhook, never by the checkout redirect.

### Local dev

Add to `worker/.dev.vars` (gitignored): `DEV_AUTH=1` enables `POST /auth/dev
{username, pro}` (also requires a localhost request host) and makes
`/auth/forgot-password` echo `dev_token`. `LEMONSQUEEZY_API_BASE` can point at a
stub server. Simulate a payment by POSTing a subscription payload signed with
`LEMONSQUEEZY_WEBHOOK_SECRET` (HMAC-SHA256 hex in `x-signature`).
