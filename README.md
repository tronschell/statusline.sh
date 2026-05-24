<div align="center">

# statusline.sh

**A visual builder for [Claude Code](https://docs.claude.com/en/docs/claude-code) statuslines.**
Design the bar at the bottom of your terminal in the browser, then paste one command to install it.

[Quickstart](#quickstart) · [Features](#features) · [Architecture](#architecture) · [API](#api) · [Contributing](#contributing)

![Bun](https://img.shields.io/badge/runtime-Bun-black?style=flat-square)
![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

</div>

---

## Why

Claude Code lets you customise the status line at the bottom of the CLI by pointing it at any executable that reads a JSON payload on stdin and emits styled text to stdout. Writing that script by hand means hand-rolling ANSI escape codes and JSON parsing in `bash` or `PowerShell`.

`statusline.sh` removes that friction end-to-end:

1. **Design** visually — drag elements onto a canvas, style them, see a live preview.
2. **Save & share** — get a one-liner install command (or export the design as JSON).
3. **Install** — paste the command. Your existing `settings.json` is preserved and backed up.
4. **Browse** — publish to the community gallery, fork what others built.

---

## Features

| | |
|---|---|
| **Visual design** | Drag-and-drop canvas. Elements: model name, working directory, git branch, context %, progress bars, segment-split paths, glyphs, rotators, separators, static text. |
| **Full styling** | 16 / 256 / RGB foreground & background colours. Bold, italic, dim, underline. Per-element prefix, suffix, and conditional visibility. |
| **Live preview** | Pure-JS ANSI interpreter renders the statusline in a faux-terminal chrome as you edit. Hot-swappable mock stdin payloads. |
| **Cross-platform install** | One IR compiles to `bash` (macOS / Linux) and `PowerShell` (Windows). Both backends produce byte-identical output. |
| **Safe installer** | Structural JSON merge into `~/.claude/settings.json` — never string replacement. Timestamped backups. Opt-in self-heal via `claude -p` if all parsers fail. |
| **Community gallery** | Publish a design with name, author, description. Browse Recent / Popular. Fork to your own builder in one click. |
| **Offline-friendly** | Export and import designs as JSON. Everything works from `localStorage` until you choose to save. |

---

## Quickstart

The app is split across two deploy targets: a static React SPA (hosted on Vercel) and a Cloudflare Worker backed by D1 (handles `/api` and `/i/:id` routes). For local development both processes run side-by-side.

```bash
bun install

# Terminal 1 — Worker on http://localhost:8787 (D1 via miniflare)
bun --cwd worker dev

# Terminal 2 — SPA build (rebuild on demand)
bun run build    # → ./dist  (serve with any static file server)

bun test                              # root suite
bun --cwd worker test                 # worker suite
```

> **TODO (dev SPA):** the legacy `bun dev` HMR server was bound to the now-deleted Bun backend. Until a static dev server is wired up, run `bun run build` and serve `./dist` with any static file host (e.g. `bunx serve ./dist`). Hot-module reload is currently unavailable for the SPA.

The SPA reads `NEXT_PUBLIC_WORKER_URL` (build-time) to know where to send API calls and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the publish flow. For local dev, set both via a `.env` (e.g. `NEXT_PUBLIC_WORKER_URL=http://localhost:8787`).

> **Requirements:** [Bun](https://bun.sh) ≥ 1.1 (frontend bundler + test runner) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Worker dev + deploy). No Node, npm, or Vite.

### Deploying the Worker

One-time setup:

```bash
cd worker
wrangler login
wrangler d1 create statusline-community            # copy database_id into wrangler.toml
wrangler secret put TURNSTILE_SECRET_KEY           # publish protection
```

Each deploy:

```bash
cd worker
wrangler d1 migrations apply statusline-community --remote
bun run seed > /tmp/seed.sql                       # generates INSERT SQL for starter designs
wrangler d1 execute statusline-community --remote --file=/tmp/seed.sql
wrangler deploy
```

### Deploying the SPA (Vercel)

Set the following env vars in the Vercel project, then `bun run build` produces `./dist` which Vercel serves:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_WORKER_URL` | Origin of the deployed Worker, e.g. `https://statusline-api.example.workers.dev` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public site key for the Cloudflare Turnstile widget shown in the publish dialog |

Both values are inlined into the JS bundle at build time.

---

## Architecture

### Three routes

| Route | Purpose |
|---|---|
| `/` | Landing page with a live-animating hero statusline and curated template gallery |
| `/builder` | Drag-and-drop editor (palette · canvas · inspector · live preview · install drawer) |
| `/builder?template=:id` · `?fork=:id` | Builder pre-loaded from a template or community design |
| `/community` | Bento-grid gallery sorted by Recent or Popular |
| `/community/:slug` | Single-design view with install command and Fork CTA |

### One IR, three backends

The compiler is the spine of the project. `packages/shared/src/compiler/ir.ts` lowers a `Design` to a `RenderOp[]`. Three consumers then produce **byte-equivalent output** (after stripping ANSI) for the same input:

```
            ┌─→  compiler/bash.ts          → bash script   (jq → python3 → python fallback)
Design ──→ IR ─┼─→  compiler/powershell.ts   → PowerShell    (ConvertFrom-Json, Console.Out.Write)
            └─→  compiler/interpret.ts    → ANSI string   (browser preview / hero / static cards)
```

Parity is enforced in `test/compiler.test.ts`, which spawns the compiled bash with mock JSON on stdin and diffs against the JS interpreter.

### Installer flow

`GET /i/:id.sh` and `GET /i/:id.ps1` return self-contained installer scripts that:

1. Embed the compiled statusline via a **quoted heredoc** (bash `<<'STATUSLINE_EOF'`) or **single-quoted here-string** (PowerShell `@' ... '@`) — no shell expansion, so paths round-trip safely.
2. Write to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline.sh` (or `.ps1`) with the executable bit set.
3. Back up the existing `settings.json` to `settings.json.bak.<unix-ms>`.
4. Perform a **structured JSON merge** that preserves every other top-level key (`model`, `permissions`, `mcpServers`, …). Bash uses `jq → python3 → python`. PowerShell uses `ConvertFrom-Json -Depth 50` / `ConvertTo-Json -Depth 50` (UTF-8 no BOM).
5. If — and only if — all merge backends fail **and** `STATUSLINE_SELFHEAL=1` is set **and** `claude` is on `PATH`, the installer offers to shell out to `claude -p` with a truncated snippet for repair. Self-heal stays opt-in.

End-to-end coverage lives in `test/e2e.test.ts`: it runs the real installer against a temp directory with a pre-populated `settings.json` and asserts that other keys survive, the `.bak` is created, and the installed script produces the expected styled output.

### State

- **`designStore`** (Zustand + persist) — `design`, `selectedId`, capped 50-deep `past` / `future` history. All mutations route through a `withHistory` helper that `structuredClone`s the prior state. Storage key: `statusline-design-v1`.
- **`uiStore`** — panel collapse, OS override, mock preset, self-heal toggle. Local only, never synced.
- **`useShareState`** — sessionStorage-backed `{designId, slug}` so refreshes don't lose the "Saved as &lt;id&gt;" indicator.

### Database

Community designs live in Cloudflare D1 (a SQLite-compatible serverless DB), accessed exclusively from the Worker. Schema (see `worker/migrations/`):

```sql
designs(
  id           TEXT PRIMARY KEY,         -- nanoid(10), URL-safe
  json         TEXT NOT NULL,            -- serialised Design
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  views        INTEGER DEFAULT 0,
  is_public    INTEGER DEFAULT 0,
  slug         TEXT UNIQUE,              -- nullable until published
  author_name  TEXT,
  description  TEXT,
  forks        INTEGER DEFAULT 0,
  forked_from  TEXT REFERENCES designs(id),
  published_at INTEGER
)
```

Two compound indices back the cursor-paginated community listing:
`(is_public, published_at DESC)` for Recent · `(is_public, forks DESC, views DESC)` for Popular. Cursors are opaque base64url JSON. Drafts are not persisted server-side — they live in `localStorage` via Zustand until the user explicitly publishes.

### Project layout

```
packages/shared/src/        Types, schema, ANSI helpers, templates, mock stdin
                            + compiler/{ir,bash,powershell,interpret}.ts (shared between SPA + Worker)

src/                        Frontend SPA (deployed to Vercel)
  index.html, frontend.tsx, App.tsx, index.css
  shared/animatedMocks.ts   Browser-only animation helpers
  frontend/
    router.tsx              Hand-rolled router (no react-router)
    store/                  designStore (Zustand) + uiStore
    hooks/                  useDnd, useUndoRedo, useOsDetect, useAnimatedMock, useShareState
    components/
      Layout/   Landing/   Builder/   Palette/   Canvas/
      Inspector/   Preview/   Install/   Community/   Modal/   ContextMenu/

worker/                     Cloudflare Worker (deployed via Wrangler)
  src/
    index.ts                Worker entrypoint
    router.ts               Hand-rolled router
    designs.ts              D1-backed CRUD + publish/fork
    cors.ts, ratelimit.ts,
    turnstile.ts, sanitize.ts
    handlers/installer.ts   /i/:id.{sh,ps1}
    install/{bashTemplate,psTemplate}.ts
  migrations/               D1 SQL migrations
  scripts/seed.ts           Emits INSERT SQL for starter community designs
  test/                     unstable_dev integration tests (87 cases)

test/                       Root suite — shared, compiler, store, templates, builder-seed, e2e
```

---

## API

```
POST   /api/designs                                  body: Design  → { id }
GET    /api/designs/:id                              → { design, …metadata }   (bumps views)
PUT    /api/designs/:id                              body: Design  → { ok: true }

GET    /api/community?sort=recent|popular&limit=24&cursor=…   → { items, nextCursor }
GET    /api/community/:slug                          → full design + metadata
POST   /api/designs/:id/publish                      body: { author_name, description, name } → { ok, slug }
POST   /api/designs/:id/unpublish                    → { ok: true }
POST   /api/designs/:id/fork                         → { id }   (increments source.forks)

GET    /api/templates                                → TemplateMeta[]

GET    /i/:id.sh                                     → text/x-shellscript   (bash installer)
GET    /i/:id.ps1                                    → text/plain           (PowerShell installer)
```

---

## Testing

```bash
bun test                              # root suite (frontend + shared + e2e)
bun --cwd worker test                 # Worker suite (D1 + API + installer)
bun test test/compiler.test.ts        # IR + 3 backends, including live bash exec
bun test -t "preserves settings.json" # single test by name pattern
```

| Suite | What it covers |
|---|---|
| `shared.test.ts` | Types, schema validator, ANSI parser |
| `compiler.test.ts` | IR lowering, three-backend parity, live bash execution |
| `store.test.ts` | Zustand store, history, uiStore |
| `templates.test.ts` | All curated templates compile + tween helpers |
| `builder-seed.test.ts` | `?template=` / `?fork=` URL parsing |
| `e2e.test.ts` | Design → Worker API → installer → on-disk verification |
| `worker/test/*` | API routes, community lifecycle, CORS, Turnstile, rate-limit, installer |

---

## Tech stack

**SPA:** Bun 1.1+ (bundler, test runner) · React 19 · Tailwind CSS v4 · Zustand · dnd-kit · Phosphor Icons — deployed to Vercel as a static bundle.
**Backend:** Cloudflare Workers · D1 (SQLite) · Turnstile (publish protection) · Analytics Engine — deployed via Wrangler.
**Shared:** `packages/shared` workspace publishes the design schema, compiler IR + three backends, ANSI helpers, mock stdin, and brand art to both targets.
**No:** Node, npm, Vite, react-router, Express, Zod — by design.

---

## Contributing

Adding a new element type touches **seven** places. Miss one and the live preview will silently diverge from the installed script:

1. `packages/shared/src/types.ts` — add to the `Element` discriminated union
2. `packages/shared/src/schema.ts` — runtime validation
3. `packages/shared/src/compiler/ir.ts` — `elementToOps` switch case
4. `packages/shared/src/compiler/{bash,powershell,interpret}.ts` — handle any new `RenderOp` kinds
5. `src/frontend/store/designStore.ts` — `addElement` default factory
6. `src/frontend/components/Palette/` + `Inspector/fields/<Type>Fields.tsx` — palette entry and editor
7. `test/compiler.test.ts` — parity coverage

See [`CLAUDE.md`](./CLAUDE.md) for architectural invariants (compiler parity, installer safety rules, state management contracts).

---

## License

[MIT](./LICENSE) © Tron Schell
