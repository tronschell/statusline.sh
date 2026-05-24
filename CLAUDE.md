# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **Bun** as runtime, bundler, and test runner. Do not introduce Node, npm, or Vite.

```bash
bun install
bun dev                            # http://localhost:3001 (note: NOT 3000; PORT is set in package.json)
bun run seed                       # populate ./data/statusline.db with starter community designs
bun run build                      # → ./dist (see build.ts; uses bun-plugin-tailwind)
bun start                          # serves ./dist + API on $PORT (default 3000) in production mode

bun test                           # full suite
bun test test/compiler.test.ts     # single file
bun test -t "preserves settings.json" # single test by name pattern
```

The dev server uses `--hot` for HMR. `src/index.ts` mounts API routes via Bun's native `serve({ routes })` and serves the SPA from `src/index.html`.

## Architecture invariants

### One IR, three backends — keep them in lockstep

`src/compiler/ir.ts` lowers a `Design` to a `RenderOp[]`. Three consumers must produce byte-equivalent output (after stripping ANSI) for the same fixture:

- `compiler/bash.ts` → bash script (jq → python3 → python fallback for JSON)
- `compiler/powershell.ts` → PowerShell (`ConvertFrom-Json -Depth 50`, writes via `[Console]::Out.Write` to bypass PS color mangling)
- `compiler/interpret.ts` → ANSI string in pure JS (browser preview, hero animation, static cards)

`test/compiler.test.ts` enforces parity by spawning the compiled bash with mock JSON on stdin and diffing against the interpreter. **Any new `RenderOp` variant must be added to all three backends and the parity test in the same change.**

### Adding a new element type

The discriminated union and its lowering touch seven places. Miss one and the preview will silently diverge from the installed script:

1. `src/shared/types.ts` — add to the `Element` union
2. `src/shared/schema.ts` — runtime validation (hand-rolled, no Zod)
3. `src/compiler/ir.ts` — `elementToOps` switch case
4. `src/compiler/{bash,powershell,interpret}.ts` — handle any new `RenderOp` kinds
5. `src/frontend/store/designStore.ts` — `addElement` default factory
6. `src/frontend/components/Palette/` + `Inspector/fields/<Type>Fields.tsx`
7. `test/compiler.test.ts` — parity coverage

### Installer safety rules

`server/install/{bashTemplate,psTemplate}.ts` wrap the compiled statusline into a self-contained installer served at `/i/:id.{sh,ps1}`. Two non-negotiable invariants:

- **Embed the compiled script via a quoted heredoc** (`<<'STATUSLINE_EOF'`) for bash, or a **single-quoted here-string** (`@' ... '@`) for PowerShell. No shell expansion of user content — paths and special chars must round-trip byte-for-byte.
- **Merge `settings.json` structurally, never via string replacement.** Every other top-level key (`model`, `permissions`, `mcpServers`, ...) must survive. A timestamped `.bak.<unix-ms>` is written before the merge. The e2e test in `test/e2e.test.ts` enforces both behaviours end-to-end (runs the real installer against a temp dir).

`STATUSLINE_SELFHEAL=1` opt-in: only if jq/python3/python all fail AND `claude` is on PATH, the installer shells out to `claude -p` with a truncated settings snippet. Stays opt-in — never enable by default.

### State + persistence

- `designStore` (Zustand + persist, key `statusline-design-v1`): all mutations go through `withHistory`, which `structuredClone`s the prior design onto `past` (capped at 50). Do not mutate `design` outside of these actions or undo/redo will desync.
- `uiStore`: panel collapse, OS override, mock preset, self-heal toggle — **never persisted server-side**.
- `useShareState` (sessionStorage): `{designId, slug}` so refreshes keep the "Saved as <id>" indicator.

### Database

`bun:sqlite` singleton at `./data/statusline.db`. `server/db.ts` accepts an override path used by tests to swap in `:memory:` databases — call the override before any other `server/*` import in test setup. Cursor pagination on `/api/community` uses opaque base64url-encoded JSON cursors; two compound indices back the Recent vs Popular sorts (see README for the exact column order).

### Routing

Frontend uses a **hand-rolled router** (`frontend/router.tsx`, no react-router). Backend uses Bun's native `serve({ routes })` with typed `BunRequest<"/path/:param">` params — see `server/routes.ts`. There is no Express, no middleware framework.

### Design system

Dark-mode minimalist, derived from the `minimalist-ui` skill. No emojis in UI chrome (the user's *output* statusline may contain emojis via the `glyph` element type). No gradients except a single fixed radial ambient on the landing hero at <0.05 opacity. Phosphor Bold icons only. 1px borders, `rounded-[10px]` cards. Tokens live in `src/index.css`.

## Path aliases

`@/*` → `src/*` (see `tsconfig.json`). Strict mode is on with `noUncheckedIndexedAccess` — array/Record indexing returns `T | undefined`, narrow before use.
