/**
 * Server-rendered HTML for `/community/:slug` detail pages. This is the
 * canonical SEO surface for individual community designs — Vercel rewrites
 * the user-facing URL to `/ssr/community/:slug` on the Worker, which returns
 * a hydration-ready HTML document. Once the SPA bundle loads, React mounts
 * over the same `<div id="root">` node and the page becomes interactive.
 *
 * Why we render here (and not in the SPA shell):
 *  - Googlebot and most chat-app crawlers do not execute JS reliably, so an
 *    empty `<div id="root">` produces blank previews and weak ranking.
 *  - The Worker already owns design data (D1) + the interpret backend, so
 *    we can render the exact same ANSI byte-stream the user will install.
 *
 * Bundle hygiene:
 *  - We keep the HTML template inline (rather than fetching dist/index.html)
 *    so the Worker has no runtime dependency on the SPA build artefacts and
 *    so the bundle stays well under the Workers 1MB compressed limit.
 *  - The ANSI → HTML converter is `parseAnsi` from @statusline/shared, which
 *    is already pulled in by the install handler — no new code on the wire.
 */

import type { Design } from "@statusline/shared/types";
import {
  parseAnsi,
  escapeHtml,
  segmentToStyle,
  stripAnsi,
} from "@statusline/shared/ansi";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { isCommunityIndexable, type DesignRow } from "./designs";
import { communityCanonicalUrl, communityDescription, SITE_ORIGIN } from "./seo";

const WORKER_ORIGIN = "https://statusline-community.zoniixyt.workers.dev";

/** A sibling community design surfaced as a crawlable internal link. */
export interface RelatedDesign {
  slug: string;
  name: string;
  author_name: string;
}

interface SsrInput {
  row: DesignRow;
  /**
   * A small set of OTHER community designs to link to for internal-link
   * crawlability. Optional and order-preserving; if empty/omitted the related
   * block is simply not rendered (the page still links back to /community
   * and /builder), so the page degrades safely when no siblings exist.
   */
  related?: RelatedDesign[];
}

/**
 * Convert an ANSI string into a sequence of `<span>`s with inline styles.
 * Uses the shared parser so colors/bold/italic behave identically to the
 * browser-side `<AnsiText>` component.
 */
function ansiToHtml(ansi: string): string {
  const segments = parseAnsi(ansi);
  if (segments.length === 0) return "";
  return segments
    .map((seg) => {
      const text = escapeHtml(seg.text);
      const style = segmentToStyle(seg);
      if (!style) return text;
      return `<span style="${escapeHtml(style)}">${text}</span>`;
    })
    .join("");
}

/**
 * Safe ANSI render — never let a bad design crash the whole SSR response.
 * Falls back to the design name (or empty string) so we still return
 * crawlable HTML even if interpret throws.
 */
