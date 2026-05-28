import type { CommunitySitemapEntry, CommunitySeoRow } from "./designs";

export const SITE_ORIGIN = "https://statusline.sh";

// [[seo-routes-mirror]] — Keep in sync with `STATIC_SITEMAP_ROUTES` in
// `build.ts`. The worker can't import from `build.ts` (different build target /
// dependencies), so this list is duplicated and must be updated alongside the
// frontend list whenever a canonical static route is added or removed.
type StaticSitemapRoute = {
  path: string;
  priority: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
};

export const STATIC_SITEMAP_ROUTES: StaticSitemapRoute[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/builder", priority: "0.9", changefreq: "weekly" },
  { path: "/community", priority: "0.8", changefreq: "daily" },
  {
    path: "/how-to-make-a-claude-code-statusline",
    priority: "0.7",
    changefreq: "monthly",
  },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/terms", priority: "0.2", changefreq: "yearly" },
];

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (ch) => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function toLastMod(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

export function communityCanonicalUrl(slug: string): string {
  return `${SITE_ORIGIN}/community/${encodeURIComponent(slug)}`;
}

export function communityDescription(row: Pick<CommunitySeoRow, "name" | "description">): string {
  const description = row.description.trim();
  if (description) return description;
  return `Claude Code statusline design: ${row.name}`;
}

export function renderRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

type SitemapUrl = {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: string | null;
};

export function renderSitemapXml(entries: CommunitySitemapEntry[]): string {
  const staticUrls: SitemapUrl[] = STATIC_SITEMAP_ROUTES.map((route) => ({
    loc:
      route.path === "/"
        ? SITE_ORIGIN
        : `${SITE_ORIGIN}${route.path}`,
    lastmod: null,
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  const communityUrls: SitemapUrl[] = entries.map((entry) => ({
    loc: communityCanonicalUrl(entry.slug),
    lastmod: toLastMod(entry.published_at),
    changefreq: null,
    priority: null,
  }));

  const body = [...staticUrls, ...communityUrls]
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`];
      if (url.lastmod) {
        parts.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
      }
      if (url.changefreq) {
        parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
      }
      if (url.priority) {
        parts.push(`    <priority>${url.priority}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
