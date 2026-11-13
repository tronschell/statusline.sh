/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import type { Design } from "@statusline/shared/types";
import {
  decodeCursor,
  encodeCursor,
  getDesignTotal,
  kebabCase,
  isCommunityIndexable,
  listCommunitySitemapEntries,
  publishDesign,
} from "../src/designs";
import { handleListCommunity, type Env } from "../src/index";
import { makeD1 } from "./helpers/d1";

describe("kebabCase", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(kebabCase("Hello World")).toBe("hello-world");
  });

  test("collapses multiple spaces and underscores", () => {
    expect(kebabCase("foo   bar___baz")).toBe("foo-bar-baz");
  });

  test("strips punctuation but preserves word chars", () => {
    expect(kebabCase("My Cool!! Design??")).toBe("my-cool-design");
  });

  test("trims leading and trailing hyphens", () => {
    expect(kebabCase("---trimmed---")).toBe("trimmed");
  });

  test("collapses consecutive hyphens", () => {
    expect(kebabCase("a--b---c")).toBe("a-b-c");
  });

  test("normalises unicode (NFKD)", () => {
    // é → "e" + combining acute, then [^\w\s-] strips the combining mark
    expect(kebabCase("café")).toBe("cafe");
  });

  test("returns 'design' for empty / pure-symbol input", () => {
    expect(kebabCase("")).toBe("design");
    expect(kebabCase("!!!")).toBe("design");
    expect(kebabCase("   ")).toBe("design");
  });

  test("preserves existing hyphens", () => {
    expect(kebabCase("foo-bar")).toBe("foo-bar");
  });

  test("handles mixed case and digits", () => {
    expect(kebabCase("My Design v2")).toBe("my-design-v2");
  });
});

describe("encodeCursor / decodeCursor round-trip", () => {
  test("round-trips a recent-cursor shape", () => {
    const cur = { pub: 1716583200000, id: "abcd123XYZ" };
    const enc = encodeCursor(cur);
    expect(typeof enc).toBe("string");
    expect(decodeCursor(enc)).toEqual(cur);
  });

  test("round-trips a popular-cursor shape", () => {
    const cur = { forks: 42, views: 1337, id: "zzzzz99999" };
    expect(decodeCursor(encodeCursor(cur))).toEqual(cur);
  });

  test("produces URL-safe output (no +, /, or =)", () => {
    // Try a payload that's known to produce + / = in standard base64.
    const cur = { pub: 999_999_999_999, id: "??>>>>>>>>" };
    const enc = encodeCursor(cur);
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeCursor(enc)).toEqual(cur);
  });

  test("handles unicode strings", () => {
    const cur = { pub: 1, id: "café-✨-design" };
    expect(decodeCursor(encodeCursor(cur))).toEqual(cur);
  });

  test("returns null on malformed input", () => {
    expect(decodeCursor("!!!not-base64!!!")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    // valid base64 but not JSON
    expect(decodeCursor("aGVsbG8")).toBeNull();
  });

  test("handles arrays and nested objects", () => {
    const obj = { a: [1, 2, 3], b: { c: "d", e: null } };
    expect(decodeCursor(encodeCursor(obj))).toEqual(obj);
  });

  test("padding-free output decodes correctly regardless of length mod 4", () => {
    // Cycle through a few lengths so we exercise each `%4` branch in decodeCursor.
    for (const id of ["a", "ab", "abc", "abcd", "abcde"]) {
      const cur = { pub: 1, id };
      const enc = encodeCursor(cur);
      expect(enc.endsWith("=")).toBe(false);
      expect(decodeCursor(enc)).toEqual(cur);
    }
  });
});

