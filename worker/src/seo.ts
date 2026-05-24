import type { CommunitySitemapEntry, CommunitySeoRow } from "./designs";

export const SITE_ORIGIN = "https://statusline.sh";

function escapeXml(value: string): string {
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

export function renderSitemapXml(entries: CommunitySitemapEntry[]): string {
  const urls = [
    { loc: SITE_ORIGIN, lastmod: null },
    { loc: `${SITE_ORIGIN}/community`, lastmod: null },
    ...entries.map((entry) => ({
      loc: communityCanonicalUrl(entry.slug),
      lastmod: toLastMod(entry.published_at),
    })),
  ];

  const body = urls
    .map((url) => {
      const lastmod = url.lastmod
        ? `\n    <lastmod>${escapeXml(url.lastmod)}</lastmod>`
        : "";
      return `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
