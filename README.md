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

```bash
bun install
bun dev          # http://localhost:3001
bun run seed     # seed the community gallery with a few starter designs
bun test         # full suite (~1.7s)
```

Production build:

```bash
bun run build    # → ./dist
bun start        # serves ./dist + API on $PORT (default 3000)
```

> **Requirements:** [Bun](https://bun.sh) ≥ 1.1. No Node, npm, or Vite — Bun is the runtime, bundler, and test runner.

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

The compiler is the spine of the project. `src/compiler/ir.ts` lowers a `Design` to a `RenderOp[]`. Three consumers then produce **byte-equivalent output** (after stripping ANSI) for the same input:

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

`bun:sqlite` singleton at `./data/statusline.db`:

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
`(is_public, published_at DESC)` for Recent · `(is_public, forks DESC, views DESC)` for Popular. Cursors are opaque base64url JSON.

### Project layout

```
src/
  index.ts                 Bun HTTP server — mounts API routes + serves the SPA
  index.html, frontend.tsx, App.tsx, index.css

  shared/                  Types, schema, ANSI helpers, templates, mock stdin
  compiler/                ir.ts + bash / powershell / interpret backends
  server/                  db, designs (CRUD + publish/fork), routes, install templates
  frontend/
    router.tsx             Hand-rolled router (no react-router)
    store/                 designStore (Zustand) + uiStore
    hooks/                 useDnd, useUndoRedo, useOsDetect, useAnimatedMock, useShareState
    components/
      Layout/   Landing/   Builder/   Palette/   Canvas/
      Inspector/   Preview/   Install/   Community/   Modal/
test/                      8 suites — shared, compiler, store, server, templates, builder-seed, e2e
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
bun test                              # full suite, ~1.7s
bun test test/compiler.test.ts        # IR + 3 backends, including live bash exec
bun test -t "preserves settings.json" # single test by name pattern
```

| Suite | What it covers |
|---|---|
| `shared.test.ts` | Types, schema validator, ANSI parser |
| `compiler.test.ts` | IR lowering, three-backend parity, live bash execution |
| `store.test.ts` | Zustand store, history, uiStore |
| `templates.test.ts` | All curated templates compile + tween helpers |
| `server.test.ts` | API routes + community lifecycle |
| `builder-seed.test.ts` | `?template=` / `?fork=` URL parsing |
| `e2e.test.ts` | Design → API → installer → on-disk verification |

---

## Tech stack

**Runtime:** Bun 1.1+ (server, bundler, test runner, native `sqlite`)
**UI:** React 19 · Tailwind CSS v4 · Zustand · dnd-kit · Phosphor Icons
**No:** Node, npm, Vite, react-router, Express, Zod — by design.

---

## Contributing

Adding a new element type touches **seven** places. Miss one and the live preview will silently diverge from the installed script:

1. `src/shared/types.ts` — add to the `Element` discriminated union
2. `src/shared/schema.ts` — runtime validation
3. `src/compiler/ir.ts` — `elementToOps` switch case
4. `src/compiler/{bash,powershell,interpret}.ts` — handle any new `RenderOp` kinds
5. `src/frontend/store/designStore.ts` — `addElement` default factory
6. `src/frontend/components/Palette/` + `Inspector/fields/<Type>Fields.tsx` — palette entry and editor
7. `test/compiler.test.ts` — parity coverage

See [`CLAUDE.md`](./CLAUDE.md) for architectural invariants (compiler parity, installer safety rules, state management contracts).

---

## License

[MIT](./LICENSE) © Tron Schell
