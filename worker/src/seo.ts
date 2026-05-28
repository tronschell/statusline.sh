import type { CommunitySitemapEntry, CommunitySeoRow } from "./designs";

export const SITE_ORIGIN = "https://statusline.sh";

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

// Bump this manually when any of the static pages (homepage, builder, community
// list, guide, privacy, terms) meaningfully change. Keeping it deterministic
// avoids ticking lastmod on every deploy, which search engines interpret as
// noisy churn.
export const STATIC_ROUTES_LASTMOD = "2026-05-27T00:00:00.000Z";

const STATIC_ROUTE_PATHS = [
  "",
  "/builder",
  "/community",
  "/how-to-make-a-claude-code-statusline",
  "/privacy",
  "/terms",
] as const;

export function renderSitemapXml(entries: CommunitySitemapEntry[]): string {
  const urls: { loc: string; lastmod: string }[] = [
    ...STATIC_ROUTE_PATHS.map((path) => ({
      loc: `${SITE_ORIGIN}${path}`,
      lastmod: STATIC_ROUTES_LASTMOD,
    })),
    ...entries.map((entry) => ({
      loc: communityCanonicalUrl(entry.slug),
      lastmod: toLastMod(entry.published_at),
    })),
  ];

  const body = urls
    .map(
      (url) =>
        `  <url>\n    <loc>${escapeXml(url.loc)}</loc>\n    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
