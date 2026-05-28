/**
 * Worker handler integration tests.
 *
 * We use stubbed-env tests (in-memory D1 + Turnstile fetch mock) rather than
 * `unstable_dev`. The latter would require provisioning a local D1 database
 * with the migration already applied — solvable, but heavier than this slice
 * needs to verify route wiring + handler behaviour. The DB stubbing pattern
 * mirrors S3's `installer.test.ts`.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import type { Design } from "@statusline/shared/types";
import worker, { type Env } from "../src/index";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function minimalDesign(): Design {
  return {
    version: 1,
    name: "Test Design",
    elements: [
      {
        id: "e1",
        type: "static",
        text: "hello",
        style: { fg: { kind: "ansi16", index: 2 } },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// In-memory D1 stub
// ---------------------------------------------------------------------------
// Supports the exact SQL fragments the worker's data layer issues.
// Anything else throws so a regression doesn't silently pass.

interface FakeDesignRow {
  id: string;
  json: string;
  slug: string;
  name: string;
  author_name: string;
  description: string;
  forked_from: string | null;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
}

interface FakeInstallRecord {
  id: string;
  json: string;
  created_at: number;
}

interface FakeDb {
  designs: FakeDesignRow[];
  install_records: FakeInstallRecord[];
  view_rollup_state: { last_rollup_at: number };
}

function makeDb(): FakeDb {
  return {
    designs: [],
    install_records: [],
    view_rollup_state: { last_rollup_at: 0 },
  };
}

function makeD1(db: FakeDb): D1Database {
  function prepare(sql: string) {
    const norm = sql.replace(/\s+/g, " ").trim();
    let boundArgs: unknown[] = [];

    const stmt = {
      bind(...args: unknown[]) {
        boundArgs = args;
        return stmt;
      },
      async first<T = unknown>(): Promise<T | null> {
        // SELECT … FROM designs WHERE slug = ?
        if (/^SELECT .* FROM designs WHERE slug = \?$/.test(norm)) {
          const slug = boundArgs[0] as string;
          const row = db.designs.find((r) => r.slug === slug);
          return (row as unknown as T) ?? null;
        }
        // SELECT json FROM designs WHERE id = ?
        if (norm === "SELECT json FROM designs WHERE id = ?") {
          const id = boundArgs[0] as string;
          const row = db.designs.find((r) => r.id === id);
          return row ? ({ json: row.json } as unknown as T) : null;
        }
        // SELECT json FROM install_records WHERE id = ?
        if (norm === "SELECT json FROM install_records WHERE id = ?") {
          const id = boundArgs[0] as string;
          const row = db.install_records.find((r) => r.id === id);
          return row ? ({ json: row.json } as unknown as T) : null;
        }
        // SELECT last_rollup_at FROM view_rollup_state WHERE id = 1
        if (
          norm ===
          "SELECT last_rollup_at FROM view_rollup_state WHERE id = 1"
        ) {
          return {
            last_rollup_at: db.view_rollup_state.last_rollup_at,
          } as unknown as T;
        }
        throw new Error("unexpected first() SQL: " + norm);
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        // listCommunity issues four variants of SELECT FROM designs.
        // We don't replicate sort semantics precisely — tests only need the
        // empty-result case and a small ordered list — so use a simple sort
        // and return everything (the LIMIT param is the last bind).
        if (/^SELECT .* FROM designs(\s|$)/.test(norm)) {
          let rows = [...db.designs];
          if (/ORDER BY forks DESC, views DESC, id ASC/.test(norm)) {
            rows.sort(
              (a, b) =>
                b.forks - a.forks ||
                b.views - a.views ||
                a.id.localeCompare(b.id),
            );
          } else {
            // recent
            rows.sort(
              (a, b) =>
                b.published_at - a.published_at || a.id.localeCompare(b.id),
            );
          }
          const limit = boundArgs[boundArgs.length - 1] as number;
          return { results: rows.slice(0, limit) as unknown as T[] };
        }
        throw new Error("unexpected all() SQL: " + norm);
      },
      async run(): Promise<D1Response> {
        // INSERT INTO designs …
        if (/^INSERT INTO designs/.test(norm)) {
          const [
            id,
            json,
            slug,
            name,
            author_name,
            description,
            forked_from,
            published_at,
          ] = boundArgs as [
            string,
            string,
            string,
            string,
            string,
            string,
            string | null,
            number,
          ];
          if (db.designs.some((r) => r.id === id || r.slug === slug)) {
            throw new Error("UNIQUE constraint failed");
          }
          db.designs.push({
            id,
            json,
            slug,
            name,
            author_name,
            description,
            forked_from,
            published_at,
            views: 0,
            forks: 0,
            installs: 0,
          });
          return {
            success: true,
            meta: { changes: 1 } as D1Meta,
          } as unknown as D1Response;
        }
        // INSERT INTO install_records …
        if (/^INSERT INTO install_records/.test(norm)) {
          const [id, json, created_at] = boundArgs as [string, string, number];
          db.install_records.push({ id, json, created_at });
          return {
            success: true,
            meta: { changes: 1 } as D1Meta,
          } as unknown as D1Response;
        }
        // UPDATE designs SET forks = forks + 1 WHERE slug = ?
        if (norm === "UPDATE designs SET forks = forks + 1 WHERE slug = ?") {
          const slug = boundArgs[0] as string;
          const row = db.designs.find((r) => r.slug === slug);
          if (!row) {
            return {
              success: true,
              meta: { changes: 0 } as D1Meta,
            } as unknown as D1Response;
          }
          row.forks += 1;
          return {
            success: true,
            meta: { changes: 1 } as D1Meta,
          } as unknown as D1Response;
        }
        // UPDATE designs SET installs = installs + 1 WHERE id = ?
        if (norm === "UPDATE designs SET installs = installs + 1 WHERE id = ?") {
          const id = boundArgs[0] as string;
          const row = db.designs.find((r) => r.id === id);
          if (!row) {
            return {
              success: true,
              meta: { changes: 0 } as D1Meta,
            } as unknown as D1Response;
          }
          row.installs += 1;
          return {
            success: true,
            meta: { changes: 1 } as D1Meta,
          } as unknown as D1Response;
        }
        // UPDATE designs SET views = views + ? WHERE slug = ?
        if (norm === "UPDATE designs SET views = views + ? WHERE slug = ?") {
          const [delta, slug] = boundArgs as [number, string];
          const row = db.designs.find((r) => r.slug === slug);
          if (!row) {
            return {
              success: true,
              meta: { changes: 0 } as D1Meta,
            } as unknown as D1Response;
          }
          row.views += delta;
          return {
            success: true,
            meta: { changes: 1 } as D1Meta,
          } as unknown as D1Response;
        }
        // UPDATE view_rollup_state SET last_rollup_at = ? WHERE id = 1
        if (
          norm ===
          "UPDATE view_rollup_state SET last_rollup_at = ? WHERE id = 1"
        ) {
          db.view_rollup_state.last_rollup_at = boundArgs[0] as number;
          return {
            success: true,
            meta: { changes: 1 } as D1Meta,
          } as unknown as D1Response;
        }
        // DELETE FROM install_records WHERE created_at < ?
        if (norm === "DELETE FROM install_records WHERE created_at < ?") {
          const threshold = boundArgs[0] as number;
          const before = db.install_records.length;
          db.install_records = db.install_records.filter(
            (r) => r.created_at >= threshold,
          );
          const deleted = before - db.install_records.length;
          return {
            success: true,
            meta: { changes: deleted } as D1Meta,
          } as unknown as D1Response;
        }
        throw new Error("unexpected run() SQL: " + norm);
      },
    };
    return stmt;
  }

  return {
    prepare,
    async batch(stmts: Array<{ run(): Promise<D1Response> }>) {
      // Real D1 `batch()` is atomic; the stub executes sequentially. That's
      // enough for our purposes because the stubbed statements never throw
      // independently — atomicity isn't exercised here.
      const results: D1Response[] = [];
      for (const stmt of stmts) {
        results.push(await stmt.run());
      }
      return results;
    },
  } as unknown as D1Database;
}

// ---------------------------------------------------------------------------
// Turnstile fetch mock
// ---------------------------------------------------------------------------
// `verifyTurnstile` hits challenges.cloudflare.com via global fetch. We
// intercept fetch and return success: true so the handler proceeds. Tests
// that want a failed-turnstile path can toggle the flag.

const realFetch = globalThis.fetch;
let turnstileShouldSucceed = true;

interface AeCall {
  url: string;
  body: string;
}
const aeCalls: AeCall[] = [];
let aeResponder: ((sql: string) => Response | Promise<Response>) | null = null;

function installTurnstileMock(): void {
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("challenges.cloudflare.com/turnstile/v0/siteverify")) {
      return new Response(
        JSON.stringify({ success: turnstileShouldSucceed }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/analytics_engine/sql")) {
      const body = typeof init?.body === "string" ? init.body : "";
      aeCalls.push({ url, body });
      if (aeResponder) return aeResponder(body);
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
}

beforeAll(() => {
  installTurnstileMock();
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

// ---------------------------------------------------------------------------
// Env factory
// ---------------------------------------------------------------------------

function makeEnv(db: FakeDb): Env {
  return {
    DB: makeD1(db),
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    ALLOWED_ORIGINS: "http://localhost:3000",
  };
}

function makeCtx(): ExecutionContext & { _waited: Promise<unknown>[] } {
  const waited: Promise<unknown>[] = [];
  return {
    waitUntil(p: Promise<unknown>) {
      waited.push(p);
    },
    passThroughOnException() {},
    _waited: waited,
  } as unknown as ExecutionContext & { _waited: Promise<unknown>[] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("worker fetch dispatch", () => {
  let db: FakeDb;
  let env: Env;

  beforeEach(() => {
    db = makeDb();
    env = makeEnv(db);
    turnstileShouldSucceed = true;
  });

  test("GET /community returns empty list on fresh DB", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/community"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: unknown[]; nextCursor: unknown };
    expect(json.items).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });

  test("unknown route returns 404", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/nope"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  test("OPTIONS request returns the CORS preflight response", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/community", {
        method: "OPTIONS",
        headers: { origin: "https://statusline.sh" },
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://statusline.sh",
    );
  });

  test("POST /designs without turnstile token returns 400", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          design: minimalDesign(),
          name: "x",
          author_name: "y",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("turnstile_token");
  });

  test("POST /designs publishes and is fetchable by slug", async () => {
    const publishRes = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "My Statusline",
          author_name: "Author",
          description: "a short description",
        }),
      }),
      env,
      makeCtx(),
    );
    expect(publishRes.status).toBe(200);
    const pub = (await publishRes.json()) as { id: string; slug: string };
    expect(typeof pub.id).toBe("string");
    expect(typeof pub.slug).toBe("string");
    expect(pub.slug.startsWith("my-statusline-")).toBe(true);

    const detailRes = await worker.fetch(
      new Request(`https://worker.example.com/community/${pub.slug}`),
      env,
      makeCtx(),
    );
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as { name: string; slug: string };
    expect(detail.name).toBe("My Statusline");
    expect(detail.slug).toBe(pub.slug);
  });

  test("POST /designs rejects invalid design with 422", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: { version: 999, elements: "not an array" },
          name: "x",
          author_name: "y",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid design");
  });

  test("POST /designs rejects banned word in name with 422", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "fuck this",
          author_name: "y",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error.startsWith("name:")).toBe(true);
  });

  test("POST /designs with failed turnstile returns 401", async () => {
    turnstileShouldSucceed = false;
    const res = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "ok",
          author_name: "ok",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  test("GET /community/:slug 404s for unknown slug", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/community/missing-slug"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  test("POST /community/:slug/fork bumps forks", async () => {
    // First publish so the slug exists.
    const publishRes = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "Forkable",
          author_name: "Author",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    const { slug } = (await publishRes.json()) as { slug: string };

    const forkRes = await worker.fetch(
      new Request(`https://worker.example.com/community/${slug}/fork`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstile_token: "tok" }),
      }),
      env,
      makeCtx(),
    );
    expect(forkRes.status).toBe(200);
    const body = (await forkRes.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(db.designs[0]!.forks).toBe(1);
  });

  test("POST /community/:slug/fork 404s for unknown slug", async () => {
    const res = await worker.fetch(
      new Request(`https://worker.example.com/community/missing/fork`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstile_token: "tok" }),
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  test("POST /install records an anonymous install and returns 201", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
        }),
      }),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(typeof body.id).toBe("string");
    expect(db.install_records.length).toBe(1);
  });

  test("GET /community accepts invalid cursor with 400", async () => {
    const res = await worker.fetch(
      new Request(
        "https://worker.example.com/community?cursor=!!!not-base64!!!",
      ),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(400);
  });

  test("GET /community sets s-maxage cache-control", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/community"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
  });

  test("GET /i/:id.sh serves the installer script for a known design", async () => {
    // Publish first so /i/:id.sh has a row to render from.
    const publishRes = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "Installable",
          author_name: "Author",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    const { id } = (await publishRes.json()) as { id: string };

    const res = await worker.fetch(
      new Request(`https://worker.example.com/i/${id}.sh`),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("STATUSLINE_EOF");
  });

  test("GET /i/:id.sh increments the design's install counter", async () => {
    const publishRes = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "Counted",
          author_name: "Author",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    const { id } = (await publishRes.json()) as { id: string };
    expect(db.designs[0]!.installs).toBe(0);

    const ctx1 = makeCtx();
    await worker.fetch(
      new Request(`https://worker.example.com/i/${id}.sh`),
      env,
      ctx1,
    );
    await Promise.all(ctx1._waited);

    const ctx2 = makeCtx();
    await worker.fetch(
      new Request(`https://worker.example.com/i/${id}.ps1`),
      env,
      ctx2,
    );
    await Promise.all(ctx2._waited);

    expect(db.designs[0]!.installs).toBe(2);
  });

  test("GET /i/:id.sh?preview=1 does not increment installs", async () => {
    const publishRes = await worker.fetch(
      new Request("https://worker.example.com/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnstile_token: "tok",
          design: minimalDesign(),
          name: "Inspectable",
          author_name: "Author",
          description: "",
        }),
      }),
      env,
      makeCtx(),
    );
    const { id } = (await publishRes.json()) as { id: string };

    const ctx = makeCtx();
    await worker.fetch(
      new Request(`https://worker.example.com/i/${id}.sh?preview=1`),
      env,
      ctx,
    );
    await Promise.all(ctx._waited);

    expect(db.designs[0]!.installs).toBe(0);
    expect(ctx._waited.length).toBe(0);
  });

  test("scheduled() reaps stale install_records", async () => {
    // Insert one fresh and one stale install_record.
    const now = Date.now();
    db.install_records.push(
      { id: "fresh", json: "{}", created_at: now },
      { id: "stale", json: "{}", created_at: now - 30 * 24 * 60 * 60 * 1000 },
    );
    await worker.scheduled(
      { scheduledTime: now, cron: "0 4 * * *" } as ScheduledEvent,
      env,
      makeCtx(),
    );
    expect(db.install_records.map((r) => r.id)).toEqual(["fresh"]);
  });
});

// ---------------------------------------------------------------------------
// SSR community detail handler
// ---------------------------------------------------------------------------
//
// Vercel rewrites `/community/:slug` → `https://api.statusline.sh/ssr/community/:slug`,
// so the Worker must return a hydration-ready HTML document with rich
// per-design metadata. These tests pin the contract: status code, content
// type, presence of design data + structured data, and cache headers.

describe("GET /ssr/community/:slug", () => {
  let db: FakeDb;
  let env: Env;

  beforeEach(() => {
    db = makeDb();
    env = makeEnv(db);
  });

  function seed(): {
    slug: string;
    name: string;
    author: string;
    description: string;
    id: string;
  } {
    const id = "ssr1234567";
    const slug = "lovely-statusline-ssr1";
    const name = "Lovely Statusline";
    const author = "Ada Lovelace";
    const description = "A cozy minimalist statusline with git status.";
    db.designs.push({
      id,
      json: JSON.stringify(minimalDesign()),
      slug,
      name,
      author_name: author,
      description,
      forked_from: null,
      published_at: Date.parse("2026-04-12T08:30:00.000Z"),
      views: 0,
      forks: 0,
      installs: 0,
    });
    return { slug, name, author, description, id };
  }

  test("returns 200 + text/html for a known slug", async () => {
    const { slug } = seed();
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
  });

  test("returns 404 for an unknown slug", async () => {
    const res = await worker.fetch(
      new Request("https://worker.example.com/ssr/community/missing-slug"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  test("HTML contains design name, author, description, install command", async () => {
    const { slug, name, author, description, id } = seed();
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    const html = await res.text();
    expect(html).toContain(`<h1 class="ssr-title">${name}</h1>`);
    expect(html).toContain(author);
    expect(html).toContain(description);
    expect(html).toContain(
      `curl -fsSL https://statusline-community.zoniixyt.workers.dev/i/${id}.sh | bash`,
    );
    expect(html).toContain(`/i/${id}.ps1`);
    expect(html).toContain(`<div id="root">`);
  });

  test("HTML contains OG metadata + canonical link", async () => {
    const { slug, name } = seed();
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    const html = await res.text();
    expect(html).toContain(
      `<link rel="canonical" href="https://statusline.sh/community/${slug}" />`,
    );
    expect(html).toContain(
      `<meta property="og:url" content="https://statusline.sh/community/${slug}" />`,
    );
    expect(html).toContain(
      `<meta property="og:image" content="https://statusline-community.zoniixyt.workers.dev/og/community/${slug}.svg" />`,
    );
    expect(html).toContain(`<meta name="twitter:card" content="summary_large_image" />`);
    expect(html).toContain(name);
  });

  test("HTML embeds SoftwareApplication + CreativeWork + BreadcrumbList JSON-LD", async () => {
    const { slug, name, author } = seed();
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    const html = await res.text();
    // Pull every JSON-LD payload out of the HTML and parse it.
    const scripts = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]!.replace(/\\u003c/g, "<")));
    const ogImage = `https://statusline-community.zoniixyt.workers.dev/og/community/${slug}.svg`;
    const canonical = `https://statusline.sh/community/${slug}`;
    const software = scripts.find(
      (s) => (s as { "@type": string })["@type"] === "SoftwareApplication",
    ) as Record<string, unknown> | undefined;
    const creativeWork = scripts.find(
      (s) => (s as { "@type": string })["@type"] === "CreativeWork",
    ) as Record<string, unknown> | undefined;
    const breadcrumbs = scripts.find(
      (s) => (s as { "@type": string })["@type"] === "BreadcrumbList",
    ) as { itemListElement: Array<{ name: string; item: string }> } | undefined;
    expect(software).toBeDefined();
    expect(software!["name"]).toBe(name);
    expect(software!["applicationCategory"]).toBe("DeveloperApplication");
    expect(software!["image"]).toBe(ogImage);
    expect(software!["url"]).toBe(canonical);
    expect(software!["datePublished"]).toBe("2026-04-12T08:30:00.000Z");
    expect((software!["author"] as { name: string }).name).toBe(author);
    // CreativeWork describes the same artefact with image + publish date.
    expect(creativeWork).toBeDefined();
    expect(creativeWork!["name"]).toBe(name);
    expect(creativeWork!["url"]).toBe(canonical);
    expect(creativeWork!["image"]).toBe(ogImage);
    expect(creativeWork!["datePublished"]).toBe("2026-04-12T08:30:00.000Z");
    expect((creativeWork!["author"] as { name: string }).name).toBe(author);
    expect(breadcrumbs).toBeDefined();
    expect(breadcrumbs!.itemListElement.map((i) => i.name)).toEqual([
      "Home",
      "Community",
      name,
    ]);
    expect(breadcrumbs!.itemListElement[2]!.item).toBe(canonical);
  });

  test("HTML links to sibling designs + back to /community and /builder", async () => {
    const { slug } = seed();
    // Add two more designs to act as crawlable siblings.
    db.designs.push({
      id: "sibling0001",
      json: JSON.stringify(minimalDesign()),
      slug: "snazzy-bar-sib1",
      name: "Snazzy Bar",
      author_name: "Grace Hopper",
      description: "",
      forked_from: null,
      published_at: Date.parse("2026-04-13T08:30:00.000Z"),
      views: 0,
      forks: 0,
      installs: 0,
    });
    db.designs.push({
      id: "sibling0002",
      json: JSON.stringify(minimalDesign()),
      slug: "tidy-line-sib2",
      name: "Tidy Line",
      author_name: "Alan Turing",
      description: "",
      forked_from: null,
      published_at: Date.parse("2026-04-14T08:30:00.000Z"),
      views: 0,
      forks: 0,
      installs: 0,
    });
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    const html = await res.text();
    // Related sibling links (real anchors, absolute canonical URLs).
    expect(html).toContain(
      `<a href="https://statusline.sh/community/snazzy-bar-sib1">Snazzy Bar`,
    );
    expect(html).toContain(
      `<a href="https://statusline.sh/community/tidy-line-sib2">Tidy Line`,
    );
    expect(html).toContain("Related statuslines");
    // Must NOT link to itself in the related block.
    expect(html).not.toContain(
      `<a href="https://statusline.sh/community/${slug}">`,
    );
    // Back-links.
    expect(html).toContain(`<a href="/community">Browse community</a>`);
    expect(html).toContain(`<a href="/builder">Open builder</a>`);
  });

  test("related block is omitted when no siblings exist", async () => {
    const { slug } = seed();
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    const html = await res.text();
    // Only design present → no related block, but back-links remain.
    expect(html).not.toContain("Related statuslines");
    expect(html).toContain(`<a href="/community">Browse community</a>`);
    expect(html).toContain(`<a href="/builder">Open builder</a>`);
  });

  test("sets stale-while-revalidate cache header", async () => {
    const { slug } = seed();
    const res = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    const cache = res.headers.get("cache-control") ?? "";
    expect(cache).toContain("s-maxage=300");
    expect(cache).toContain("stale-while-revalidate=3600");
  });

  test("does not break the JSON detail endpoint", async () => {
    // Regression guard — both /community/:slug and /ssr/community/:slug must
    // resolve independently (the SPA still uses the JSON endpoint for
    // client-side fetches).
    const { slug } = seed();
    const jsonRes = await worker.fetch(
      new Request(`https://worker.example.com/community/${slug}`),
      env,
      makeCtx(),
    );
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const ssrRes = await worker.fetch(
      new Request(`https://worker.example.com/ssr/community/${slug}`),
      env,
      makeCtx(),
    );
    expect(ssrRes.status).toBe(200);
    expect(ssrRes.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
  });
});

describe("Analytics Engine view write", () => {
  test("calls VIEWS.writeDataPoint when binding present", async () => {
    const db = makeDb();
    db.designs.push({
      id: "abc1234567",
      json: JSON.stringify(minimalDesign()),
      slug: "viewable-abcd",
      name: "Viewable",
      author_name: "Author",
      description: "",
      forked_from: null,
      published_at: Date.now(),
      views: 0,
      forks: 0,
      installs: 0,
    });

    const writes: unknown[] = [];
    const env: Env = {
      ...makeEnv(db),
      VIEWS: {
        writeDataPoint(event) {
          writes.push(event);
        },
      },
    };

    const res = await worker.fetch(
      new Request("https://worker.example.com/community/viewable-abcd"),
      env,
      makeCtx(),
    );
    expect(res.status).toBe(200);
    expect(writes.length).toBe(1);
    expect((writes[0] as { blobs: string[] }).blobs).toEqual([
      "viewable-abcd",
    ]);
  });
});

describe("Hourly view rollup cron", () => {
  let db: FakeDb;

  beforeEach(() => {
    db = makeDb();
    aeCalls.length = 0;
    aeResponder = null;
  });

  function seedDesign(slug: string, views = 0): void {
    db.designs.push({
      id: `id-${slug}`,
      json: JSON.stringify(minimalDesign()),
      slug,
      name: "x",
      author_name: "y",
      description: "",
      forked_from: null,
      published_at: Date.now(),
      views,
      forks: 0,
      installs: 0,
    });
  }

  test("applies AE counts to designs.views and advances cursor", async () => {
    seedDesign("alpha-aaaa", 3);
    seedDesign("beta-bbbb", 0);

    aeResponder = () =>
      new Response(
        JSON.stringify({
          data: [
            { slug: "alpha-aaaa", count: 7 },
            { slug: "beta-bbbb", count: 12 },
            { slug: "ghost-cccc", count: 99 }, // slug not in designs — silently dropped
          ],
        }),
        { status: 200 },
      );

    const env: Env = {
      ...makeEnv(db),
      CF_ACCOUNT_ID: "acct123",
      CF_ANALYTICS_TOKEN: "tok-xyz",
    };

    const before = Date.now();
    await worker.scheduled(
      { scheduledTime: before, cron: "0 * * * *" } as ScheduledEvent,
      env,
      makeCtx(),
    );

    expect(aeCalls.length).toBe(1);
    expect(aeCalls[0]!.url).toContain("/accounts/acct123/analytics_engine/sql");
    expect(aeCalls[0]!.body).toContain("FROM statusline_views");
    expect(aeCalls[0]!.body).toContain("SUM(_sample_interval)");

    const alpha = db.designs.find((d) => d.slug === "alpha-aaaa")!;
    const beta = db.designs.find((d) => d.slug === "beta-bbbb")!;
    expect(alpha.views).toBe(3 + 7);
    expect(beta.views).toBe(12);
    // Cursor lands at now - INGESTION_BUFFER_MS (5 min). We only assert
    // monotonic advance — the exact value is timing-dependent.
    expect(db.view_rollup_state.last_rollup_at).toBeGreaterThan(0);
    expect(db.view_rollup_state.last_rollup_at).toBeLessThanOrEqual(Date.now());
  });

  test("no AE credentials → silent no-op, no fetch, cursor unchanged", async () => {
    seedDesign("alpha-aaaa", 5);
    const env = makeEnv(db); // no CF_ACCOUNT_ID / CF_ANALYTICS_TOKEN

    await worker.scheduled(
      { scheduledTime: Date.now(), cron: "0 * * * *" } as ScheduledEvent,
      env,
      makeCtx(),
    );

    expect(aeCalls.length).toBe(0);
    expect(db.designs[0]!.views).toBe(5);
    expect(db.view_rollup_state.last_rollup_at).toBe(0);
  });

  test("empty AE response still advances the cursor", async () => {
    seedDesign("alpha-aaaa", 4);
    aeResponder = () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 });

    const env: Env = {
      ...makeEnv(db),
      CF_ACCOUNT_ID: "acct123",
      CF_ANALYTICS_TOKEN: "tok-xyz",
    };

    await worker.scheduled(
      { scheduledTime: Date.now(), cron: "0 * * * *" } as ScheduledEvent,
      env,
      makeCtx(),
    );

    expect(db.designs[0]!.views).toBe(4);
    expect(db.view_rollup_state.last_rollup_at).toBeGreaterThan(0);
  });

  test("daily cron still runs the install_records reaper, not the rollup", async () => {
    db.install_records.push({
      id: "stale",
      json: "{}",
      created_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
    });
    const env: Env = {
      ...makeEnv(db),
      CF_ACCOUNT_ID: "acct123",
      CF_ANALYTICS_TOKEN: "tok-xyz",
    };

    await worker.scheduled(
      { scheduledTime: Date.now(), cron: "0 4 * * *" } as ScheduledEvent,
      env,
      makeCtx(),
    );

    expect(aeCalls.length).toBe(0);
    expect(db.install_records.length).toBe(0);
    expect(db.view_rollup_state.last_rollup_at).toBe(0);
  });
});
