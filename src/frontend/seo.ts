export const SITE_NAME = "statusline.sh";
export const SITE_URL = "https://statusline.sh";
export const DEFAULT_OG_IMAGE = "/og.png";

export interface RouteMeta {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string;
  robots?: string;
  jsonLd?: JsonLdObject[];
}

export type JsonLdObject = Record<string, unknown>;

export function canonicalUrl(path = "/"): string {
  const normalized = normalizePath(path);
  return new URL(normalized, SITE_URL).toString();
}

export function absoluteUrl(pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, SITE_URL).toString();
  }
}

export function normalizePath(path: string): string {
  const rawPath = path.split(/[?#]/)[0] ?? "/";
  const withSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const trimmed = withSlash.replace(/\/+$|\s+$/g, "") || "/";
  return trimmed === "" ? "/" : trimmed;
}

export function buildWebSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: canonicalUrl("/"),
    description:
      "Design, preview, share, and install Claude Code statuslines from a browser-based builder.",
  };
}

export function buildSoftwareApplicationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    url: canonicalUrl("/"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "statusline.sh | Claude Code Statusline Builder",
    description:
      "Design your Claude Code statusline with a drag-and-drop builder. Preview, share, and install it with one terminal command.",
    canonicalPath: "/",
    jsonLd: [buildWebSiteJsonLd(), buildSoftwareApplicationJsonLd()],
  },
  "/builder": {
    title: "Builder | statusline.sh",
    description:
      "Build and preview a custom Claude Code statusline, then save, publish, or install it from the browser.",
    canonicalPath: "/builder",
  },
  "/community": {
    title: "Community Statuslines | statusline.sh",
    description:
      "Browse Claude Code statusline designs published by the community, then preview or fork one into your own builder.",
    canonicalPath: "/community",
    jsonLd: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Community", path: "/community" },
      ]),
    ],
  },
  "/privacy": {
    title: "Privacy Policy | statusline.sh",
    description:
      "Privacy policy for statusline.sh, including what is stored locally and what is stored when you save or publish a design.",
    canonicalPath: "/privacy",
  },
  "/terms": {
    title: "Terms of Service | statusline.sh",
    description:
      "Terms of service for using statusline.sh to design, save, publish, fork, and install Claude Code statuslines.",
    canonicalPath: "/terms",
  },
};

export function metaForPath(path: string): RouteMeta {
  const normalized = normalizePath(path);
  const staticMeta = STATIC_ROUTE_META[normalized];
  if (staticMeta) return staticMeta;

  const segments = normalized.split("/");
  if (normalized.startsWith("/community/") && segments.length === 3) {
    const slug = safeDecode(segments[2] ?? "");
    const canonicalPath = `/community/${encodeURIComponent(slug)}`;
    const label = titleFromSlug(slug);
    return {
      title: `${label} | Community Statusline | ${SITE_NAME}`,
      description:
        "Preview and fork this community-published Claude Code statusline design on statusline.sh.",
      canonicalPath,
      jsonLd: [
        buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Community", path: "/community" },
          { name: label, path: canonicalPath },
        ]),
      ],
    };
  }

  return {
    title: `${SITE_NAME} | Claude Code Statusline Builder`,
    description:
      "Design, preview, share, and install Claude Code statuslines from a browser-based builder.",
    canonicalPath: normalized,
  };
}

function titleFromSlug(slug: string): string {
  const decoded = slug.replace(/[-_]+/g, " ").trim();
  if (!decoded) return "Community Design";
  return decoded.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
