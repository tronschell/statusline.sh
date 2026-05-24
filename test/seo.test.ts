import { describe, expect, test } from "bun:test";
import {
  STATIC_SITEMAP_ROUTES,
  renderStaticRouteHtmlShell,
  renderRobotsTxt,
  renderStaticSitemapXml,
  renderWebManifest,
} from "../build";
import {
  DEFAULT_OG_IMAGE,
  STATIC_ROUTE_META,
  absoluteUrl,
  buildSoftwareApplicationJsonLd,
  canonicalUrl,
  metaForPath,
} from "../src/frontend/seo";

describe("static SEO assets", () => {
  test("renders robots.txt with static and Worker sitemap locations", () => {
    expect(renderRobotsTxt()).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://statusline.sh/sitemap.xml\nSitemap: https://api.statusline.sh/sitemap.xml\n",
    );
  });

  test("renders static sitemap XML for canonical routes", () => {
    const xml = renderStaticSitemapXml();

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain("<loc>https://statusline.sh</loc>");
    expect(xml).toContain("<loc>https://statusline.sh/builder</loc>");
    expect(xml).toContain("<loc>https://statusline.sh/community</loc>");
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

  test("uses the generated default OG SVG", () => {
    expect(DEFAULT_OG_IMAGE).toBe("/og-default.svg");
    expect(absoluteUrl(DEFAULT_OG_IMAGE)).toBe(
      "https://statusline.sh/og-default.svg",
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
    });
  });

  test("builds SoftwareApplication JSON-LD", () => {
    const jsonLd = buildSoftwareApplicationJsonLd();

    expect(jsonLd["@type"]).toBe("SoftwareApplication");
    expect(jsonLd.name).toBe("statusline.sh");
    expect(jsonLd.url).toBe("https://statusline.sh/");
    expect(jsonLd.offers).toMatchObject({ price: "0", priceCurrency: "USD" });
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
        '<meta property="og:image" content="https://statusline.sh/og-default.svg" />',
        '<meta name="twitter:title" content="Home" />',
        '<meta name="twitter:description" content="Home" />',
        '<meta name="twitter:image" content="https://statusline.sh/og-default.svg" />',
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
});
