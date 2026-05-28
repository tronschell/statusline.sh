import tailwind from "bun-plugin-tailwind";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import {
  DEFAULT_OG_IMAGE,
  PROGRAMMATIC_ROUTE_META,
  SITE_NAME,
  SITE_URL,
  STATIC_ROUTE_META,
  STATUSLINE_GUIDE_PATH,
  absoluteUrl,
  canonicalUrl,
  type RouteMeta,
} from "./src/frontend/seo";
import {
  renderStaticRouteBody,
  staticHeadJsonLd,
} from "./src/frontend/static-content/staticContent";

const outdir = path.join(process.cwd(), "dist");

type StaticSitemapRoute = {
  path: string;
  priority: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
};

export const STATIC_SITEMAP_ROUTES: StaticSitemapRoute[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/builder", priority: "0.9", changefreq: "weekly" },
  { path: "/community", priority: "0.8", changefreq: "daily" },
  { path: STATUSLINE_GUIDE_PATH, priority: "0.7", changefreq: "monthly" },
  ...PROGRAMMATIC_ROUTE_META.map(
    (item): StaticSitemapRoute => ({
      path: item.path,
      priority: "0.6",
      changefreq: "monthly",
    }),
  ),
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/terms", priority: "0.2", changefreq: "yearly" },
];

const STATIC_HTML_ROUTES = [
  "/builder",
  "/community",
  STATUSLINE_GUIDE_PATH,
  ...PROGRAMMATIC_ROUTE_META.map((item) => item.path),
  "/privacy",
  "/terms",
];

// The Worker host (the `workers.dev` URL) can be down independently of the
// primary Vercel domain, so `robots.txt` and the sitemap index are served as
// STATIC Vercel assets and never depend on the Worker being healthy. The
// sitemap index references two children:
//   1. `sitemap-pages.xml` — the static routes, always served by Vercel.
//   2. the Worker's `/sitemap.xml` — community designs, graceful degradation.
const STATIC_SITEMAP_PAGES_URL = `${SITE_URL}/sitemap-pages.xml`;
const WORKER_SITEMAP_URL = "https://statusline-community.zoniixyt.workers.dev/sitemap.xml";

// Deterministic lastmod for the static page routes — kept in lockstep with
// `STATIC_ROUTES_LASTMOD` in `worker/src/seo.ts`. Bump manually when the
// static pages meaningfully change so search engines don't see noisy churn.
export const STATIC_ROUTES_LASTMOD = "2026-05-27T00:00:00.000Z";

