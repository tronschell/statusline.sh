import {
  GUIDE_OG_IMAGE,
  GUIDE_PAGES,
  STATUSLINE_GUIDE_PATH,
  stripInline,
  type GuidePageData,
} from "./components/Guides/guideContent";

export { STATUSLINE_GUIDE_PATH };

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
export const OG_IMAGE_ORIGIN = "https://statusline-community.zoniixyt.workers.dev";

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
  /** Open Graph object type. Defaults to "website"; community designs use "article". */
  ogType?: string;
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

/** A single `<meta>` tag to upsert into the document head. */
export interface MetaTagDescriptor {
  attribute: "name" | "property";
  key: string;
  content: string;
}

/**
 * Resolve a {@link RouteMeta} into the concrete head state for the page:
 * an absolute self-referencing canonical, an absolute OG/Twitter image, the
 * ordered set of `<meta>` tags, and the route-scoped JSON-LD blocks.
 *
 * Pure (no DOM access) so it can be unit-tested and reused by the runtime
 * `Seo` component. {@link applyHeadMeta} consumes the result to mutate the
 * live document, upserting each tag (never appending duplicates).
 */
export interface ResolvedHeadMeta {
  title: string;
  canonical: string;
  image: string;
  robots: string;
  ogType: string;
  metaTags: MetaTagDescriptor[];
  jsonLd: JsonLdObject[];
}

export function resolveHeadMeta(meta: RouteMeta): ResolvedHeadMeta {
  const canonical = canonicalUrl(meta.canonicalPath);
  const image = absoluteUrl(meta.image ?? DEFAULT_OG_IMAGE);
  const robots = meta.robots ?? "index,follow";
  const ogType = meta.ogType ?? "website";
  const metaTags: MetaTagDescriptor[] = [
    { attribute: "name", key: "description", content: meta.description },
    { attribute: "name", key: "robots", content: robots },
    { attribute: "property", key: "og:site_name", content: SITE_NAME },
    { attribute: "property", key: "og:type", content: ogType },
    { attribute: "property", key: "og:title", content: meta.title },
    { attribute: "property", key: "og:description", content: meta.description },
    { attribute: "property", key: "og:url", content: canonical },
    { attribute: "property", key: "og:image", content: image },
    { attribute: "name", key: "twitter:card", content: "summary_large_image" },
    { attribute: "name", key: "twitter:title", content: meta.title },
    { attribute: "name", key: "twitter:description", content: meta.description },
    { attribute: "name", key: "twitter:image", content: image },
  ];
  return {
    title: meta.title,
    canonical,
    image,
    robots,
    ogType,
    metaTags,
    jsonLd: meta.jsonLd ?? [],
  };
}

/**
 * Apply resolved head metadata to a document. Upserts the title, every
 * `<meta>` tag, and the canonical `<link>` (updating existing nodes in place
 * rather than appending duplicates), then replaces the route-scoped JSON-LD
 * (`script[data-seo="route"]`) with the supplied blocks.
 *
 * Server-rendered JSON-LD (which carries no `data-seo` marker) is deliberately
 * left untouched — it serves crawlers that never execute this JS, while the
 * runtime blocks are the equivalent for client-side SPA navigations.
 *
 * Accepts a `Document` so it stays unit-testable against a DOM stub. No-ops
 * when no document is available (SSR / non-browser).
 */
export function applyHeadMeta(
  meta: RouteMeta,
  doc: Document | undefined = typeof document === "undefined"
    ? undefined
    : document,
): void {
  if (!doc) return;
  const resolved = resolveHeadMeta(meta);
  const head = doc.head;

  doc.title = resolved.title;

  for (const tag of resolved.metaTags) {
    upsertMeta(doc, head, tag);
  }

  upsertCanonical(doc, head, resolved.canonical);
  replaceRouteJsonLd(doc, head, resolved.jsonLd);
}

function upsertMeta(
  doc: Document,
  head: HTMLHeadElement,
  tag: MetaTagDescriptor,
): void {
  let element = head.querySelector<HTMLMetaElement>(
    `meta[${tag.attribute}="${tag.key}"]`,
  );
  if (!element) {
    element = doc.createElement("meta");
    element.setAttribute(tag.attribute, tag.key);
    head.appendChild(element);
  }
  element.setAttribute("content", tag.content);
}

