export const SITE_NAME = "statusline.sh";
export const SITE_URL = "https://statusline.sh";
export const DEFAULT_OG_IMAGE = "/og-default.svg";

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
    title: "Claude Code Statusline Builder | statusline.sh",
    description:
      "Build a custom Claude Code statusline visually. Drag, preview, share, and install with one terminal command.",
    canonicalPath: "/",
    jsonLd: [buildWebSiteJsonLd(), buildSoftwareApplicationJsonLd()],
  },
  "/builder": {
    title: "Build a Claude Code Statusline | statusline.sh",
    description:
      "Create a custom Claude Code statusline with drag-and-drop elements, live preview, ANSI styling, and cross-platform install commands.",
    canonicalPath: "/builder",
  },
  "/community": {
    title: "Claude Code Statusline Examples | statusline.sh Community",
    description:
      "Browse community-made Claude Code statusline examples, preview them, and fork any design into your own builder.",
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
      "Privacy policy for statusline.sh, the open-source Claude Code statusline builder.",
    canonicalPath: "/privacy",
  },
  "/terms": {
    title: "Terms of Service | statusline.sh",
    description:
      "Terms of service for statusline.sh, the open-source Claude Code statusline builder.",
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
