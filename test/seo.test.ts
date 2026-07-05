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
  buildInteractionStatistic,
  buildOrganizationJsonLd,
  buildSoftwareApplicationJsonLd,
  canonicalUrl,
  metaForPath,
  resolveHeadMeta,
} from "../src/frontend/seo";
import {
  NOT_SHOWING_FAQS,
  findProgrammaticPageByPath,
} from "../src/frontend/components/Programmatic/programmatic";
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
      "<loc>https://statusline.sh/sitemap-community.xml</loc>",
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
      "Free Claude Code Statusline Builder — Visual Status Line Maker | statusline.sh",
    );
    expect(metaForPath("/community/example-statusline")).toMatchObject({
      // Reconciled to match the SSR detail title format exactly.
      title: "Example Statusline — Claude Code Statusline | statusline.sh",
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

  test("returns comparison-hub route metadata with breadcrumb, item list, and FAQ", () => {
    const meta = metaForPath("/best-claude-code-statusline");
    expect(meta.title).toBe(
      "Best Claude Code Statusline Tools (2026) | statusline.sh",
    );
    expect(meta.canonicalPath).toBe("/best-claude-code-statusline");
    expect(canonicalUrl(meta.canonicalPath)).toBe(
      "https://statusline.sh/best-claude-code-statusline",
    );

    const types = (meta.jsonLd ?? []).map((j) => j["@type"]);
    expect(types).toEqual([
      "BreadcrumbList",
      "Article",
      "ItemList",
      "FAQPage",
    ]);

    // The roundup names the real competitor tools + statusline.sh.
    const serialized = JSON.stringify(meta.jsonLd);
    for (const tool of [
      "statusline.sh",
      "ccstatusline",
      "claude-powerline",
      "CCometixLine",
      "ccusage",
    ]) {
      expect(serialized).toContain(tool);
    }
  });

  test("returns vs-ccstatusline route metadata (Breadcrumb + Article, no FAQ)", () => {
    const meta = metaForPath("/claude-code-statusline-vs-ccstatusline");
    expect(meta.title).toBe(
      "Claude Code Statusline: statusline.sh vs ccstatusline | statusline.sh",
    );
    expect(meta.canonicalPath).toBe("/claude-code-statusline-vs-ccstatusline");
    expect(canonicalUrl(meta.canonicalPath)).toBe(
      "https://statusline.sh/claude-code-statusline-vs-ccstatusline",
    );

    // The vs page stays Breadcrumb + Article — no FAQ schema.
    const types = (meta.jsonLd ?? []).map((j) => j["@type"]);
    expect(types).toEqual(["BreadcrumbList", "Article"]);
    // Honest, evergreen comparison names the competitor.
    expect(JSON.stringify(meta.jsonLd)).toContain("ccstatusline");
  });

  test("not-showing page emits a FAQPage whose Q&A match the visible sections", () => {
    const meta = metaForPath("/claude-code-statusline-not-showing");
    expect(meta.title).toBe(
      "Claude Code Statusline Not Showing? Troubleshooting | statusline.sh",
    );
    expect(meta.canonicalPath).toBe("/claude-code-statusline-not-showing");

    const jsonLd = meta.jsonLd ?? [];
    const types = jsonLd.map((j) => j["@type"]);
    expect(types).toEqual(["BreadcrumbList", "Article", "FAQPage"]);

    const faqNode = jsonLd.find((j) => j["@type"] === "FAQPage") as
      | Record<string, unknown>
      | undefined;
    expect(faqNode).toBeDefined();
    const mainEntity = faqNode!["mainEntity"] as Array<Record<string, unknown>>;
    expect(mainEntity.length).toBe(NOT_SHOWING_FAQS.length);
    expect(NOT_SHOWING_FAQS.length).toBeGreaterThan(0);

    // Google requires FAQ structured data to match the on-page content: every
    // JSON-LD Q&A is sourced from the same array that renders as a visible
    // section (heading = question, paragraph = answer).
    const page = findProgrammaticPageByPath(
      "/claude-code-statusline-not-showing",
    );
    expect(page).toBeDefined();
    NOT_SHOWING_FAQS.forEach((faq, i) => {
      const question = mainEntity[i]!;
      expect(question["name"]).toBe(faq.q);
      expect(
        (question["acceptedAnswer"] as Record<string, unknown>)["text"],
      ).toBe(faq.a);

      const section = page!.sections[i]!;
      expect(section.heading).toBe(faq.q);
      expect(section.paragraphs).toContain(faq.a);
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
      "<title>Claude Code Statusline Examples, Templates &amp; Themes | statusline.sh</title>",
    );
    expect(html).toContain(
      '<meta name="description" content="Browse Claude Code statusline examples, templates, and themes. Preview each design in a live terminal, copy-paste install in one command, or fork it into the builder." />',
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
    // Title reconciled with the SSR detail format (worker/src/ssr.ts).
    expect(meta.title).toBe("Neon Bar — Claude Code Statusline | statusline.sh");
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

  test("homepage JSON-LD includes a defined Organization with logo + sameAs", () => {
    const org = buildOrganizationJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(org["name"]).toBe("statusline.sh");
    expect(org["url"]).toBe("https://statusline.sh");
    expect(org["logo"]).toBe("https://statusline.sh/logo.svg");
    expect(org["sameAs"]).toEqual([
      "https://github.com/tronschell/statusline.sh",
    ]);

    // ...and it is actually wired into the homepage route metadata.
    const homeJsonLd = STATIC_ROUTE_META["/"]!.jsonLd ?? [];
    const homeTypes = homeJsonLd.map((j) => j["@type"]);
    expect(homeTypes).toContain("Organization");
    expect(homeTypes).toContain("WebSite");
    expect(homeTypes).toContain("SoftwareApplication");
  });

  test("WebSite JSON-LD does not emit a SearchAction (no real search endpoint)", () => {
    const home = (STATIC_ROUTE_META["/"]!.jsonLd ?? []).find(
      (j) => j["@type"] === "WebSite",
    );
    expect(home).toBeDefined();
    // SearchAction is deferred until a real `?q=` search endpoint exists —
    // emitting one that points at a non-filtering URL is invalid structured data.
    expect(home!["potentialAction"]).toBeUndefined();
  });

  test("buildInteractionStatistic maps counts to schema.org InteractionCounters", () => {
    const stats = buildInteractionStatistic({ installs: 128, forks: 7, views: 42 });
    expect(stats).toBeDefined();
    const byType = Object.fromEntries(
      (stats ?? []).map((s) => [s["interactionType"], s["userInteractionCount"]]),
    );
    expect(byType["https://schema.org/InstallAction"]).toBe(128);
    expect(byType["https://schema.org/ShareAction"]).toBe(7);
    expect(byType["https://schema.org/ViewAction"]).toBe(42);
    for (const s of stats ?? []) {
      expect(s["@type"]).toBe("InteractionCounter");
    }
    // No counts at all → undefined so the property is omitted, not emitted empty.
    expect(buildInteractionStatistic({})).toBeUndefined();
  });

  test("community detail meta emits InteractionCounter stats when counts are supplied", () => {
    const meta = buildCommunityDetailMeta({
      slug: "neon-bar",
      name: "Neon Bar",
      author_name: "ada",
      installs: 128,
      forks: 7,
      views: 42,
    });
    const software = (meta.jsonLd ?? []).find(
      (j) => j["@type"] === "SoftwareApplication",
    ) as Record<string, unknown> | undefined;
    expect(software).toBeDefined();
    const stats = software!["interactionStatistic"] as
      | Array<Record<string, unknown>>
      | undefined;
    expect(Array.isArray(stats)).toBe(true);
    expect(stats!.length).toBe(3);
    const byType = Object.fromEntries(
      stats!.map((s) => [s["interactionType"], s["userInteractionCount"]]),
    );
    expect(byType["https://schema.org/InstallAction"]).toBe(128);
    expect(byType["https://schema.org/ShareAction"]).toBe(7);
    expect(byType["https://schema.org/ViewAction"]).toBe(42);
  });

  test("community detail meta omits InteractionCounter when no counts are supplied", () => {
    const meta = buildCommunityDetailMeta({ slug: "neon-bar", name: "Neon Bar" });
    const software = (meta.jsonLd ?? []).find(
      (j) => j["@type"] === "SoftwareApplication",
    ) as Record<string, unknown>;
    expect(software["interactionStatistic"]).toBeUndefined();
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
      "Free Claude Code Statusline Builder — Visual Status Line Maker | statusline.sh",
    );
    expect(
      doc.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://statusline.sh/");

    applyHeadMeta(metaForPath("/community"), doc as unknown as Document);
    expect(doc.title).toBe(
      "Claude Code Statusline Examples, Templates & Themes | statusline.sh",
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

  test("renders crawlable comparison body naming every tool + the differentiator", () => {
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
      STATIC_ROUTE_META["/best-claude-code-statusline"]!,
    );

    expect(html).toContain(
      "<title>Best Claude Code Statusline Tools (2026) | statusline.sh</title>",
    );
    expect(html).toContain("Best Claude Code Statusline Tools (2026).");
    // Every competitor named, plus statusline.sh positioned as the web builder.
    for (const tool of [
      "ccstatusline",
      "claude-powerline",
      "CCometixLine",
      "ccusage",
    ]) {
      expect(html).toContain(tool);
    }
    expect(html).toContain("web-based visual builder");
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"@type":"FAQPage"');
  });
});