function upsertCanonical(
  doc: Document,
  head: HTMLHeadElement,
  href: string,
): void {
  let element = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = doc.createElement("link");
    element.setAttribute("rel", "canonical");
    head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function replaceRouteJsonLd(
  doc: Document,
  head: HTMLHeadElement,
  items: JsonLdObject[],
): void {
  head
    .querySelectorAll('script[type="application/ld+json"][data-seo="route"]')
    .forEach((element) => element.remove());

  for (const item of items) {
    const script = doc.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.dataset.seo = "route";
    script.textContent = JSON.stringify(item);
    head.appendChild(script);
  }
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

const PILLAR_GUIDE = GUIDE_PAGES.find((page) => page.path === STATUSLINE_GUIDE_PATH)!;

/** Text without the trailing full stop the visual H1 carries. */
function headlineOf(page: GuidePageData): string {
  return page.h1.replace(/\.$/, "");
}

export function buildGuideArticleJsonLd(page: GuidePageData): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: headlineOf(page),
    description: page.metaDescription,
    datePublished: page.published,
    dateModified: page.modified,
    image: absoluteUrl(GUIDE_OG_IMAGE),
    mainEntityOfPage: canonicalUrl(page.path),
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function buildGuideHowToJsonLd(page: GuidePageData = PILLAR_GUIDE): JsonLdObject {
  const howTo = page.howTo;
  if (!howTo) throw new Error(`Guide ${page.path} has no HowTo data`);
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    tool: howTo.tools.map((name) => ({ "@type": "HowToTool", name })),
    step: howTo.steps.map((step) => ({
      "@type": "HowToStep",
      name: step.name,
      text: step.text,
      ...(step.url ? { url: canonicalUrl(step.url) } : {}),
    })),
  };
}

export function buildGuideFaqJsonLd(page: GuidePageData = PILLAR_GUIDE): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripInline(item.a),
      },
    })),
  };
}

function buildGuideRouteMeta(): Record<string, RouteMeta> {
  const entries: Record<string, RouteMeta> = {};
  for (const page of GUIDE_PAGES) {
    const crumbs =
      page.path === STATUSLINE_GUIDE_PATH
        ? [
            { name: "Home", path: "/" },
            { name: page.breadcrumbName, path: page.path },
          ]
        : [
            { name: "Home", path: "/" },
            { name: PILLAR_GUIDE.breadcrumbName, path: PILLAR_GUIDE.path },
            { name: page.breadcrumbName, path: page.path },
          ];
    entries[page.path] = {
      title: page.metaTitle,
      description: page.metaDescription,
      canonicalPath: page.path,
      image: GUIDE_OG_IMAGE,
      ogType: "article",
      jsonLd: [
        buildBreadcrumbJsonLd(crumbs),
        buildGuideArticleJsonLd(page),
        ...(page.howTo ? [buildGuideHowToJsonLd(page)] : []),
        buildGuideFaqJsonLd(page),
      ],
    };
  }
  return entries;
}

/**
 * Programmatic SEO landing pages — one per Claude Code statusline element.
 *
 * Each page targets a long-tail keyword like "claude code statusline with
 * git branch" and links back to the builder. The shared page component
 * lives in `components/Programmatic/`; this module owns the route metadata
 * (title, description, JSON-LD) so it stays in lockstep with build.ts and
 * the static HTML shells.
 */
export interface ProgrammaticRouteMeta {
  path: string;
  title: string;
  description: string;
  h1: string;
}

export const PROGRAMMATIC_ROUTE_META: ProgrammaticRouteMeta[] = [
  {
    path: "/claude-code-statusline-git-branch",
    title: "Claude Code Statusline with Git Branch | statusline.sh",
    description:
      "Add a live git branch indicator to your Claude Code statusline. Visual builder, live preview, one-command install on macOS, Linux, and Windows.",
    h1: "Claude Code statusline with git branch",
  },
  {
    path: "/claude-code-statusline-token-usage",
    title: "Claude Code Statusline with Token Usage | statusline.sh",
    description:
      "Render the Claude Code context window as a progress bar or percentage in your statusline. Threshold colors warn before you hit the cap.",
    h1: "Claude Code statusline with token usage",
  },
  {
    path: "/claude-code-statusline-cost",
    title: "Claude Code Statusline with Cost Display | statusline.sh",
    description:
      "Show the running USD cost of your Claude Code session in the statusline. Configurable precision, color-coded styling, and one-command install.",
    h1: "Claude Code statusline with cost display",
  },
  {
    path: "/claude-code-statusline-model",
    title: "Claude Code Statusline with Model Name | statusline.sh",
    description:
      "Add the active Claude model to your terminal statusline. Visual builder, live preview, and a one-command install that preserves the rest of settings.json.",
    h1: "Claude Code statusline with model name",
  },
  {
    path: "/claude-code-statusline-duration",
    title: "Claude Code Statusline with Session Duration | statusline.sh",
    description:
      "Add elapsed session time to your Claude Code statusline. Choose human-readable or HH:MM:SS formatting and style it with any ANSI color.",
    h1: "Claude Code statusline with session duration",
  },
  {
    path: "/claude-code-statusline-rate-limit",
    title: "Claude Code Statusline with Rate Limit | statusline.sh",
    description:
      "Add the 5h and 7d Claude Code rate limit bars or percentages to your terminal statusline. Two element variants, configurable width, one-command install.",
    h1: "Claude Code statusline with rate limit",
  },
];

function buildProgrammaticRouteMeta(): Record<string, RouteMeta> {
  const entries: Record<string, RouteMeta> = {};
  for (const item of PROGRAMMATIC_ROUTE_META) {
    entries[item.path] = {
      title: item.title,
      description: item.description,
      canonicalPath: item.path,
      jsonLd: [
        buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: item.h1, path: item.path },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: item.h1,
          description: item.description,
          mainEntityOfPage: canonicalUrl(item.path),
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
        },
      ],
    };
  }
  return entries;
}