export function renderRobotsTxt(siteUrl = SITE_URL): string {
  const origin = siteUrl.replace(/\/+$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

/**
 * The canonical `/sitemap.xml` — a sitemap INDEX (not a urlset). Points at the
 * static page sitemap (always served by Vercel) plus the Worker's
 * community-design sitemap. If the Worker is down, GSC only warns on that one
 * child rather than failing the whole submission.
 */
export function renderSitemapIndexXml(
  pagesUrl = STATIC_SITEMAP_PAGES_URL,
  workerSitemapUrl = WORKER_SITEMAP_URL,
  lastmod = STATIC_ROUTES_LASTMOD,
): string {
  const child = (loc: string): string =>
    [
      "  <sitemap>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
      "  </sitemap>",
    ].join("\n");

  const body = [child(pagesUrl), child(workerSitemapUrl)].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/**
 * `/sitemap-pages.xml` — a urlset of every route Vercel itself serves. Mirrors
 * the worker sitemap's per-URL shape (`loc`/`lastmod`/`changefreq`/`priority`).
 */
export function renderSitemapPagesXml(
  routes = STATIC_SITEMAP_ROUTES,
  siteUrl = SITE_URL,
  lastmod = STATIC_ROUTES_LASTMOD,
): string {
  const origin = siteUrl.replace(/\/+$/, "");
  const urls = routes
    .map((route) => {
      const loc = `${origin}${route.path === "/" ? "" : route.path}`;
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderWebManifest(): string {
  return `${JSON.stringify(
    {
      name: SITE_NAME,
      short_name: SITE_NAME,
      description: "Visual Claude Code statusline builder.",
      start_url: "/",
      display: "standalone",
      background_color: "#0E0E10",
      theme_color: "#0E0E10",
      icons: [
        {
          src: "/logo.svg",
          sizes: "32x32",
          type: "image/svg+xml",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

async function build(): Promise<void> {
  await rm(outdir, { recursive: true, force: true });

  const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

  // Build-time env inlining. Anything prefixed with NEXT_PUBLIC_ / PUBLIC_ that
  // Vercel exposes during the build gets replaced as a string literal in the
  // bundle. Frontend code reads via `process.env.NEXT_PUBLIC_WORKER_URL` etc.;
  // at runtime in the browser there is no real `process.env`.
  const define: Record<string, string> = {
    "process.env.NODE_ENV": JSON.stringify("production"),
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string") continue;
    if (key.startsWith("NEXT_PUBLIC_") || key.startsWith("PUBLIC_")) {
      define[`process.env.${key}`] = JSON.stringify(value);
    }
  }

  const result = await Bun.build({
    entrypoints,
    outdir,
    plugins: [tailwind],
    minify: true,
    target: "browser",
    sourcemap: "linked",
    define,
  });

  await writeStaticSeoAssets();
  await writeStaticRouteHtmlShells();

  for (const output of result.outputs) {
    console.log(
      ` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`,
    );
  }
}

async function writeStaticRouteHtmlShells(): Promise<void> {
  const indexHtml = await readFile(path.join(outdir, "index.html"), "utf8");

  await Promise.all(
    STATIC_HTML_ROUTES.map((route) => {
      const meta = STATIC_ROUTE_META[route];
      if (!meta) throw new Error(`Missing static route metadata for ${route}`);

      const filename = `${route.slice(1)}.html`;
      return writeFile(
        path.join(outdir, filename),
        renderStaticRouteHtmlShell(indexHtml, meta),
        "utf8",
      );
    }),
  );
}

export function renderStaticRouteHtmlShell(
  indexHtml: string,
  meta: RouteMeta,
): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const robots = escapeHtml(meta.robots ?? "index,follow");
  const canonical = escapeHtml(canonicalUrl(meta.canonicalPath));
  const image = escapeHtml(absoluteUrl(meta.image ?? DEFAULT_OG_IMAGE));

  let html = indexHtml;
  html = replaceFirst(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = replaceFirst(
    html,
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/,
    `<meta name="description" content="${description}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+name="robots"\s+content="[\s\S]*?"\s*\/>/,
    `<meta name="robots" content="${robots}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/>/,
    `<meta property="og:title" content="${title}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/,
    `<meta property="og:description" content="${description}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+property="og:url"\s+content="[\s\S]*?"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+property="og:image"\s+content="[\s\S]*?"\s*\/>/,
    `<meta property="og:image" content="${image}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/>/,
    `<meta name="twitter:title" content="${title}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/>/,
    `<meta name="twitter:description" content="${description}" />`,
  );
  html = replaceFirst(
    html,
    /<meta\s+name="twitter:image"\s+content="[\s\S]*?"\s*\/>/,
    `<meta name="twitter:image" content="${image}" />`,
  );
  html = replaceFirst(
    html,
    /<link\s+rel="canonical"\s+href="[\s\S]*?"\s*\/>/,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = replaceFirst(
    html,
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
    renderJsonLdScripts(meta),
  );
  return injectStaticRootHtml(html, meta);
}

function injectStaticRootHtml(indexHtml: string, meta: RouteMeta): string {
  const staticHtml = renderStaticRouteBody(meta.canonicalPath);
  if (!staticHtml) return indexHtml;
  return indexHtml.replace(
    /<div\s+id="root"><\/div>/,
    `<div id="root">${staticHtml}</div>`,
  );
}

function renderJsonLdScripts(meta: RouteMeta): string {
  // The shared `meta.jsonLd` plus any route-specific extras (e.g. the builder
  // page's SoftwareApplication schema, attached in the static-content module
  // without mutating the shared `seo.ts` metadata).
  const items = [...(meta.jsonLd ?? []), ...staticHeadJsonLd(meta.canonicalPath)];
  return items
    .map(
      (item) =>
        `<script type="application/ld+json">${escapeScriptJson(JSON.stringify(item))}</script>`,
    )
    .join("\n");
}

function replaceFirst(
  value: string,
  pattern: RegExp,
  replacement: string,
): string {
  if (!pattern.test(value)) {
    throw new Error(`Expected HTML pattern not found: ${pattern}`);
  }

  return value.replace(pattern, replacement);
}

async function writeStaticSeoAssets(): Promise<void> {
  // `robots.txt`, `sitemap.xml` (a sitemap index), and `sitemap-pages.xml` are
  // written as STATIC Vercel assets so Google never depends on the Worker host
  // being up. The sitemap index points at `sitemap-pages.xml` (always served by
  // Vercel) plus the Worker's community sitemap (graceful degradation). All
  // three contain a dot so Vercel's catch-all SPA rewrite excludes them.
  await mkdir(outdir, { recursive: true });
  const ogSvgPath = path.join(process.cwd(), "src", "static", "og-default.svg");
  await Promise.all([
    writeFile(path.join(outdir, "robots.txt"), renderRobotsTxt(), "utf8"),
    writeFile(
      path.join(outdir, "sitemap.xml"),
      renderSitemapIndexXml(),
      "utf8",
    ),
    writeFile(
      path.join(outdir, "sitemap-pages.xml"),
      renderSitemapPagesXml(),
      "utf8",
    ),
    writeFile(
      path.join(outdir, "site.webmanifest"),
      renderWebManifest(),
      "utf8",
    ),
    // Keep the SVG around for crawlers / hotlinks (Google indexes it fine).
    copyFile(ogSvgPath, path.join(outdir, "og-default.svg")),
    // Most chat apps refuse to render SVG `og:image`. Rasterise the SVG to
    // PNG once at build time so link previews actually appear.
    renderOgDefaultPng(ogSvgPath, path.join(outdir, "og-default.png")),
    copyFile(
      path.join(process.cwd(), "src", "logo.svg"),
      path.join(outdir, "logo.svg"),
    ),
  ]);
}

/**
 * Rasterise the default OG SVG to a 1200×630 PNG. We pin via `fitTo: width`
 * (the canvas viewBox is already 1200×630, so the height comes out right).
 *
 * Bun runs `@resvg/resvg-js` natively — Vercel's build environment also
 * supports the prebuilt napi binary, so no extra setup is required.
 */
async function renderOgDefaultPng(svgPath: string, pngPath: string): Promise<void> {
  const svg = await readFile(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    background: "#0E0E10",
    font: {
      // System fonts are needed here so the SVG's text nodes ("Claude Code",
      // "statusline.sh", element labels) actually render. Build runs on
      // Vercel's Linux image / a local dev box — both ship with the fallback
      // families the SVG declares (Georgia/serif, Arial/sans, monospace).
      loadSystemFonts: true,
      defaultFontFamily: "DejaVu Serif",
      serifFamily: "DejaVu Serif",
      sansSerifFamily: "DejaVu Sans",
      monospaceFamily: "DejaVu Sans Mono",
    },
  });
  const png = resvg.render().asPng();
  await writeFile(pngPath, png);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c");
}

if (import.meta.main) {
  await build();
}
