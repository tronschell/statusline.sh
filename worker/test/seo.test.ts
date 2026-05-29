import { describe, expect, test } from "bun:test";
import worker, {
  handleCommunityOgPng,
  handleCommunityOgSvg,
  handleRobotsTxt,
  handleSitemapXml,
  type Env,
} from "../src/index";
import { match, route } from "../src/router";
import {
  STATIC_SITEMAP_ROUTES,
  communityCanonicalUrl,
  communityDescription,
  escapeXml,
  renderRobotsTxt,
  renderSitemapXml,
  STATIC_ROUTES_LASTMOD,
} from "../src/seo";
import { STATIC_SITEMAP_ROUTES as BUILD_STATIC_SITEMAP_ROUTES } from "../../build";
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
            "SELECT slug, published_at FROM designs ORDER BY published_at DESC, id ASC LIMIT ?"
          ) {
            // The bound LIMIT is the last (only) bind arg — honour it so a
            // table larger than the cap returns at most that many rows.
            const limit = stmt.args[stmt.args.length - 1] as number;
            return {
              results: [...rows]
                .sort((a, b) => b.published_at - a.published_at)
                .slice(0, limit)
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

  test("renders XML-safe community sitemap entries", () => {
    const xml = renderSitemapXml([
      { slug: "quiet&prompt", published_at: Date.UTC(2026, 0, 2, 3, 4, 5) },
    ]);

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain(
      "<loc>https://statusline.sh/community/quiet%26prompt</loc>",
    );
    expect(xml).toContain("<lastmod>2026-01-02T03:04:05.000Z</lastmod>");
    expect(xml).not.toContain("quiet&prompt");
  });

  test("worker sitemap contains ONLY community URLs, not the static pages", () => {
    const xml = renderSitemapXml([
      { slug: "one-aaaa", published_at: Date.UTC(2026, 0, 2, 3, 4, 5) },
    ]);

    // Static routes now live in Vercel's `sitemap-pages.xml`, so they must NOT
    // appear here — otherwise the two child sitemaps would duplicate URLs.
    expect(xml).not.toContain("<loc>https://statusline.sh</loc>");
    expect(xml).not.toContain("<loc>https://statusline.sh/builder</loc>");
    expect(xml).not.toContain("<loc>https://statusline.sh/community</loc>");
    expect(xml).not.toContain(
      "<loc>https://statusline.sh/how-to-make-a-claude-code-statusline</loc>",
    );
    expect(xml).not.toContain("<loc>https://statusline.sh/privacy</loc>");
    expect(xml).not.toContain("<loc>https://statusline.sh/terms</loc>");
  });

  test("every <url> in the sitemap is a community design with a <lastmod>", () => {
    const xml = renderSitemapXml([
      { slug: "one-aaaa", published_at: Date.UTC(2026, 0, 2, 3, 4, 5) },
      { slug: "two-bbbb", published_at: Date.UTC(2026, 1, 3, 4, 5, 6) },
    ]);

    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
    // Community-only sitemap: exactly the two design entries.
    expect(urlBlocks.length).toBe(2);
    for (const block of urlBlocks) {
      expect(block).toContain("/community/");
      expect(block).toMatch(/<lastmod>[^<]+<\/lastmod>/);
    }
  });

  test("an empty community sitemap is a valid, empty urlset", () => {
    const xml = renderSitemapXml([]);
    expect(xml).toContain(
      "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    );
    expect(xml).not.toContain("<url>");
    // STATIC_ROUTES_LASTMOD is still a valid ISO-8601 constant (referenced by
    // the static sitemap index in build.ts, kept here for the sync guard).
    expect(new Date(STATIC_ROUTES_LASTMOD).toISOString()).toBe(
      STATIC_ROUTES_LASTMOD,
    );
  });

  test("worker STATIC_SITEMAP_ROUTES stays in sync with build.ts [[seo-routes-mirror]]", () => {
    expect(STATIC_SITEMAP_ROUTES).toEqual(BUILD_STATIC_SITEMAP_ROUTES);
  });
});

describe("SEO worker routes", () => {
  function ensureSeoRoutes(): void {
    if (!match("GET", "/robots.txt")) {
      route("GET", "/robots.txt", () => handleRobotsTxt());
    }
    if (!match("GET", "/sitemap.xml")) {
      route("GET", "/sitemap.xml", (req, env, ctx) =>
        handleSitemapXml(req, env as Env, ctx),
      );
    }
    if (!match("GET", "/og/community/example.svg")) {
      route("GET", "/og/community/:slug.svg", (_req, env, _ctx, params) =>
        handleCommunityOgSvg(env as Env, params),
      );
    }
    if (!match("GET", "/og/community/example.png")) {
      route("GET", "/og/community/:slug.png", (_req, env, _ctx, params) =>
        handleCommunityOgPng(env as Env, params),
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

  test("GET /sitemap.xml returns 429 without reading the DB when rate limited", async () => {
    ensureSeoRoutes();
    const env: Env = {
      ...makeEnv([
        {
          slug: "any-aaaa",
          name: "Any",
          description: "",
          published_at: 1_700_000_000_000,
        },
      ]),
      // Stubbed detail limiter that always denies — the handler must bail with
      // 429 BEFORE issuing the (otherwise throwing) DB query below.
      RATE_LIMITER_DETAIL: {
        async limit() {
          return { success: false };
        },
      },
      // Replace DB so any query at all blows up — proves the rate-limit check
      // short-circuits ahead of the table scan.
      DB: {
        prepare() {
          throw new Error("DB must not be touched when rate limited");
        },
      } as unknown as D1Database,
    };

    const res = await worker.fetch(
      new Request("https://worker.example.com/sitemap.xml"),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(429);
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

  test("GET /og/community/:slug.png rasterises the SVG to a real PNG", async () => {
    ensureSeoRoutes();
    const res = await worker.fetch(
      new Request("https://worker.example.com/og/community/quiet-prompt-abcd.png"),
      makeEnv([
        {
          slug: "quiet-prompt-abcd",
          name: "Quiet Prompt",
          author_name: "Taylor",
          description: "Muted borders, careful spacing",
          published_at: Date.UTC(2026, 0, 2, 3, 4, 5),
          views: 1234,
          forks: 56,
          installs: 789,
        },
      ]),
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400",
    );

    const bytes = new Uint8Array(await res.arrayBuffer());
    // PNG magic header (\x89PNG\r\n\x1a\n).
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    // Sanity-check size — anything smaller is empty, anything bigger is a
    // sign resvg is emitting an uncompressed pixel buffer.
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.length).toBeLessThan(500_000);

    // IHDR chunk: bytes 16..23 are width, height as big-endian uint32.
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    expect(view.getUint32(16, false)).toBe(1200);
    expect(view.getUint32(20, false)).toBe(630);
  });

  test("GET /og/community/:slug.png returns 404 for a missing slug", async () => {
    ensureSeoRoutes();
    const res = await worker.fetch(
      new Request("https://worker.example.com/og/community/missing.png"),
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
