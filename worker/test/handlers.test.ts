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
}

function makeDb(): FakeDb {
  return { designs: [], install_records: [] };
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
    async batch() {
      throw new Error("batch not implemented in test stub");
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