describe("listCommunitySitemapEntries", () => {
  test("filters unusable rows using SQLite without excluding legitimate forks", async () => {
    const db = new Database(":memory:");
    try {
      db.exec(await Bun.file(new URL("../migrations/0001_init.sql", import.meta.url)).text());
      db.exec(await Bun.file(new URL("../migrations/0002_installs.sql", import.meta.url)).text());
      const design = {
        version: 1,
        name: "Minimal",
        elements: [{ id: "model", type: "model", style: {} }],
      };
      const insert = db.prepare(
        `INSERT INTO designs (id, json, slug, name, author_name, description, forked_from, published_at)
         VALUES (?, ?, ?, ?, ?, '', ?, ?)`,
      );
      const rows = [
        { id: "original", json: JSON.stringify(design) },
        // Same title and no description or usage do not prove duplication.
        { id: "fork", json: JSON.stringify({ ...design, elements: [
          { id: "branch", type: "gitBranch", style: {}, showWhen: { field: "git.branch", op: "exists" } },
        ] }), forked_from: "original" },
        { id: "legacy", json: JSON.stringify({ ...design, elements: [
          { id: "rate", type: "rateLimit5hPct", style: {} },
        ] }) },
        { id: "empty", json: JSON.stringify({ ...design, elements: [] }) },
        { id: "malformed", json: "{broken" },
        { id: "missing-elements", json: "{}" },
        { id: "null", json: "null" },
        { id: "object-elements", json: JSON.stringify({ ...design, elements: {} }) },
        { id: "blank-name", json: JSON.stringify(design), name: " \t\n" },
        { id: "blank-author", json: JSON.stringify(design), author_name: "\u00a0" },
        { id: "blank-slug", json: JSON.stringify(design), slug: " " },
      ];
      for (const [i, row] of rows.entries()) {
        insert.run(row.id, row.json, row.slug ?? row.id, row.name ?? "Minimal",
          row.author_name ?? "Author", row.forked_from ?? null, 1_700_000_000_000 + i);
      }

      const env = {
        DB: {
          prepare(sql: string) {
            const statement = db.prepare(sql);
            return {
              bind(limit: number) {
                return { async all() { return { results: statement.all(limit) }; } };
              },
            };
          },
        },
      } as unknown as Parameters<typeof listCommunitySitemapEntries>[0];
      const entries = await listCommunitySitemapEntries(env);
      expect(entries.map((row) => row.slug)).toEqual(["legacy", "fork", "original"]);
      expect(entries.every((row) => Object.keys(row).sort().join() === "published_at,slug")).toBe(true);
      expect(db.query("SELECT COUNT(*) AS count FROM designs").get()).toEqual({ count: rows.length });
    } finally {
      db.close();
    }
  });

  test("issues a bounded query (LIMIT) and never returns more than the cap", async () => {
    let capturedSql = "";
    let boundLimit: number | undefined;

    const env = {
      DB: {
        prepare(sql: string) {
          capturedSql = sql.replace(/\s+/g, " ").trim();
          const stmt = {
            bind(...args: unknown[]) {
              boundLimit = args[args.length - 1] as number;
              return stmt;
            },
            async all<T = unknown>(): Promise<{ results: T[] }> {
              // Pretend the table holds more rows than the cap; the DB itself
              // applies LIMIT, so honour the bound value here.
              const limit = boundLimit ?? 0;
              const results = Array.from({ length: limit }, (_v, i) => ({
                slug: `design-${i}`,
                name: "Minimal",
                author_name: "Author",
                element_count: 1,
                published_at: i,
              })) as T[];
              return { results };
            },
          };
          return stmt;
        },
      },
    } as unknown as Parameters<typeof listCommunitySitemapEntries>[0];

    const entries = await listCommunitySitemapEntries(env);

    // Query must carry a LIMIT bound to a numeric parameter, keeping the
    // existing ORDER BY.
    expect(capturedSql).toContain("ORDER BY published_at DESC, id ASC");
    expect(capturedSql).toContain("LIMIT ?");
    expect(typeof boundLimit).toBe("number");
    expect(boundLimit).toBe(50000);
    // Sitemaps protocol caps a single file at 50,000 URLs.
    expect(entries.length).toBeLessThanOrEqual(50000);
    expect(entries.length).toBe(50000);
  });
});

describe("community indexability", () => {
  test("requires nonblank metadata and elements, without popularity or description thresholds", () => {
    const row = { slug: "new-fork", name: "Minimal (fork)", author_name: "Author" };
    expect(isCommunityIndexable(row, 1)).toBe(true);
    expect(isCommunityIndexable(row, 0)).toBe(false);
    for (const field of ["slug", "name", "author_name"] as const) {
      expect(isCommunityIndexable({ ...row, [field]: " \t\n\u00a0" }, 1)).toBe(false);
    }
  });
});

describe("design total counter", () => {
  const design = { version: 1, name: "T", elements: [{ id: "model", type: "model", style: {} }] } as Design;
  const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");

  test("migration seeds the counter from designs that already exist", () => {
    const db = new Database(":memory:");
    db.exec(migration("0001_init.sql"));
    db.exec(
      `INSERT INTO designs (id, json, slug, name, author_name, description, published_at)
       VALUES ('a', '{}', 'a', 'A', 'me', '', 1), ('b', '{}', 'b', 'B', 'me', '', 2)`,
    );
    db.exec(migration("0006_design_total.sql"));
    expect(db.query("SELECT total FROM design_total").get()).toEqual({ total: 2 });
    db.close();
  });

  test("follows publishes and raw deletes, and only the first /community page carries it", async () => {
    const env = { DB: makeD1() } as unknown as Env & { DB: ReturnType<typeof makeD1> };
    const ctx = { waitUntil() {} } as unknown as ExecutionContext;
    const page = async (query: string) => {
      const res = await handleListCommunity(new Request(`https://w.test/community?limit=1${query}`), env, ctx, {});
      return (await res.json()) as { items: unknown[]; nextCursor: string | null; total?: number };
    };

    expect(await getDesignTotal(env)).toBe(0);
    for (const name of ["One", "Two"]) {
      await publishDesign(env, { design, name, author_name: "me", description: "", publisher_hash: name });
    }
    expect(await getDesignTotal(env)).toBe(2);

    const first = await page("");
    expect(first.total).toBe(2);
    expect("total" in (await page(`&cursor=${first.nextCursor}`))).toBe(false);

    env.DB.raw.exec("DELETE FROM designs WHERE name = 'One'");
    expect((await page("")).total).toBe(1);

    env.DB.raw.exec("DELETE FROM design_total");
    const withoutCounter = await page("");
    expect(withoutCounter.items).toHaveLength(1);
    expect("total" in withoutCounter).toBe(false);
  });
});
