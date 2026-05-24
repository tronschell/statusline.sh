# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **Bun** for the frontend bundler + test runner and **Wrangler** for the Cloudflare Worker. Do not introduce Node, npm, or Vite.

```bash
bun install

# Local dev — two processes:
bun --cwd worker dev               # Worker + D1 (miniflare) on http://localhost:8787
bun run build                      # one-shot SPA build → ./dist (serve via any static host)

# Tests
bun test                           # root suite (frontend + shared + e2e)
bun --cwd worker test              # Worker suite
bun test test/compiler.test.ts     # single file
bun test -t "preserves settings.json" # single test by name pattern
```

The SPA reads `NEXT_PUBLIC_WORKER_URL` (build-time constant inlined into the bundle) to find the Worker. There is no longer a Bun-hosted API — the previous `bun dev` HMR server was removed in the D1 migration. The Vercel deployment serves `./dist`; the Worker handles all `/api` and `/i/:id` routes cross-origin via CORS + Turnstile.

## Architecture invariants

### One IR, three backends — keep them in lockstep

`packages/shared/src/compiler/ir.ts` lowers a `Design` to a `RenderOp[]`. Three consumers must produce byte-equivalent output (after stripping ANSI) for the same fixture:

- `packages/shared/src/compiler/bash.ts` → bash script (jq → python3 → python fallback for JSON)
- `packages/shared/src/compiler/powershell.ts` → PowerShell (`ConvertFrom-Json -Depth 50`, writes via `[Console]::Out.Write` to bypass PS color mangling)
- `packages/shared/src/compiler/interpret.ts` → ANSI string in pure JS (browser preview, hero animation, static cards)

`test/compiler.test.ts` enforces parity by spawning the compiled bash with mock JSON on stdin and diffing against the interpreter. **Any new `RenderOp` variant must be added to all three backends and the parity test in the same change.**

### Adding a new element type

The discriminated union and its lowering touch seven places. Miss one and the preview will silently diverge from the installed script:

1. `packages/shared/src/types.ts` — add to the `Element` union
2. `packages/shared/src/schema.ts` — runtime validation (hand-rolled, no Zod)
3. `packages/shared/src/compiler/ir.ts` — `elementToOps` switch case
4. `packages/shared/src/compiler/{bash,powershell,interpret}.ts` — handle any new `RenderOp` kinds
5. `src/frontend/store/designStore.ts` — `addElement` default factory
6. `src/frontend/components/Palette/` + `Inspector/fields/<Type>Fields.tsx`
7. `test/compiler.test.ts` — parity coverage

### Installer safety rules

`worker/src/install/{bashTemplate,psTemplate}.ts` wrap the compiled statusline into a self-contained installer served at `/i/:id.{sh,ps1}` by the Worker. Two non-negotiable invariants:

- **Embed the compiled script via a quoted heredoc** (`<<'STATUSLINE_EOF'`) for bash, or a **single-quoted here-string** (`@' ... '@`) for PowerShell. No shell expansion of user content — paths and special chars must round-trip byte-for-byte.
- **Merge `settings.json` structurally, never via string replacement.** Every other top-level key (`model`, `permissions`, `mcpServers`, ...) must survive. A timestamped `.bak.<unix-ms>` is written before the merge. The e2e test in `test/e2e.test.ts` enforces both behaviours end-to-end (runs the real installer against a temp dir).

`STATUSLINE_SELFHEAL=1` opt-in: only if jq/python3/python all fail AND `claude` is on PATH, the installer shells out to `claude -p` with a truncated settings snippet. Stays opt-in — never enable by default.

### State + persistence

- `designStore` (Zustand + persist, key `statusline-design-v1`): all mutations go through `withHistory`, which `structuredClone`s the prior design onto `past` (capped at 50). Do not mutate `design` outside of these actions or undo/redo will desync.
- `uiStore`: panel collapse, OS override, mock preset, self-heal toggle — **never persisted server-side**.
- `useShareState` (sessionStorage): `{designId, slug}` so refreshes keep the "Saved as <id>" indicator.

### Database

Community designs live in **Cloudflare D1** (SQLite-compatible), accessed only from the Worker at `worker/src/designs.ts`. Local Worker tests use the `unstable_dev` miniflare runtime, which provisions an isolated D1 instance per run (no `setDbPathForTests` analogue needed — the binding comes from `wrangler.toml`). Drafts persist client-side via Zustand; nothing in the SPA touches D1 directly. Cursor pagination on `/api/community` uses opaque base64url-encoded JSON cursors; two compound indices back the Recent vs Popular sorts (see README for the exact column order).

### Routing

Frontend uses a **hand-rolled router** (`frontend/router.tsx`, no react-router). Worker uses a hand-rolled router at `worker/src/router.ts` that matches paths and dispatches to handlers — no Hono, no itty-router, no middleware framework. The Worker is the only backend; the SPA reaches it cross-origin via `NEXT_PUBLIC_WORKER_URL` (CORS allowlist + Turnstile-protected publish endpoint).

### Design system

Dark-mode minimalist, derived from the `minimalist-ui` skill. No emojis in UI chrome (the user's *output* statusline may contain emojis via the `glyph` element type). No gradients except a single fixed radial ambient on the landing hero at <0.05 opacity. Phosphor Bold icons only. 1px borders, `rounded-[10px]` cards. Tokens live in `src/index.css`.

## Path aliases

`@/*` → `src/*` (see `tsconfig.json`). Strict mode is on with `noUncheckedIndexedAccess` — array/Record indexing returns `T | undefined`, narrow before use.