export const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title:
      "Free Claude Code Statusline Builder — Visual Status Line Maker | statusline.sh",
    description:
      "Build a Claude Code statusline (status line) visually — drag elements, live-preview the terminal output, and install with one command on macOS, Linux, and Windows. Free, no sign-up.",
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
    title: "Claude Code Statusline Examples, Templates & Themes | statusline.sh",
    description:
      "Browse Claude Code statusline examples, templates, and themes. Preview each design in a live terminal, copy-paste install in one command, or fork it into the builder.",
    canonicalPath: "/community",
    jsonLd: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Community", path: "/community" },
      ]),
    ],
  },
  ...buildGuideRouteMeta(),
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
  "/pricing": {
    title: "statusline.sh Pro — Auto-updating Claude Code Statuslines | statusline.sh",
    description:
      "Free builder for everyone. Pro adds permanent auto-updating install links, a private cloud library, team statuslines, featured slots and a verified badge for $5/month.",
    canonicalPath: "/pricing",
  },
  ...Object.fromEntries(
    [
      ["/signin", "Sign in"],
      ["/reset-password", "Reset password"],
      ["/account", "Account"],
      ["/library", "Library"],
      ["/teams", "Teams"],
      ["/join-team", "Join a team"],
      ["/auth/callback", "Signing in"],
    ].map(([path, name]) => [
      path,
      {
        title: `${name} | statusline.sh`,
        description: "Manage your statusline.sh account.",
        canonicalPath: path!,
        robots: "noindex,nofollow",
      } satisfies RouteMeta,
    ]),
  ),
  ...buildProgrammaticRouteMeta(),
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

  if (
    (normalized.startsWith("/u/") || normalized.startsWith("/teams/")) &&
    segments.length === 3
  ) {
    return {
      title: `${safeDecode(segments[2] ?? "")} | ${SITE_NAME}`,
      description: "A statusline.sh creator profile.",
      canonicalPath: normalized,
      // Profiles are thin, user-generated pages; keep them out of the index
      // until there is a sitemap + SSR for them. Team pages are private.
      robots: "noindex,follow",
    };
  }

  // Unknown / dynamic route with no static shell and no SSR backing. Give it
  // a unique, self-referencing canonical and title, but keep it out of the
  // index — it is not a real, content-bearing page, and indexing arbitrary
  // client-only paths would dilute the canonical surface.
  return {
    title: `${SITE_NAME} | Claude Code Statusline Builder`,
    description:
      "Design, preview, share, and install Claude Code statuslines from a browser-based builder.",
    canonicalPath: normalized,
    robots: "noindex,follow",
  };
}

export interface CommunityDetailMetaInput {
  slug: string;
  name: string;
  description?: string | null;
  author_name?: string | null;
  /** Epoch milliseconds; flows into `datePublished` on the JSON-LD. */
  published_at?: number | null;
}

/**
 * Builds RouteMeta for a community design detail page. When called from
 * `metaForPath` (slug only), the title falls back to a slug-derived label and
 * the description is generic. When called from the detail page after the
 * design row has loaded, the real name + author + description flow into the
 * `<title>`, meta description, and BreadcrumbList JSON-LD so search engines
 * and social previews pick up the actual design name + author.
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

  const canonical = canonicalUrl(canonicalPath);
  const image = communityOgImageUrl(input.slug);
  const datePublished = isoDateOrUndefined(input.published_at);
  const authorNode = author.length > 0
    ? { "@type": "Person", name: author }
    : { "@type": "Organization", name: SITE_NAME };

  return {
    title: `${displayName} | Community Statusline | ${SITE_NAME}`,
    description,
    canonicalPath,
    // A shared design is a piece of authored content, not a website — flag it
    // as an article so social cards/crawlers treat it accordingly.
    ogType: "article",
    // Per-design rasterised OG card — the Worker renders SVG → PNG so the
    // share preview shows the actual design name + author rather than the
    // generic default card.
    image,
    // Runtime equivalent of the server-rendered JSON-LD (worker/src/ssr.ts):
    // a SoftwareApplication + CreativeWork view of the design plus the
    // BreadcrumbList. Tagged `data-seo="route"` so it is applied/cleaned on
    // client-side navigation without touching the SSR blocks meant for
    // non-JS crawlers.
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: displayName,
        description,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "macOS, Linux, Windows",
        url: canonical,
        image,
        author: authorNode,
        isAccessibleForFree: true,
        ...(datePublished ? { datePublished } : {}),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: displayName,
        description,
        url: canonical,
        image,
        author: authorNode,
        isAccessibleForFree: true,
        genre: "Claude Code statusline",
        ...(datePublished ? { datePublished } : {}),
        isPartOf: {
          "@type": "CollectionPage",
          name: `${SITE_NAME} community`,
          url: canonicalUrl("/community"),
        },
      },
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Community", path: "/community" },
        { name: displayName, path: canonicalPath },
      ]),
    ],
  };
}

function isoDateOrUndefined(ts?: number | null): string | undefined {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return undefined;
  try {
    return new Date(ts).toISOString();
  } catch {
    return undefined;
  }
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
