# statusline.sh

A hosted, drag-and-drop builder for [Claude Code](https://docs.claude.com/en/docs/claude-code) statuslines. Design the bar at the bottom of your terminal visually, then paste one command to install it.

Built with **Bun + React 19 + Tailwind CSS v4 + Zustand + dnd-kit + bun:sqlite**.

---

## What it does

Claude Code lets you customize the status line at the bottom of the CLI by pointing it at an executable that reads a JSON payload on stdin and emits styled text to stdout. Writing that script by hand means hand-rolling ANSI escape codes and parsing JSON in bash or PowerShell.

This app removes that friction:

1. **Design**: Drag elements (model name, working directory, git branch, context %, progress bars, segment-split branch names, etc.) onto a canvas. Style each one with foreground/background colors (16/256/RGB), bold/italic/dim/underline, prefix/suffix, conditional visibility. Watch a live preview update in real time inside a faux-terminal chrome.
2. **Save & Share**: One click saves the design server-side and returns a one-liner install command for macOS, Linux, and Windows. The design is also exportable/importable as JSON for offline use.
3. **Install**: Paste the one-liner into your terminal. The installer writes a `statusline.sh` (or `.ps1`) into `~/.claude/`, then merges the `statusLine` block into your `settings.json` non-destructively (every other key is preserved, with a timestamped backup of the previous file).
4. **Community**: Publish your design with a name, author handle, and description. Other users browse the gallery, fork to their own builder, customize, and install.

The hero on the landing page animates a live statusline in real time, cycling through curated templates with tweening mock data (cost ticks up, context bar fills, branch names rotate) — so visitors see exactly what they can build.

---

## Quickstart

```bash
bun install
bun dev          # http://localhost:3000
bun run seed     # populate the community gallery with a few starter designs
bun test         # 120 tests across shared types, compiler, store, server, templates, builder, and end-to-end install
```

Production build:

```bash
bun run build    # outputs to ./dist
bun start        # serves dist + API on port 3000
```

---

## Architecture

### Three surfaces

| Route | Component | Purpose |
|---|---|---|
| `/` | `LandingPage` | Hero animation cycling curated templates, template gallery, "how it works", footer CTA |
| `/builder` | `BuilderRoute` (inside `AppShell`) | Drag-and-drop editor with palette, canvas+preview, inspector, top bar (save/publish/import/export/undo/redo) |
| `/builder?template=:id` | same | Builder pre-loaded from a curated template in `src/shared/templates.ts` |
| `/builder?fork=:id` | same | Builder pre-loaded from a fetched community design |
| `/community` | `CommunityPage` | Bento-grid gallery of public designs; sort by Recent or Popular |
| `/community/:slug` | `CommunityDetailPage` | Single-design view with install command and Fork CTA |

### Layout

```
src/
  index.ts                 # Bun HTTP server — mounts API routes + serves the SPA
  frontend.tsx             # React entry
  App.tsx                  # Router shell
  index.css                # Design tokens + Geist/Instrument Serif imports

  shared/                  # Used by both server and client
    types.ts               # Design, Element discriminated union, AnsiStyle
    schema.ts              # Hand-rolled runtime validator
    ansi.ts                # 256-color palette, SGR helpers, ANSI→HTML parser
    mockStdin.ts           # Canned Claude payload + presets
    templates.ts           # 8 curated starter designs
    animatedMocks.ts       # Pure tween function for the landing hero

  compiler/
    ir.ts                  # Design → RenderOp[] (shared intermediate representation)
    bash.ts                # IR → bash script (macOS/Linux statusline)
    powershell.ts          # IR → PowerShell script (Windows statusline)
    interpret.ts           # IR → ANSI string in pure JS (for browser preview)
    progressBar.ts         # Shared progress-bar math

  server/
    db.ts                  # bun:sqlite singleton with override path for tests
    designs.ts             # CRUD + publish/unpublish/fork + community listing
    routes.ts              # Endpoint handler map mounted by index.ts
    install/
      bashTemplate.ts      # Wraps compiled bash into a self-contained installer
      psTemplate.ts        # Same for PowerShell

  frontend/
    router.tsx             # Tiny hand-rolled router (no deps)
    store/
      designStore.ts       # Zustand: design + selectedId + past/future + persist
      uiStore.ts           # Panel state, OS override, mock preset, self-heal opt-in
    hooks/                 # useDnd, useUndoRedo, useOsDetect, useAnimatedMock, useShareState
    lib/                   # api wrappers, navigate helper, short IDs
    components/
      Layout/              # AppShell, NavBar, TopBar, TerminalFrame
      Landing/             # LandingPage, HeroStatusline, TemplateGallery, TemplateCard
      Builder/             # BuilderPage (seeds from ?template= / ?fork=)
      Palette/             # ElementPalette, PaletteItem (dnd-kit sources)
      Canvas/              # StatuslineCanvas, ElementChip (dnd-kit sortable)
      Inspector/           # InspectorPanel, StyleEditor, ColorPicker + 14 fields/ files
      Preview/             # LivePreview, AnsiToHtml, MockStdinEditor, StaticPreview
      Install/             # InstallDrawer with OS tabs + copy-to-clipboard + self-heal toggle
      Community/           # CommunityPage, CommunityDesignCard, CommunityDetailPage, PublishDialog
      Modal/               # Modal primitive (backdrop, ESC, body-lock)
```

### Compiler

The compiler is a two-stage pipeline with a shared IR (`src/compiler/ir.ts`):

1. `compileToOps(design)` lowers a `Design` to a `RenderOp[]` (literal, field, cond, progressBar, split, compute).
2. Three backends consume the same IR:
   - `compileToBash(design)` → bash script for macOS/Linux. Reads stdin into `$INPUT_JSON`, extracts fields via jq → python3 → python fallback, emits styled output with `printf '\033[...m...\033[0m'`.
   - `compileToPS(design)` → PowerShell. Uses `ConvertFrom-Json -Depth 50` + `[Console]::Out.Write` to avoid PowerShell's color mangling.
   - `renderToAnsi(design, mock)` (interpret.ts) → ANSI string in pure JS. Used by the browser for the live preview, hero animation, and static card previews.

All three backends produce byte-equivalent text (stripped of ANSI) on the same fixture. Verified by `test/compiler.test.ts` which spawns the compiled bash with the mock JSON on stdin and compares to the interpreter's output.

### Installer flow

`GET /i/:id.sh` and `GET /i/:id.ps1` return self-contained installer scripts:

1. The compiled statusline is embedded via a **quoted heredoc** (`<<'STATUSLINE_EOF'`) for bash, or a **single-quoted here-string** (`@' ... '@`) for PowerShell. No expansion happens, so paths and special characters round-trip safely.
2. The installer writes the statusline to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline.sh` (or `.ps1`) and chmods +x.
3. It backs up the user's existing `settings.json` to `settings.json.bak.<timestamp>`.
4. It performs a **structured JSON merge** — never string replacement — that preserves every other top-level key (`model`, `permissions`, `mcpServers`, ...). On bash: jq → python3 → python fallback. On PowerShell: `ConvertFrom-Json -Depth 50` / `ConvertTo-Json -Depth 50`, UTF-8 no BOM.
5. If all merge backends fail and `STATUSLINE_SELFHEAL=1` is set AND `claude` is on PATH, the installer prompts `claude -p "fix my settings.json..."` with a truncated snippet of the current contents. Self-heal is opt-in.

### State management

- **`designStore`** (Zustand + persist middleware) — holds the current `design`, `selectedId`, and `past`/`future` history arrays (capped at 50). All mutating actions wrap with a `withHistory` helper that pushes a `structuredClone` of the prior design onto `past`. `localStorage` key: `statusline-design-v1`.
- **`uiStore`** — panel collapse state, OS override, self-heal opt-in, mock preset, `mockStdinJson` text.
- **`useShareState`** — sessionStorage-backed `{designId, slug}` so refreshes keep the "Saved as <id>" indicator and don't lose the publish URL.

### Database

`bun:sqlite` at `./data/statusline.db`:

```sql
designs(
  id TEXT PRIMARY KEY,          -- nanoid(10), URL-safe
  json TEXT NOT NULL,           -- serialized Design
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  slug TEXT UNIQUE,             -- nullable until published
  author_name TEXT,             -- free text; swap for user_id when auth lands
  description TEXT,
  forks INTEGER DEFAULT 0,
  forked_from TEXT REFERENCES designs(id),
  published_at INTEGER
)
```

Two indices for cursor-paginated community listing: `(is_public, published_at DESC)` for Recent, `(is_public, forks DESC, views DESC)` for Popular. Cursors are opaque base64url JSON.

### Design system

**Dark-mode minimalist** — translated from the `minimalist-ui` skill. Highlights:

- Canvas `#0E0E10`, surfaces `#161618`, borders `rgba(255,255,255,0.06)`
- Body text `#E8E8E6`, muted `#8A8A86`
- Editorial serif (Instrument Serif) for headlines; Geist Sans for body; Geist Mono for the statusline preview
- No emojis in UI chrome (the user's *output* statusline can have them via the `glyph` element type)
- Phosphor Bold icons only
- 1px borders, `rounded-[10px]` cards, generous padding, asymmetric bento grids
- No gradients (except a single fixed radial ambient on the landing hero at <0.05 opacity)
- No heavy shadows

---

## API reference

```
POST   /api/designs                         body: Design                  → { id }
GET    /api/designs/:id                     → { design, ...metadata }     (bumps views)
PUT    /api/designs/:id                     body: Design                  → { ok: true }

GET    /api/community?sort=recent|popular&limit=24&cursor=…  → { items, nextCursor }
GET    /api/community/:slug                 → full design + metadata
POST   /api/designs/:id/publish             body: { author_name, description, name } → { ok, slug }
POST   /api/designs/:id/unpublish           → { ok: true }
POST   /api/designs/:id/fork                → { id }                      (increments source.forks)

GET    /api/templates                       → TemplateMeta[]

GET    /i/:id.sh                            → text/x-shellscript           (bash installer)
GET    /i/:id.ps1                           → text/plain                   (PowerShell installer)
```

---

## Testing

```bash
bun test                          # full suite (120 tests, ~1.7s)
bun test test/shared.test.ts      # types, schema, ANSI parser (31 tests)
bun test test/compiler.test.ts    # IR + 3 backends, including live bash exec (20 tests)
bun test test/store.test.ts       # Zustand store + uiStore (19 tests)
bun test test/templates.test.ts   # all 8 templates compile + tween helpers (25 tests)
bun test test/server.test.ts      # API routes + community lifecycle (14 tests)
bun test test/builder-seed.test.ts # ?template / ?fork URL parsing (9 tests)
bun test test/e2e.test.ts         # end-to-end: design → API → bash installer → on-disk verification (2 tests)
```

The E2E test compiles a fixture design, POSTs it to a real `serve()` instance with in-memory SQLite, fetches the install script, runs it against a temp directory with a pre-populated `settings.json`, and asserts: the statusline file exists with executable bit set, the `settings.json` retains its existing keys, a timestamped `.bak` is created, and the installed statusline produces the expected styled output when re-run with mock stdin.

---

## Contributing

The implementation was planned in `~/.claude/plans/this-is-a-react-wild-dove.md` and split into 14 phased tasks executed in five waves. To add a new element type:

1. Add the variant to the `Element` discriminated union in `src/shared/types.ts`.
2. Add field-level validation to `src/shared/schema.ts`.
3. Add the lowering case to `src/compiler/ir.ts` (`elementToOps` switch).
4. Add or reuse `RenderOp` handlers in `compiler/{bash,powershell,interpret}.ts`.
5. Add a default-creator case to `addElement` in `src/frontend/store/designStore.ts`.
6. Add a palette entry and a `fields/<Type>Fields.tsx` editor.
7. Optionally add it to one of the templates in `src/shared/templates.ts`.
8. Cover with tests in `test/compiler.test.ts`.

The same `RenderOp` flowing through three backends keeps the browser preview, the deployed bash, and the deployed PowerShell in lockstep.

---

## License

MIT.