function safeRenderAnsi(design: Design): string {
  try {
    return renderToAnsi(design, DEFAULT_MOCK_STDIN);
  } catch (err) {
    console.warn("ssr: renderToAnsi failed", err);
    return design?.name ?? "";
  }
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function escapeJsonForScript(value: string): string {
  // Prevent `</script>` injection inside JSON-LD payloads.
  return value.replace(/</g, "\\u003c");
}

function buildJsonLd(row: DesignRow, ogImage: string): string {
  const canonical = communityCanonicalUrl(row.slug);
  const description = communityDescription({
    name: row.name,
    description: row.description,
  });
  const datePublished = new Date(row.published_at).toISOString();
  const author = {
    "@type": "Person",
    name: row.author_name,
  };
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: row.name,
    description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    url: canonical,
    image: ogImage,
    author,
    datePublished,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
  // A CreativeWork view of the same artefact — gives crawlers a content-type
  // (vs. application-type) signal for the design itself, with the OG image and
  // publish date that the page already references.
  const creativeWork = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: row.name,
    description,
    url: canonical,
    image: ogImage,
    author,
    datePublished,
    isAccessibleForFree: true,
    genre: "Claude Code statusline",
    isPartOf: {
      "@type": "CollectionPage",
      name: "statusline.sh community",
      url: `${SITE_ORIGIN}/community`,
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_ORIGIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Community",
        item: `${SITE_ORIGIN}/community`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: row.name,
        item: canonical,
      },
    ],
  };
  return [
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(software))}</script>`,
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(creativeWork))}</script>`,
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(breadcrumbs))}</script>`,
  ].join("\n    ");
}

/**
 * Server-rendered list of internal links to sibling community designs plus the
 * canonical back-links to /community and /builder. Real `<a href>` anchors so
 * Googlebot can crawl the community graph without executing JS. Returns an
 * empty related sub-list (but always the back-links) when no siblings exist.
 */
function buildRelatedLinks(related: RelatedDesign[]): string {
  const items = related
    .map(
      (r) =>
        `<li><a href="${escapeAttr(
          communityCanonicalUrl(r.slug),
        )}">${escapeHtml(r.name)} <span class="ssr-related-by">by ${escapeHtml(
          r.author_name,
        )}</span></a></li>`,
    )
    .join("\n          ");
  const relatedBlock = related.length
    ? `<nav class="ssr-related" aria-label="Related community statuslines">
        <h2 class="ssr-related-heading">Related statuslines</h2>
        <ul class="ssr-related-list">
          ${items}
        </ul>
      </nav>`
    : "";
  return relatedBlock;
}

export function renderCommunityDetailHtml({ row, related = [] }: SsrInput): string {
  const elementCount = Array.isArray(row.design?.elements) ? row.design.elements.length : 0;
  const indexable = isCommunityIndexable(row, elementCount);
  const canonical = communityCanonicalUrl(row.slug);
  const description = communityDescription({
    name: row.name,
    description: row.description,
  });
  const title = `${row.name} — Claude Code Statusline | statusline.sh`;
  // Social link previewers (Twitter/X, Slack, Discord, iMessage, LinkedIn,
  // Facebook) refuse to render SVG `og:image` URLs, so we point at the PNG
  // variant — same slug, rasterised on demand by the /og/community/:slug.png
  // handler. The .svg route still exists for crawlers/hotlinks.
  const ogImage = `${WORKER_ORIGIN}/og/community/${encodeURIComponent(row.slug)}.png`;
  const ogImageAlt = `${row.name} — Claude Code statusline by ${row.author_name}`;
  const ansi = elementCount ? safeRenderAnsi(row.design) : "";
  const previewHtml = ansi ? ansiToHtml(ansi) : escapeHtml(row.name);
  const plainPreview = stripAnsi(ansi);
  const installCmd = `curl -fsSL ${WORKER_ORIGIN}/i/${row.id}.sh | bash`;
  const installCmdPs = `irm ${WORKER_ORIGIN}/i/${row.id}.ps1 | iex`;
  const jsonLd = indexable ? buildJsonLd(row, ogImage) : "";
  const relatedLinks = buildRelatedLinks(related);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="robots" content="${indexable ? "index,follow" : "noindex,follow"}" />
    <meta name="theme-color" content="#0E0E10" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <link rel="manifest" href="${escapeAttr(`${SITE_ORIGIN}/site.webmanifest`)}" />
    <link rel="icon" type="image/svg+xml" href="${escapeAttr(`${SITE_ORIGIN}/logo.svg`)}" />
    <meta property="og:site_name" content="statusline.sh" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeAttr(ogImageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(ogImage)}" />
    <meta name="twitter:image:alt" content="${escapeAttr(ogImageAlt)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-JDKLE4R2EV"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-JDKLE4R2EV', { send_page_view: false });
    </script>
    ${jsonLd}
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #0E0E10;
        color: #E8E8E6;
        font-family: Geist, system-ui, -apple-system, sans-serif;
      }
      .ssr-main {
        max-width: 960px;
        margin: 0 auto;
        padding: 72px 24px 96px;
      }
      .ssr-eyebrow {
        color: #8A8A86;
        font-size: 12px;
        letter-spacing: .14em;
        text-transform: uppercase;
        margin: 0 0 16px;
      }
      .ssr-title {
        font-family: "Instrument Serif", Georgia, serif;
        font-size: clamp(40px, 6vw, 64px);
        line-height: 1.05;
        letter-spacing: -.035em;
        margin: 0;
      }
      .ssr-byline {
        color: #A8A8A4;
        font-size: 15px;
        margin: 16px 0 0;
      }
      .ssr-description {
        color: #C8C8C4;
        font-size: 17px;
        line-height: 1.6;
        margin: 28px 0 0;
        max-width: 720px;
      }
      .ssr-preview {
        margin: 40px 0 0;
        padding: 20px 24px;
        background: #0A0A0C;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px;
        font-family: "Geist Mono", SFMono-Regular, Consolas, monospace;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-x: auto;
      }
      .ssr-install {
        margin: 32px 0 0;
        padding: 16px 18px;
        background: #16161A;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 8px;
        font-family: "Geist Mono", SFMono-Regular, Consolas, monospace;
        font-size: 13px;
        color: #E8E8E6;
        overflow-x: auto;
      }
      .ssr-install-label {
        color: #8A8A86;
        font-size: 11px;
        letter-spacing: .14em;
        text-transform: uppercase;
        margin: 0 0 8px;
        font-family: Geist, system-ui, sans-serif;
      }
      .ssr-actions {
        display: flex;
        gap: 12px;
        margin: 36px 0 0;
        flex-wrap: wrap;
      }
      .ssr-actions a {
        display: inline-block;
        padding: 10px 16px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 14px;
        border: 1px solid rgba(255,255,255,.12);
        color: #E8E8E6;
      }
      .ssr-actions a.primary {
        background: #E8E8E6;
        color: #0E0E10;
        border-color: #E8E8E6;
      }
      .ssr-related {
        margin: 56px 0 0;
        padding: 28px 0 0;
        border-top: 1px solid rgba(255,255,255,.08);
      }
      .ssr-related-heading {
        color: #8A8A86;
        font-size: 12px;
        letter-spacing: .14em;
        text-transform: uppercase;
        margin: 0 0 16px;
        font-weight: 500;
      }
      .ssr-related-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .ssr-related-list a {
        color: #E8E8E6;
        text-decoration: none;
        font-size: 15px;
      }
      .ssr-related-list a:hover {
        text-decoration: underline;
      }
      .ssr-related-by {
        color: #8A8A86;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div id="root"><main class="ssr-main" data-ssr="community">
      <p class="ssr-eyebrow">Community statusline</p>
      <h1 class="ssr-title">${escapeHtml(row.name)}</h1>
      <p class="ssr-byline">by ${escapeHtml(row.author_name)}</p>
      ${row.description ? `<p class="ssr-description">${escapeHtml(row.description)}</p>` : ""}
      <pre class="ssr-preview" aria-label="Statusline preview"><code aria-label="${escapeAttr(plainPreview)}">${previewHtml}</code></pre>
      <div class="ssr-install">
        <p class="ssr-install-label">Install (bash)</p>
        <code>${escapeHtml(installCmd)}</code>
      </div>
      <div class="ssr-install">
        <p class="ssr-install-label">Install (PowerShell)</p>
        <code>${escapeHtml(installCmdPs)}</code>
      </div>
      <nav class="ssr-actions">
        <a class="primary" href="/builder?fork=${escapeAttr(encodeURIComponent(row.slug))}">Fork in builder</a>
        <a href="/builder">Open builder</a>
        <a href="/community">Browse community</a>
      </nav>
      ${relatedLinks}
    </main></div>
    <!--
      The SSR page is intentionally a content-only document. The SPA bundle
      filename is content-hashed by Bun.build, so we can't reference it from
      the Worker without coupling to a build artefact. Anchor links above use
      real hrefs, so any navigation lands on the SPA shells (/builder.html,
      /community.html) which hydrate normally. The <div id="root"> wrapper is
      preserved so a future hydration step (e.g. injecting the hashed bundle
      via a Vercel build-step that writes a constant into the Worker) can
      mount React over this exact content with no DOM mismatch.
    -->
  </body>
</html>
`;
}

