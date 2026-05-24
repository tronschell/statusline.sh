# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **Bun** for the frontend bundler + test runner and **Wrangler** for the Cloudflare Worker. Do not introduce Node, npm, or Vite.

```bash
bun install

# Local dev — two processes:
bun dev                            # Bun SPA dev server (src/dev.ts) on :3001
bun --cwd worker dev               # Worker + D1 (wrangler --local) on :8787
bun run build                      # one-shot SPA build → ./dist (served by Vercel)

# Tests
bun test                           # root suite (frontend + shared + e2e)
bun --cwd worker test              # Worker suite
bun test test/compiler.test.ts     # single file
bun test -t "preserves settings.json" # single test by name pattern
```

The SPA reads `NEXT_PUBLIC_WORKER_URL` (build-time constant inlined into the bundle via `build.ts`'s `define` map; localhost falls back to `http://localhost:8787`, production falls back to `https://api.statusline.sh`). Vercel serves `./dist`; the Worker handles all `/community`, `/designs`, `/install`, `/i/:id.{sh,ps1}`, `/robots.txt`, `/sitemap.xml`, and `/og/community/:slug.svg` routes cross-origin via CORS + Turnstile.

## Architecture invariants

### One IR, three backends — keep them in lockstep

`packages/shared/src/compiler/ir.ts` lowers a `Design` to a `RenderOp[]`. Three consumers must produce byte-equivalent output (after stripping ANSI) for the same fixture:

- `packages/shared/src/compiler/bash.ts` → bash script (jq → python3 → python fallback for JSON field reads)
- `packages/shared/src/compiler/powershell.ts` → PowerShell (uses plain `ConvertFrom-Json`; writes via `[Console]::Out.Write` to bypass PS color mangling)
- `packages/shared/src/compiler/interpret.ts` → ANSI string in pure JS (browser preview, hero animation, static cards)

`test/compiler.test.ts` enforces parity by spawning the compiled bash with mock JSON on stdin and diffing against the interpreter. **Any new `RenderOp` variant must be added to all three backends and the parity test in the same change.** Current ops: `literal`, `field`, `cond`, `progressBar`, `split`, `compute`, `rotator`. Computed expressions (`git_branch`, `git_dirty`, `cost_fmt`, `duration_hms`, `duration_human`) live in each backend's prelude.

### Adding a new element type

The discriminated union and its lowering touch seven places. Miss one and the preview will silently diverge from the installed script:

1. `packages/shared/src/types.ts` — add to the `Element` union
2. `packages/shared/src/schema.ts` — runtime validation + `ELEMENT_TYPES` array (hand-rolled, no Zod)
3. `packages/shared/src/compiler/ir.ts` — `elementToOps` switch case
4. `packages/shared/src/compiler/{bash,powershell,interpret}.ts` — handle any new `RenderOp` kinds
5. `src/frontend/store/designStore.ts` — `defaultsFor` factory in the `addElement` path
6. `src/frontend/components/Palette/ElementPalette.tsx` + `Inspector/fields/<Type>Fields.tsx` (or reuse an existing field component, as the `rateLimit*` elements do with `ContextBar`/`ContextPct` fields)
7. `test/compiler.test.ts` — parity coverage

### Installer safety rules

`worker/src/install/{bashTemplate,psTemplate}.ts` wrap the compiled statusline into a self-contained installer served at `/i/:id.{sh,ps1}` by the Worker. Two non-negotiable invariants:

- **Embed the compiled script via a quoted heredoc** (`<<'STATUSLINE_EOF'`) for bash, or a **single-quoted here-string** (`@' ... '@`) for PowerShell. No shell expansion of user content — paths and special chars must round-trip byte-for-byte. The templates pre-escape collisions (`STATUSLINE_EOF` → `STATUSLINE_EOF_X`, `'@` → `'@_X`) on the way in.
- **Merge `settings.json` structurally, never via string replacement.** Bash tries `jq` then `python3` then `python`; PowerShell uses `ConvertFrom-Json`. Every other top-level key (`model`, `permissions`, `mcpServers`, ...) must survive. A timestamped `.bak.<unix-s>` is written before the merge. `test/e2e.test.ts` enforces both behaviours end-to-end by running the real installer against a temp dir.

`STATUSLINE_SELFHEAL=1` opt-in: only if all JSON backends fail AND `claude` is on PATH, the installer shells out to `claude -p` with a 4 KiB settings snippet. Stays opt-in — never enable by default.

### State + persistence

- `designStore` (Zustand + persist, key `statusline-design-v1`, only `design` is persisted): all mutations go through `withHistory`, which `structuredClone`s the prior design onto `past` (capped at 50). Do not mutate `design` outside of these actions or undo/redo will desync. `updateElement` deliberately drops a stray `type` field in the patch to prevent accidental type rewrites.
- `uiStore` (key `statusline-ui-v1`): panel collapse, OS override, mock preset, mock stdin JSON, self-heal toggle.
- `useShareState` (sessionStorage, keys `statusline-design-id-v1` / `statusline-slug-v1`): `{designId, slug}` so refreshes keep the "Saved as <id>" indicator. Clearing `designId` also clears `slug`.

### Database

Community designs live in **Cloudflare D1** (SQLite-compatible), accessed only from the Worker at `worker/src/designs.ts`. Two tables (`worker/migrations/0001_init.sql`): `designs` (with `idx_designs_recent` on `(published_at DESC, id ASC)` and `idx_designs_popular` on `(forks DESC, views DESC, id ASC)` — these back the cursor pagination) and `install_records` (a 7-day staging area for anonymous installs, reaped by the daily cron in `wrangler.toml`). A SQL `CHECK (length(json) BETWEEN 2 AND 32768)` caps payload size; the Worker also rejects bodies > 64 KiB at the HTTP boundary before parsing JSON.

Worker tests (`worker/test/`) stub D1 in-memory rather than using `unstable_dev` — see `handlers.test.ts`'s rationale. Drafts persist client-side via Zustand; nothing in the SPA touches D1 directly. Cursor pagination on `/community` uses opaque base64url-encoded JSON cursors (`encodeCursor`/`decodeCursor` in `designs.ts`); malformed cursors must 400 before the edge cache lookup.

### Routing

Frontend uses a **hand-rolled router** (`src/frontend/router.tsx`, no react-router) with `<Route path="/...">`, wildcard `*`, and `:param` capture. Worker uses a **hand-rolled router** at `worker/src/router.ts` that escapes regex metacharacters before substituting `:param` (so a literal `.sh` in a route pattern matches the dot) and silently falls through to 404 on malformed percent-encoding rather than 500ing. No Hono, no itty-router, no middleware framework.

The Worker is the only backend; the SPA reaches it cross-origin via `NEXT_PUBLIC_WORKER_URL` (CORS allowlist in `worker/src/cors.ts` + Turnstile-protected publish/fork/install endpoints). Per-endpoint rate limits live on `[[unsafe.bindings]]` ratelimit namespaces in `wrangler.toml`.

### Design system

Dark-mode minimalist, derived from the `minimalist-ui` skill. No emojis in UI chrome (the user's *output* statusline may contain emojis via the `glyph` or `rotator` element types). No gradients except a single fixed radial ambient on the landing hero at <0.05 opacity. Phosphor Bold icons only. 1px borders, `rounded-[10px]` cards. Tokens live in `src/index.css` (`--color-canvas: #0E0E10`, Geist / Geist Mono / Instrument Serif font stack).

## Path aliases

`@/*` → `src/*`, `@statusline/shared` → `packages/shared/src/index.ts` (see `tsconfig.json`). Strict mode is on with `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noImplicitOverride` — array/Record indexing returns `T | undefined`, narrow before use. The root `tsconfig.json` **excludes `worker` and `packages`**; the worker has its own `tsconfig.json` for `@cloudflare/workers-types`.
