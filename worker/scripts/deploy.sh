#!/usr/bin/env bash
# Worker deploy walkthrough — run from repo root.
#
# Steps that need maintainer input are interactive; this script is a guided
# wrapper, not a fire-and-forget. Re-run any step independently if needed.

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf "\n\033[1;36m==>\033[0m %s\n" "$*"; }
ask() { printf "\033[1;33m??\033[0m %s [press enter to continue, Ctrl-C to abort]\n" "$*"; read -r _; }

step "1. Login to Cloudflare"
ask "About to open a browser for 'wrangler login'."
bunx wrangler login

step "2. Create the D1 database"
ask "Running 'wrangler d1 create statusline-community'. Copy the database_id from the output."
bunx wrangler d1 create statusline-community || echo "(database may already exist — that's fine)"
ask "Paste the database_id into wrangler.toml under [[d1_databases]] now, then press enter."

step "3. Register a Turnstile site"
echo "  Go to https://dash.cloudflare.com/?to=/:account/turnstile → 'Add site'"
echo "  Widget mode: Managed. Domain: your production Vercel hostname + localhost."
echo "  Copy the SITE KEY and SECRET KEY."
ask "Got both keys? Press enter."

step "4. Store the Turnstile secret as a Worker secret"
ask "About to run 'wrangler secret put TURNSTILE_SECRET_KEY'. Paste the SECRET when prompted."
bunx wrangler secret put TURNSTILE_SECRET_KEY

step "5. Update the public Turnstile site key in wrangler.toml"
echo "  Edit worker/wrangler.toml → [vars] → TURNSTILE_SITE_KEY = \"<your site key>\""
echo "  Also update ALLOWED_ORIGINS if your production hostname differs from statusline.sh."
ask "Done editing wrangler.toml? Press enter."

step "6. Apply migrations to remote D1"
bunx wrangler d1 migrations apply statusline-community --remote

step "7. Seed starter templates"
bun run scripts/seed.ts > /tmp/seed.sql
bunx wrangler d1 execute statusline-community --remote --file=/tmp/seed.sql

step "8. Deploy the worker"
bunx wrangler deploy

step "9. Capture the deployed Worker URL"
echo "  The Worker URL from step 8 looks like: https://statusline-community.<account>.workers.dev"
echo "  Set this in Vercel as NEXT_PUBLIC_WORKER_URL (and NEXT_PUBLIC_TURNSTILE_SITE_KEY)."
echo
echo "  From the repo root:"
echo "    vercel env add NEXT_PUBLIC_WORKER_URL production"
echo "    vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production"
echo
echo "  Then redeploy the SPA: 'git push' (auto-deploy) or 'vercel deploy --prod'."

step "Done."