// ===========================================================================
// Community LIST page (`/community`)
// ===========================================================================
//
// The user-facing `/community` list is rewritten to `/ssr/community` on the
// Worker (see vercel.json). Rendering it here — rather than shipping a static
// SPA shell whose cards are painted client-side — is what gives crawlers a real
// `<ul>` of `<a href>` anchors into every design detail page. Without this, the
// detail pages are orphaned ("Discovered, currently not indexed") because no
// server-rendered surface links to them.

const LIST_TITLE =
  "Claude Code Statusline Examples, Templates & Themes | statusline.sh";
const LIST_DESCRIPTION =
  "Browse a gallery of Claude Code statusline examples, templates and themes. " +
  "Preview any community design, fork it in the builder, and install it with a single command.";
const LIST_CANONICAL = `${SITE_ORIGIN}/community`;
// Static 1200×630 PNG built by build.ts and served by Vercel. Social previewers
// refuse SVG, so we reuse the site's default PNG OG asset for the list page.
const LIST_OG_IMAGE = `${SITE_ORIGIN}/og-default.png`;

interface SsrListInput {
  /**
   * The community designs to render as crawlable internal links. Order is
   * preserved. May be empty — the page still renders as a valid document (used
   * for the graceful-degradation path when D1/listCommunity fails).
   */
  designs: RelatedDesign[];
}

