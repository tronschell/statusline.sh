import tailwind from "bun-plugin-tailwind";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  STATIC_ROUTE_META,
  absoluteUrl,
  canonicalUrl,
  type RouteMeta,
} from "./src/frontend/seo";

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
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/terms", priority: "0.2", changefreq: "yearly" },
];

const STATIC_HTML_ROUTES = ["/builder", "/community", "/privacy", "/terms"];

export function renderRobotsTxt(
  siteUrl = SITE_URL,
  workerSitemapUrl = "https://api.statusline.sh/sitemap.xml",
): string {
  const origin = siteUrl.replace(/\/+$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Sitemap: ${workerSitemapUrl}`,
    "",
  ].join("\n");
}

export function renderStaticSitemapXml(
  routes = STATIC_SITEMAP_ROUTES,
  siteUrl = SITE_URL,
): string {
  const origin = siteUrl.replace(/\/+$/, "");
  const urls = routes
    .map((route) => {
      const loc = `${origin}${route.path === "/" ? "" : route.path}`;
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
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
  return replaceFirst(
    html,
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
    renderJsonLdScripts(meta),
  );
}

function renderJsonLdScripts(meta: RouteMeta): string {
  return (meta.jsonLd ?? [])
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
  await mkdir(outdir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outdir, "robots.txt"), renderRobotsTxt(), "utf8"),
    writeFile(
      path.join(outdir, "sitemap.xml"),
      renderStaticSitemapXml(),
      "utf8",
    ),
    writeFile(
      path.join(outdir, "site.webmanifest"),
      renderWebManifest(),
      "utf8",
    ),
    copyFile(
      path.join(process.cwd(), "src", "static", "og-default.svg"),
      path.join(outdir, "og-default.svg"),
    ),
    copyFile(
      path.join(process.cwd(), "src", "logo.svg"),
      path.join(outdir, "logo.svg"),
    ),
  ]);
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
