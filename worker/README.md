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
