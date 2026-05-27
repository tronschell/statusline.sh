import { describe, expect, test } from "bun:test";
import worker, {
  handleCommunityOgSvg,
  handleRobotsTxt,
  handleSitemapXml,
  type Env,
} from "../src/index";
import { match, route } from "../src/router";
import {
  communityCanonicalUrl,
  communityDescription,
  escapeXml,
  renderRobotsTxt,
  renderSitemapXml,
} from "../src/seo";
import { renderCommunityOgSvg } from "../src/og";

interface FakeDesignRow {
  slug: string;
  name: string;
  author_name?: string;
  description: string;
  published_at: number;
  views?: number;
  forks?: number;
  installs?: number;
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
        args: [] as unknown[],
        bind() {
          stmt.args = Array.from(arguments);
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
          if (
            norm ===
            "SELECT slug, name, author_name, description, published_at, views, forks, installs FROM designs WHERE slug = ?"
          ) {
            const slug = stmt.args[0];
            const row = rows.find((candidate) => candidate.slug === slug);
            if (!row) return null;
            return {
              author_name: "Anonymous",
              views: 0,
              forks: 0,
              installs: 0,
              ...row,
            } as T;
          }
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
  test("escapes XML-sensitive characters", () => {
    expect(escapeXml(`<tag attr="value">Tom & 'Jerry'</tag>`)).toBe(
      "&lt;tag attr=&quot;value&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/tag&gt;",
    );
  });

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
    if (!match("GET", "/og/community/example.svg")) {
      route("GET", "/og/community/:slug.svg", (_req, env, _ctx, params) =>
        handleCommunityOgSvg(env as Env, params),
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

  test("GET /og/community/:slug.svg returns an escaped SVG preview", async () => {
    ensureSeoRoutes();
    const res = await worker.fetch(
      new Request("https://worker.example.com/og/community/quiet-prompt-abcd.svg"),
      makeEnv([
        {
          slug: "quiet-prompt-abcd",
          name: "Quiet <Prompt>",
          author_name: "Taylor & Co",
          description: "Muted borders & careful spacing",
          published_at: Date.UTC(2026, 0, 2, 3, 4, 5),
          views: 1234,
          forks: 56,
          installs: 789,
        },
      ]),
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400",
    );
    const svg = await res.text();
    expect(svg).toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("Quiet &lt;Prompt&gt;");
    expect(svg).toContain("by Taylor &amp; Co");
    expect(svg).toContain("789 installs / 1,234 views / 56 forks");
    expect(svg).toContain("Muted borders &amp; careful spacing");
    expect(svg).toContain("statusline.sh/community/quiet-prompt-abcd");
    expect(svg).not.toContain("Quiet <Prompt>");
  });

  test("GET /og/community/:slug.svg returns 404 for a missing slug", async () => {
    ensureSeoRoutes();
    const res = await worker.fetch(
      new Request("https://worker.example.com/og/community/missing.svg"),
      makeEnv([]),
      makeCtx(),
    );

    expect(res.status).toBe(404);
  });
});

describe("Open Graph SVG renderer", () => {
  test("renders deterministic XML-safe SVG without design JSON", () => {
    const svg = renderCommunityOgSvg({
      slug: "warm-lines-abcd",
      name: "Warm Lines",
      author_name: "Mina",
      description: "A dark, border-led statusline card",
      published_at: 1_767_225_600_000,
      views: 12,
      forks: 3,
      installs: 7,
    });

    expect(svg).toBe(
      renderCommunityOgSvg({
        slug: "warm-lines-abcd",
        name: "Warm Lines",
        author_name: "Mina",
        description: "A dark, border-led statusline card",
        published_at: 1_767_225_600_000,
        views: 12,
        forks: 3,
        installs: 7,
      }),
    );
    expect(svg).toContain("#0d0c0b");
    expect(svg).toContain("COMMUNITY DESIGN");
    expect(svg).not.toContain("<script");
  });
});
