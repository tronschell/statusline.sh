# statusline.sh

Visual builder for Claude Code statuslines.

[statusline.sh](https://statusline.sh) is a free, open-source web app for designing the Claude Code statusline — the customizable status bar at the bottom of the Claude Code terminal interface. Drag elements onto a canvas, style them, preview live, then paste a single command to install on macOS, Linux, or Windows.

- Try it: [https://statusline.sh](https://statusline.sh)
- Guide: [How to make a Claude Code statusline](https://statusline.sh/how-to-make-a-claude-code-statusline)
- Community gallery: [https://statusline.sh/community](https://statusline.sh/community)

## What is this?

Claude Code lets you point its status line at any executable that reads a JSON payload on stdin and writes styled text to stdout. Writing that script by hand means hand-rolling ANSI escape codes and JSON parsing in `bash` or `PowerShell`, then editing `~/.claude/settings.json` without clobbering everything else in it.

statusline.sh removes that friction. Design a Claude Code statusline visually in the browser, save it, and copy one install command. Your existing `settings.json` is structurally merged (never string-replaced) and backed up with a timestamp before any change. The status bar you see in the live preview is byte-identical (after stripping ANSI) to what gets installed on disk.

If you have never customized the Claude Code status line before, the [walkthrough on statusline.sh](https://statusline.sh/how-to-make-a-claude-code-statusline) covers the JSON payload Claude Code sends, the ANSI styling primitives, and what the editor compiles to.

## Features

- Drag-and-drop canvas with 19 element types: model name, working directory (basename / full / tilde), git branch and dirty status, lines added/removed, context percentage, 5h and 7d rate-limit percentages and progress bars, cost, session duration, generic progress bars, segment-split paths, glyphs, rotators, separators, conditional visibility, and static text.
- Full ANSI styling: 16 / 256 / RGB foreground and background colors, bold, italic, dim, underline. Per-element prefix, suffix, max length, and `showWhen` predicates (`exists`, `gt`, `lt`, `eq`).
- Live in-browser preview rendered by a pure-JS ANSI interpreter in a faux-terminal chrome. Hot-swappable mock stdin payloads for testing edge cases.
- Cross-platform install: one intermediate representation compiles to both `bash` (macOS / Linux) and `PowerShell` (Windows) with byte-equivalent output.
- Safe installer: structured JSON merge into `~/.claude/settings.json` (`jq` → `python3` → `python` for bash; `ConvertFrom-Json` for PowerShell), timestamped `.bak.<unix-s>` backups, optional opt-in self-heal via `claude -p` if every parser fails.
- Community gallery with Recent and Popular sorts (cursor-paginated), one-click Fork, install counts, profanity filter, and Turnstile protection.
- Crawlable: `robots.txt`, `sitemap.xml` covering every published design, and deterministic OG share images at `/og/community/:slug.svg`.
- Offline-friendly: export and import designs as JSON. Drafts live in `localStorage` until you explicitly publish.

## Try it

- Builder: [https://statusline.sh](https://statusline.sh)
- Guide: [https://statusline.sh/how-to-make-a-claude-code-statusline](https://statusline.sh/how-to-make-a-claude-code-statusline)
- Community: [https://statusline.sh/community](https://statusline.sh/community)

No account required. Designs save to your browser's `localStorage` until you choose to publish them to the community gallery.

## How it works

The project ships two deploy targets:

- **SPA** (React 19 + Tailwind v4, bundled with Bun) — hosted on Vercel as a static bundle.
- **Cloudflare Worker** + **D1** — handles community publish/list/fork, the `/install` anonymous one-shot endpoint, installer rendering at `/i/:id.{sh,ps1}`, `robots.txt`, `sitemap.xml`, and OG SVGs.

The compiler is the spine of the project. `packages/shared/src/compiler/ir.ts` lowers a `Design` into a typed `RenderOp[]`. Three backends consume that IR and must produce byte-equivalent output (after stripping ANSI) for the same input:

- `compiler/bash.ts` — emits a bash script that uses `jq` with a `python3` / `python` fallback for JSON field reads.
- `compiler/powershell.ts` — emits PowerShell that parses with `ConvertFrom-Json` and writes via `[Console]::Out.Write` to bypass PowerShell's color mangling.
- `compiler/interpret.ts` — interprets the IR directly in JavaScript for the browser preview, landing-page hero animation, and community gallery cards.

Parity is enforced in `test/compiler.test.ts`, which spawns the compiled bash with mock JSON on stdin and diffs against the JS interpreter. Adding a new `RenderOp` variant means updating all three backends in the same change, or the live preview will silently diverge from the installed script.

Community designs live in Cloudflare D1 (SQLite-compatible), accessed only from the Worker. Two tables: `designs` (with compound indexes on `(published_at DESC, id ASC)` and `(forks DESC, views DESC, id ASC)` for cursor pagination) and `install_records` (a 7-day staging area for anonymous installs, reaped by a daily cron). The SPA never touches D1 directly — it reaches the Worker cross-origin via CORS and Turnstile-protected POSTs.

For a deeper tour of the architecture invariants — compiler parity, installer safety rules, state-management contracts, and the D1 access pattern — see [`CLAUDE.md`](./CLAUDE.md).

## Development

Requires [Bun](https://bun.sh) >= 1.1 (frontend bundler, dev server, test runner) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Worker dev and deploy). No Node, no npm, no Vite.

```bash
bun install

# Local dev — two processes
bun dev                            # Bun SPA dev server on http://localhost:3001
bun --cwd worker dev               # Worker + D1 (wrangler --local) on http://localhost:8787

# Production build
bun run build                      # one-shot SPA build → ./dist (served by Vercel)

# Tests
bun test                           # root suite (frontend + shared + e2e)
bun --cwd worker test              # Worker suite
bun test test/compiler.test.ts     # single file
bun test -t "preserves settings.json"   # single test by name pattern
```

The SPA reads `NEXT_PUBLIC_WORKER_URL` (build-time constant inlined into the bundle via `build.ts`). On localhost it falls back to `http://localhost:8787`; in production it falls back to `https://api.statusline.sh`. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` configures the publish, fork, and anonymous-install flows; if unset, Cloudflare's always-pass dev key is used, so a fresh clone Just Works.

For Worker deploys, set `TURNSTILE_SECRET_KEY` via `wrangler secret put` and apply D1 migrations with `wrangler d1 migrations apply statusline-community --remote` before `wrangler deploy`.

## Contributing and community

PRs welcome. Before opening one, run `bun test && bun --cwd worker test` and make sure both suites pass.

Adding a new element type touches seven places (types, schema, IR, three compiler backends, store factory, palette + inspector, parity test). The complete checklist is in [`CLAUDE.md`](./CLAUDE.md) under "Adding a new element type" — follow it exactly or the live preview will diverge from the installed script.

If you would rather share a design than write code, publish one to the community gallery at [https://statusline.sh/community](https://statusline.sh/community) — every published Claude Code statusline is forkable, gets a permanent slug, and shows up in the sitemap.

## License

[MIT](./LICENSE) (c) Tron Schell