/**
 * Real `<a href>` anchors to every listed design — the crawlable link graph
 * that connects `/community` to each `/community/:slug` detail page. Uses the
 * absolute canonical URL for each design so the link target is unambiguous
 * regardless of where the SSR HTML is fetched from.
 */
function buildCommunityListItems(designs: RelatedDesign[]): string {
  return designs
    .map(
      (d) =>
        `<li class="ssr-list-item"><a href="${escapeAttr(
          communityCanonicalUrl(d.slug),
        )}">${escapeHtml(d.name)} <span class="ssr-list-by">by ${escapeHtml(
          d.author_name,
        )}</span></a></li>`,
    )
    .join("\n          ");
}

function buildListJsonLd(designs: RelatedDesign[]): string {
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Claude Code statusline community gallery",
    description: LIST_DESCRIPTION,
    url: LIST_CANONICAL,
    isPartOf: {
      "@type": "WebSite",
      name: "statusline.sh",
      url: `${SITE_ORIGIN}/`,
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_ORIGIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Community",
        item: LIST_CANONICAL,
      },
    ],
  };
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: designs.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.name,
      url: communityCanonicalUrl(d.slug),
    })),
  };
  return [
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(collection))}</script>`,
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(breadcrumbs))}</script>`,
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(itemList))}</script>`,
  ].join("\n    ");
}

export function renderCommunityListHtml({ designs }: SsrListInput): string {
  const count = designs.length;
  const listItems = buildCommunityListItems(designs);
  const jsonLd = buildListJsonLd(designs);
  const listBlock = count
    ? `<ul class="ssr-list">
          ${listItems}
        </ul>`
    : `<p class="ssr-empty">No community statuslines have been published yet. <a href="/builder">Design one in the builder</a>.</p>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(LIST_TITLE)}</title>
    <meta name="description" content="${escapeAttr(LIST_DESCRIPTION)}" />
    <meta name="robots" content="index,follow" />
    <meta name="theme-color" content="#0E0E10" />
    <link rel="canonical" href="${escapeAttr(LIST_CANONICAL)}" />
    <link rel="manifest" href="${escapeAttr(`${SITE_ORIGIN}/site.webmanifest`)}" />
    <link rel="icon" type="image/svg+xml" href="${escapeAttr(`${SITE_ORIGIN}/logo.svg`)}" />
    <meta property="og:site_name" content="statusline.sh" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(LIST_TITLE)}" />
    <meta property="og:description" content="${escapeAttr(LIST_DESCRIPTION)}" />
    <meta property="og:url" content="${escapeAttr(LIST_CANONICAL)}" />
    <meta property="og:image" content="${escapeAttr(LIST_OG_IMAGE)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="statusline.sh — Claude Code statusline community gallery" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(LIST_TITLE)}" />
    <meta name="twitter:description" content="${escapeAttr(LIST_DESCRIPTION)}" />
    <meta name="twitter:image" content="${escapeAttr(LIST_OG_IMAGE)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-JDKLE4R2EV"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-JDKLE4R2EV', { send_page_view: false });
    </script>
    ${jsonLd}
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #0E0E10;
        color: #E8E8E6;
        font-family: Geist, system-ui, -apple-system, sans-serif;
      }
      .ssr-main {
        max-width: 960px;
        margin: 0 auto;
        padding: 72px 24px 96px;
      }
      .ssr-eyebrow {
        color: #8A8A86;
        font-size: 12px;
        letter-spacing: .14em;
        text-transform: uppercase;
        margin: 0 0 16px;
      }
      .ssr-title {
        font-family: "Instrument Serif", Georgia, serif;
        font-size: clamp(40px, 6vw, 64px);
        line-height: 1.05;
        letter-spacing: -.035em;
        margin: 0;
      }
      .ssr-description {
        color: #C8C8C4;
        font-size: 17px;
        line-height: 1.6;
        margin: 28px 0 0;
        max-width: 720px;
      }
      .ssr-list {
        list-style: none;
        margin: 48px 0 0;
        padding: 0;
        display: grid;
        gap: 10px;
      }
      .ssr-list-item a {
        display: inline-block;
        color: #E8E8E6;
        text-decoration: none;
        font-size: 16px;
      }
      .ssr-list-item a:hover {
        text-decoration: underline;
      }
      .ssr-list-by {
        color: #8A8A86;
        font-size: 13px;
      }
      .ssr-empty {
        color: #C8C8C4;
        font-size: 16px;
        margin: 40px 0 0;
      }
      .ssr-empty a { color: #E8E8E6; }
      .ssr-actions {
        display: flex;
        gap: 12px;
        margin: 48px 0 0;
        flex-wrap: wrap;
      }
      .ssr-actions a {
        display: inline-block;
        padding: 10px 16px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 14px;
        border: 1px solid rgba(255,255,255,.12);
        color: #E8E8E6;
      }
      .ssr-actions a.primary {
        background: #E8E8E6;
        color: #0E0E10;
        border-color: #E8E8E6;
      }
    </style>
  </head>
  <body>
    <div id="root"><main class="ssr-main" data-ssr="community-list">
      <p class="ssr-eyebrow">Community gallery</p>
      <h1 class="ssr-title">Claude Code statusline examples, templates &amp; themes</h1>
      <p class="ssr-description">${escapeHtml(LIST_DESCRIPTION)}</p>
      <nav aria-label="Community statusline designs">
        ${listBlock}
      </nav>
      <nav class="ssr-actions">
        <a class="primary" href="/builder">Open builder</a>
        <a href="/">statusline.sh home</a>
      </nav>
    </main></div>
    <!--
      Content-only SSR document — see renderCommunityDetailHtml for why the SPA
      bundle is not referenced here. The <div id="root"> wrapper and real anchor
      hrefs let a future hydration step mount React over this exact content.
    -->
  </body>
</html>
`;
}
