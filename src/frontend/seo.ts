export const SITE_NAME = "statusline.sh";
export const SITE_URL = "https://statusline.sh";
// Social link previewers (Twitter/X, Slack, Discord, iMessage, LinkedIn,
// Facebook, …) refuse to render SVG `og:image` URLs and just show a blank
// card. The PNG is the actual share asset; the SVG is kept around as a
// fallback for Google's crawler and any pre-existing hotlinks. Build step:
// `writeStaticSeoAssets` in build.ts rasterises the canonical SVG to PNG.
export const DEFAULT_OG_IMAGE = "/og-default.png";
// Origin of the OG image renderer (Worker). Hard-coded to the production
// Worker rather than `WORKER_URL` from lib/config: social crawlers fetch
// these URLs themselves from somewhere remote, so a localhost dev override
// would be useless to them. Per-design OG URLs always need to be absolute.
export const OG_IMAGE_ORIGIN = "https://api.statusline.sh";
export const STATUSLINE_GUIDE_PATH = "/how-to-make-a-claude-code-statusline";

/**
 * Build the per-design OG share image URL. Returns the `.png` Worker
 * endpoint (the `.svg` endpoint still exists for Google + legacy hotlinks
 * but most chat apps refuse to render SVG).
 */
export function communityOgImageUrl(slug: string): string {
  return `${OG_IMAGE_ORIGIN}/og/community/${encodeURIComponent(slug)}.png`;
}

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
    description:
      "A visual builder for Claude Code statuslines, status lines, and terminal status bars.",
    isAccessibleForFree: true,
    featureList: [
      "Visual Claude Code statusline builder",
      "Live terminal preview",
      "Bash and PowerShell installers",
      "Community statusline examples",
    ],
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

const GUIDE_FAQS = [
  {
    question: "Is it called a statusline or a status bar?",
    answer:
      "Claude Code documentation uses statusline. People often describe the same area as a status line or status bar because it sits at the bottom of the terminal.",
  },
  {
    question: "Do I need to edit settings.json manually?",
    answer:
      "No. The builder creates an installer that structurally merges the statusLine setting into your Claude settings while preserving other top-level keys.",
  },
  {
    question: "Does this work on Windows?",
    answer:
      "Yes. The builder can generate a PowerShell installer for Windows and a bash installer for macOS or Linux.",
  },
  {
    question: "Can I customize colors and segments?",
    answer:
      "Yes. You can add, remove, reorder, and style statusline elements visually, including ANSI colors and conditional elements.",
  },
  {
    question: "Can I share my Claude Code statusline?",
    answer:
      "Yes. You can publish a design to the community gallery and other users can preview or fork it into their own builder.",
  },
];

export function buildGuideHowToJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to make a Claude Code status line",
    description:
      "Create, customize, preview, and install a Claude Code statusline or terminal status bar.",
    totalTime: "PT5M",
    tool: [
      { "@type": "HowToTool", name: "Claude Code" },
      { "@type": "HowToTool", name: SITE_NAME },
    ],
    step: [
      {
        "@type": "HowToStep",
        name: "Open the builder",
        text: "Open the statusline.sh builder and choose whether to start from scratch or use a template.",
        url: canonicalUrl("/builder"),
      },
      {
        "@type": "HowToStep",
        name: "Add statusline elements",
        text: "Add Claude Code session fields such as model, directory, git branch, context usage, cost, and session duration.",
      },
      {
        "@type": "HowToStep",
        name: "Preview the terminal output",
        text: "Use the live preview to check ANSI styling and layout before changing local Claude settings.",
      },
      {
        "@type": "HowToStep",
        name: "Install the generated script",
        text: "Run the generated bash or PowerShell installer to merge the statusline command into settings.json.",
      },
    ],
  };
}

export function buildGuideFaqJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GUIDE_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
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
  [STATUSLINE_GUIDE_PATH]: {
    title: "How to Make a Claude Code Status Line | statusline.sh",
    description:
      "Learn how to build, customize, preview, and install a Claude Code statusline or status bar with statusline.sh.",
    canonicalPath: STATUSLINE_GUIDE_PATH,
    jsonLd: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Claude Code Statusline Guide", path: STATUSLINE_GUIDE_PATH },
      ]),
      buildGuideHowToJsonLd(),
      buildGuideFaqJsonLd(),
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
    const label = titleFromSlug(slug);
    return buildCommunityDetailMeta({ slug, name: label });
  }

  return {
    title: `${SITE_NAME} | Claude Code Statusline Builder`,
    description:
      "Design, preview, share, and install Claude Code statuslines from a browser-based builder.",
    canonicalPath: normalized,
  };
}

export interface CommunityDetailMetaInput {
  slug: string;
  name: string;
  description?: string | null;
  author_name?: string | null;
}

/**
 * Builds RouteMeta for a community design detail page. When called from
 * `metaForPath` (slug only), the title falls back to a slug-derived label and
 * the description is generic. When called from the detail page after the
 * design row has loaded, the real name + author + description flow into the
 * `<title>`, meta description, and BreadcrumbList JSON-LD.
 */
export function buildCommunityDetailMeta(
  input: CommunityDetailMetaInput,
): RouteMeta {
  const canonicalPath = `/community/${encodeURIComponent(input.slug)}`;
  const trimmedName = input.name.trim();
  const displayName = trimmedName.length > 0 ? trimmedName : "Community Design";
  const author = (input.author_name ?? "").trim();
  const rawDescription = (input.description ?? "").trim();
  const description = rawDescription.length > 0
    ? rawDescription
    : author.length > 0
      ? `A Claude Code statusline design by ${author}. Preview and fork it into your own builder on ${SITE_NAME}.`
      : `A community-published Claude Code statusline design. Preview and fork it into your own builder on ${SITE_NAME}.`;

  return {
    title: `${displayName} | Community Statusline | ${SITE_NAME}`,
    description,
    canonicalPath,
    // Per-design rasterised OG card — the Worker renders SVG → PNG so the
    // share preview shows the actual design name + author rather than the
    // generic default card.
    image: communityOgImageUrl(input.slug),
    jsonLd: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Community", path: "/community" },
        { name: displayName, path: canonicalPath },
      ]),
    ],
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
