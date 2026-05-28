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
