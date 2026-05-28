import { describe, expect, test } from "bun:test";
import {
  STATIC_SITEMAP_ROUTES,
  renderStaticRouteHtmlShell,
  renderRobotsTxt,
  renderSitemapIndexXml,
  renderSitemapPagesXml,
  renderWebManifest,
} from "../build";
import {
  DEFAULT_OG_IMAGE,
  STATIC_ROUTE_META,
  STATUSLINE_GUIDE_PATH,
  absoluteUrl,
  applyHeadMeta,
  buildCommunityDetailMeta,
  buildGuideFaqJsonLd,
  buildGuideHowToJsonLd,
  buildSoftwareApplicationJsonLd,
  canonicalUrl,
  metaForPath,
  resolveHeadMeta,
} from "../src/frontend/seo";
import { makeStubDocument } from "./helpers/domStub";

describe("static SEO assets", () => {
  test("renders robots.txt pointing at the static sitemap index", () => {
    expect(renderRobotsTxt()).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://statusline.sh/sitemap.xml\n",
    );
  });

  test("renders /sitemap.xml as an index referencing both children", () => {
    const xml = renderSitemapIndexXml();

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain(
      "<sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    );
    expect(xml).toContain(
      "<loc>https://statusline.sh/sitemap-pages.xml</loc>",
    );
    expect(xml).toContain(
      "<loc>https://statusline-community.zoniixyt.workers.dev/sitemap.xml</loc>",
    );
    // It's an index, not a urlset — no per-page <url> entries here.
    expect(xml).not.toContain("<url>");
    // Exactly two children.
    expect((xml.match(/<sitemap>/g) ?? []).length).toBe(2);
  });

  test("renders /sitemap-pages.xml with every static route as an absolute URL", () => {
    const xml = renderSitemapPagesXml();

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain(
      "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    );

    for (const route of STATIC_SITEMAP_ROUTES) {
      const loc =
        route.path === "/"
          ? "https://statusline.sh"
          : `https://statusline.sh${route.path}`;
      expect(xml).toContain(`<loc>${loc}</loc>`);
    }

    // One <url> per static route, each with a <lastmod>.
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
    expect(urlBlocks.length).toBe(STATIC_SITEMAP_ROUTES.length);
    for (const block of urlBlocks) {
      expect(block).toMatch(/<lastmod>[^<]+<\/lastmod>/);
    }
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
  });

  test("keeps static sitemap routes backed by route metadata", () => {
    for (const route of STATIC_SITEMAP_ROUTES) {
      expect(STATIC_ROUTE_META[route.path]?.canonicalPath).toBe(route.path);
    }
  });

  test("renders installable web manifest JSON", () => {
    const manifest = JSON.parse(renderWebManifest());

    expect(manifest.name).toBe("statusline.sh");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#0E0E10");
    expect(manifest.icons).toEqual([
      { src: "/logo.svg", sizes: "32x32", type: "image/svg+xml" },
    ]);
  });

  test("uses the rasterised default OG PNG", () => {
    expect(DEFAULT_OG_IMAGE).toBe("/og-default.png");
    expect(absoluteUrl(DEFAULT_OG_IMAGE)).toBe(
      "https://statusline.sh/og-default.png",
    );
  });

  test("builds canonical URLs and strips query strings", () => {
    expect(canonicalUrl("/")).toBe("https://statusline.sh/");
    expect(canonicalUrl("/builder")).toBe("https://statusline.sh/builder");
    expect(canonicalUrl("/builder?template=minimal")).toBe(
      "https://statusline.sh/builder",
    );
  });

  test("returns static and community detail route metadata", () => {
    expect(metaForPath("/").title).toBe(
      "Claude Code Statusline Builder | statusline.sh",
    );
    expect(metaForPath("/community/example-statusline")).toMatchObject({
      title: "Example Statusline | Community Statusline | statusline.sh",
      canonicalPath: "/community/example-statusline",
      // Per-design OG image points at the Worker PNG endpoint so social
      // crawlers see a card with the design's actual name + author.
      image: "https://statusline-community.zoniixyt.workers.dev/og/community/example-statusline.png",
    });
    expect(metaForPath(STATUSLINE_GUIDE_PATH)).toMatchObject({
      title: "How to Make a Claude Code Status Line | statusline.sh",
      canonicalPath: STATUSLINE_GUIDE_PATH,
    });
  });

  test("builds SoftwareApplication JSON-LD", () => {
    const jsonLd = buildSoftwareApplicationJsonLd();

    expect(jsonLd["@type"]).toBe("SoftwareApplication");
    expect(jsonLd.name).toBe("statusline.sh");
    expect(jsonLd.url).toBe("https://statusline.sh/");
    expect(jsonLd.offers).toMatchObject({ price: "0", priceCurrency: "USD" });
    expect(jsonLd.featureList).toContain("Visual Claude Code statusline builder");
  });

  test("builds guide HowTo and FAQ JSON-LD", () => {
    const howTo = buildGuideHowToJsonLd();
    const faq = buildGuideFaqJsonLd();

    expect(howTo["@type"]).toBe("HowTo");
    expect(howTo.name).toBe("How to make a Claude Code status line");
    expect(JSON.stringify(howTo)).toContain("Open the statusline.sh builder");
    expect(faq["@type"]).toBe("FAQPage");
    expect(JSON.stringify(faq)).toContain("statusline or a status bar");
  });

  test("renders route-specific HTML shell metadata", () => {
    const html = renderStaticRouteHtmlShell(
      [
        "<html><head>",
        '<meta name="description" content="Home" />',
        '<meta name="robots" content="index,follow" />',
        '<meta property="og:title" content="Home" />',
        '<meta property="og:description" content="Home" />',
        '<meta property="og:url" content="https://statusline.sh/" />',
        '<meta property="og:image" content="https://statusline.sh/og-default.png" />',
        '<meta name="twitter:title" content="Home" />',
        '<meta name="twitter:description" content="Home" />',
        '<meta name="twitter:image" content="https://statusline.sh/og-default.png" />',
        '<link rel="canonical" href="https://statusline.sh/" />',
        "<title>Home</title>",
        '<script type="application/ld+json">{}</script>',
        "</head><body></body></html>",
      ].join("\n"),
      STATIC_ROUTE_META["/community"]!,
    );

    expect(html).toContain(
      "<title>Claude Code Statusline Examples | statusline.sh Community</title>",
    );
    expect(html).toContain(
      '<meta name="description" content="Browse community-made Claude Code statusline examples, preview them, and fork any design into your own builder." />',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://statusline.sh/community" />',
    );
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  test("marks unknown dynamic routes noindex with a self-referencing canonical", () => {
    const meta = metaForPath("/some/client-only/state?x=1");
    expect(meta.robots).toBe("noindex,follow");
    expect(canonicalUrl(meta.canonicalPath)).toBe(
      "https://statusline.sh/some/client-only/state",
    );
  });

  test("community detail meta carries CreativeWork + SoftwareApplication JSON-LD", () => {
    const meta = buildCommunityDetailMeta({
      slug: "neon-bar",
      name: "Neon Bar",
      description: "A bright statusline.",
      author_name: "ada",
      published_at: Date.UTC(2026, 0, 2),
    });
    expect(meta.ogType).toBe("article");
    expect(meta.image).toBe(
      "https://statusline-community.zoniixyt.workers.dev/og/community/neon-bar.png",
    );
    const types = (meta.jsonLd ?? []).map((j) => j["@type"]);
    expect(types).toEqual([
      "SoftwareApplication",
      "CreativeWork",
      "BreadcrumbList",
    ]);
    const serialized = JSON.stringify(meta.jsonLd);
    expect(serialized).toContain('"datePublished":"2026-01-02T00:00:00.000Z"');
    expect(serialized).toContain('"name":"ada"');
    expect(serialized).toContain('"genre":"Claude Code statusline"');
  });
});

describe("runtime Seo head application", () => {
  test("resolveHeadMeta produces an absolute canonical, image, and og:type", () => {
    const resolved = resolveHeadMeta(metaForPath("/builder"));
    expect(resolved.title).toBe(STATIC_ROUTE_META["/builder"]!.title);
    expect(resolved.canonical).toBe("https://statusline.sh/builder");
    expect(resolved.image).toBe("https://statusline.sh/og-default.png");
    const ogUrl = resolved.metaTags.find((t) => t.key === "og:url");
    expect(ogUrl?.content).toBe("https://statusline.sh/builder");
    const ogType = resolved.metaTags.find((t) => t.key === "og:type");
    expect(ogType?.content).toBe("website");
  });

  test("applyHeadMeta sets a unique absolute canonical + title per route", () => {
    const doc = makeStubDocument();

    applyHeadMeta(metaForPath("/"), doc as unknown as Document);
    expect(doc.title).toBe(
      "Claude Code Statusline Builder | statusline.sh",
    );
    expect(
      doc.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://statusline.sh/");

    applyHeadMeta(metaForPath("/community"), doc as unknown as Document);
    expect(doc.title).toBe(
      "Claude Code Statusline Examples | statusline.sh Community",
    );
    expect(
      doc.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://statusline.sh/community");
  });

  test("applyHeadMeta updates tags in place rather than appending duplicates", () => {
    const doc = makeStubDocument();

    applyHeadMeta(metaForPath("/builder"), doc as unknown as Document);
    applyHeadMeta(metaForPath("/community"), doc as unknown as Document);

    // Exactly one canonical link, one description, one og:url after two routes.
    expect(doc.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(doc.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(doc.head.querySelectorAll('meta[property="og:url"]').length).toBe(1);

    // ...and they reflect the latest route, never the prior one.
    expect(
      doc.head.querySelector('meta[property="og:url"]')?.getAttribute("content"),
    ).toBe("https://statusline.sh/community");
    expect(
      doc.head.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toBe(STATIC_ROUTE_META["/community"]!.description);
  });

  test("applyHeadMeta replaces route JSON-LD (no stale blocks) on navigation", () => {
    const doc = makeStubDocument();

    // Community detail emits 3 route-scoped JSON-LD blocks...
    applyHeadMeta(
      buildCommunityDetailMeta({ slug: "neon-bar", name: "Neon Bar" }),
      doc as unknown as Document,
    );
    expect(
      doc.head.querySelectorAll(
        'script[type="application/ld+json"][data-seo="route"]',
      ).length,
    ).toBe(3);

    // ...navigating to /builder (no JSON-LD) clears them, leaving none stale.
    applyHeadMeta(metaForPath("/builder"), doc as unknown as Document);
    expect(
      doc.head.querySelectorAll(
        'script[type="application/ld+json"][data-seo="route"]',
      ).length,
    ).toBe(0);
  });

  test("applyHeadMeta no-ops without a document (SSR safety)", () => {
    expect(() => applyHeadMeta(metaForPath("/"), undefined)).not.toThrow();
  });
});

describe("static SEO assets (guide body)", () => {
  test("renders crawlable static body for the statusline guide", () => {
    const html = renderStaticRouteHtmlShell(
      [
        "<html><head>",
        '<meta name="description" content="Home" />',
        '<meta name="robots" content="index,follow" />',
        '<meta property="og:title" content="Home" />',
        '<meta property="og:description" content="Home" />',
        '<meta property="og:url" content="https://statusline.sh/" />',
        '<meta property="og:image" content="https://statusline.sh/og-default.png" />',
        '<meta name="twitter:title" content="Home" />',
        '<meta name="twitter:description" content="Home" />',
        '<meta name="twitter:image" content="https://statusline.sh/og-default.png" />',
        '<link rel="canonical" href="https://statusline.sh/" />',
        "<title>Home</title>",
        '<script type="application/ld+json">{}</script>',
        '</head><body><div id="root"></div></body></html>',
      ].join("\n"),
      STATIC_ROUTE_META[STATUSLINE_GUIDE_PATH]!,
    );

    expect(html).toContain(
      "<title>How to Make a Claude Code Status Line | statusline.sh</title>",
    );
    expect(html).toContain("How to make a Claude Code status line.");
    expect(html).toContain("Claude Code calls the bottom bar a statusline");
    expect(html).toContain('"@type":"HowTo"');
    expect(html).toContain('"@type":"FAQPage"');
  });
});
