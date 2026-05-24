import { describe, expect, test } from "bun:test";
import worker, {
  handleRobotsTxt,
  handleSitemapXml,
  type Env,
} from "../src/index";
import { match, route } from "../src/router";
import {
  communityCanonicalUrl,
  communityDescription,
  renderRobotsTxt,
  renderSitemapXml,
} from "../src/seo";

interface FakeDesignRow {
  slug: string;
  name: string;
  description: string;
  published_at: number;
}

function makeCtx(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;
}

function makeEnv(rows: FakeDesignRow[]): Env {
  const db = {
    prepare(sql: string) {
      const norm = sql.replace(/\s+/g, " ").trim();
      if (/\bjson\b/.test(norm)) {
        throw new Error("sitemap must not query design JSON");
      }

      const stmt = {
        bind() {
          return stmt;
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          if (
            norm ===
            "SELECT slug, published_at FROM designs ORDER BY published_at DESC, id ASC"
          ) {
            return {
              results: [...rows]
                .sort((a, b) => b.published_at - a.published_at)
                .map(({ slug, published_at }) => ({ slug, published_at })) as T[],
            };
          }
          throw new Error("unexpected all() SQL: " + norm);
        },
        async first<T = unknown>(): Promise<T | null> {
          throw new Error("unexpected first() SQL: " + norm);
        },
        async run(): Promise<D1Response> {
          throw new Error("unexpected run() SQL: " + norm);
        },
      };
      return stmt;
    },
    async batch() {
      throw new Error("batch not implemented in test stub");
    },
  } as unknown as D1Database;

  return {
    DB: db,
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    ALLOWED_ORIGINS: "https://statusline.sh",
  };
}

describe("SEO render helpers", () => {
  test("renders robots.txt with sitemap location", () => {
    expect(renderRobotsTxt()).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://statusline.sh/sitemap.xml\n",
    );
  });

  test("builds community canonical URLs", () => {
    expect(communityCanonicalUrl("quiet-prompt-abcd")).toBe(
      "https://statusline.sh/community/quiet-prompt-abcd",
    );
  });

  test("uses description when present and falls back to design name", () => {
    expect(communityDescription({ name: "Quiet", description: "  Calm UI  " })).toBe(
      "Calm UI",
    );
    expect(communityDescription({ name: "Quiet", description: "" })).toBe(
      "Claude Code statusline design: Quiet",
    );
  });

  test("renders XML-safe sitemap entries", () => {
    const xml = renderSitemapXml([
      { slug: "quiet&prompt", published_at: Date.UTC(2026, 0, 2, 3, 4, 5) },
    ]);

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain("<loc>https://statusline.sh</loc>");
    expect(xml).toContain("<loc>https://statusline.sh/community</loc>");
    expect(xml).toContain(
      "<loc>https://statusline.sh/community/quiet%26prompt</loc>",
    );
    expect(xml).toContain("<lastmod>2026-01-02T03:04:05.000Z</lastmod>");
    expect(xml).not.toContain("quiet&prompt");
  });
});

describe("SEO worker routes", () => {
  function ensureSeoRoutes(): void {
    if (!match("GET", "/robots.txt")) {
      route("GET", "/robots.txt", () => handleRobotsTxt());
    }
    if (!match("GET", "/sitemap.xml")) {
      route("GET", "/sitemap.xml", (_req, env) =>
        handleSitemapXml(env as Env),
      );
    }
  }

  test("GET /robots.txt returns text/plain robots policy", async () => {
    ensureSeoRoutes();
    const res = await worker.fetch(
      new Request("https://worker.example.com/robots.txt"),
      makeEnv([]),
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toContain(
      "Sitemap: https://statusline.sh/sitemap.xml",
    );
  });

  test("GET /sitemap.xml lists community URLs without views or JSON fetches", async () => {
    ensureSeoRoutes();
    const writes: unknown[] = [];
    const env: Env = {
      ...makeEnv([
        {
          slug: "newer-bbbb",
          name: "Newer",
          description: "",
          published_at: 1_800_000_000_000,
        },
        {
          slug: "older-aaaa",
          name: "Older",
          description: "",
          published_at: 1_700_000_000_000,
        },
      ]),
      VIEWS: {
        writeDataPoint(event) {
          writes.push(event);
        },
      },
    };

    const res = await worker.fetch(
      new Request("https://worker.example.com/sitemap.xml"),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8",
    );
    const xml = await res.text();
    expect(xml).toContain(
      "<loc>https://statusline.sh/community/newer-bbbb</loc>",
    );
    expect(xml).toContain(
      "<loc>https://statusline.sh/community/older-aaaa</loc>",
    );
    expect(xml.indexOf("newer-bbbb")).toBeLessThan(xml.indexOf("older-aaaa"));
    expect(writes).toEqual([]);
  });
});
