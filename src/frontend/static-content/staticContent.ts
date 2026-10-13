/**
 * Build-time crawlable content for the prerendered static HTML shells.
 *
 * `build.ts` injects the HTML returned by `renderStaticRouteBody` INSIDE the
 * SPA's `<div id="root">…</div>` and injects `staticHeadJsonLd` into the
 * document `<head>`. Because the SPA mounts with `createRoot(...).render(...)`
 * (NOT `hydrateRoot`), React discards whatever children already live inside
 * `#root` when it first renders — there is no hydration step, so pre-filled
 * markup cannot produce a hydration mismatch. Crawlers and no-JS clients see
 * this content; users see it for the brief moment before the bundle mounts and
 * replaces it with the live React app.
 *
 * Programmatic element-guide copy is sourced from `programmatic.ts` so the
 * static body stays byte-for-byte in step with what the React SPA renders for
 * the same route (one source of truth, no drift).
 *
 * This module emits plain HTML strings (no React) on purpose: it runs inside
 * the Bun build script, where pulling React's renderer would be unnecessary
 * weight. All interpolated copy is escaped via `escapeHtml`.
 */
import {
  COMMAND_GUIDE_PATH,
  calloutLead,
  GUIDE_PAGES,
  STATUSLINE_GUIDE_PATH,
  figuresOf,
  formatGuideDate,
  guideByPath,
  parseInline,
  type GuideBlock,
  type GuideFigure,
  type GuidePageData,
} from "../components/Guides/guideContent";
import {
  PROGRAMMATIC_PAGES,
  type ProgrammaticPageConfig,
} from "../components/Programmatic/programmatic";
import {
  buildSoftwareApplicationJsonLd,
  type JsonLdObject,
} from "../seo";
import { ADVERTISING_PRIVACY } from "../components/Advertising/advertising";

const STYLE = {
  main: 'background:#0E0E10;color:#E8E8E6;min-height:100vh;font-family:Geist,system-ui,sans-serif;padding:72px 24px;',
  article: "max-width:960px;margin:0 auto;",
  eyebrow:
    "color:#8A8A86;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 24px;",
  h1: "font-family:Instrument Serif,Georgia,serif;font-size:clamp(40px,7vw,80px);line-height:1.03;letter-spacing:-.035em;margin:0;",
  lede: "color:#A8A8A4;font-size:18px;line-height:1.7;max-width:720px;margin:28px 0 0;",
  section:
    "border-top:1px solid rgba(255,255,255,.08);margin-top:48px;padding-top:40px;",
  h2: "font-family:Instrument Serif,Georgia,serif;font-size:34px;line-height:1.1;letter-spacing:-.03em;margin:0;",
  para: "color:#A8A8A4;font-size:15px;line-height:1.7;max-width:760px;margin:18px 0 0;",
  cta: "display:inline-block;background:#E8E8E6;color:#0E0E10;text-decoration:none;border-radius:6px;padding:12px 18px;font-size:14px;font-weight:500;margin-top:28px;",
  list: "color:#A8A8A4;font-size:15px;line-height:1.9;margin:18px 0 0;padding-left:20px;",
  link: "color:#E8E8E6;",
  footer:
    "border-top:1px solid rgba(255,255,255,.08);margin-top:64px;padding-top:32px;color:#8A8A86;font-size:13px;line-height:2;",
} as const;

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

function anchor(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="${STYLE.link}">${escapeHtml(label)}</a>`;
}

interface StaticPageContent {
  eyebrow: string;
  h1: string;
  lede: string;
  sections: Array<{ id?: string; heading: string; paragraphs: string[] }>;
  /** Crawlable internal links rendered as a "Keep exploring" list. */
  related?: Array<{ href: string; label: string }>;
  cta?: { href: string; label: string };
  /** Extra JSON-LD baked into <head> on top of `meta.jsonLd`. */
  extraJsonLd?: JsonLdObject[];
}

/** Every guide page + builder + community, for the footer link graph. */
const FOOTER_LINKS: Array<{ href: string; label: string }> = [
  { href: "/builder", label: "Builder" },
  { href: "/community", label: "Community designs" },
  { href: STATUSLINE_GUIDE_PATH, label: "How to make a statusline" },
  { href: COMMAND_GUIDE_PATH, label: "The /statusline command" },
  ...PROGRAMMATIC_PAGES.map((page) => ({
    href: page.path,
    label: page.h1.replace(/^Claude Code statusline /, "Statusline "),
  })),
];

function renderFooterNav(currentPath: string): string {
  const links = FOOTER_LINKS.filter((link) => link.href !== currentPath)
    .map((link) => anchor(link.href, link.label))
    .join(" &middot; ");
  return `<nav style="${STYLE.footer}" aria-label="Statusline guides">${links}</nav>`;
}

function programmaticContent(
  config: ProgrammaticPageConfig,
): StaticPageContent {
  return {
    eyebrow: config.eyebrow,
    h1: config.h1,
    lede: config.lede,
    sections: config.sections,
    related: config.related,
    cta: { href: config.ctaHref, label: config.ctaLabel },
  };
}

const HOME_CONTENT: StaticPageContent = {
  eyebrow: "Claude Code statusline builder",
  h1: "Design your Claude Code statusline.",
  lede: "statusline.sh is a free, visual builder for the Claude Code status line — the terminal status bar at the bottom of your session. Drag elements onto a canvas, style them with ANSI colors, preview the exact terminal output live, and install with a single command on macOS, Linux, or Windows.",
  sections: [
    {
      heading: "A visual builder for your terminal status bar.",
      paragraphs: [
        "Claude Code renders a status line at the bottom of every session — a terminal status bar that can show the active model, working directory, git branch, context-window usage, running cost, session duration, and Claude Code's rate-limit budgets. statusline.sh turns that bar into something you design visually instead of hand-writing a shell script.",
        "Add elements from a palette, reorder them by dragging, and style each one with bold, italic, dim, and 16-color, 256-color, or truecolor ANSI styling. A live preview re-renders on every change using the same interpreter that drives the installed script, so what you see in the browser is byte-for-byte what your terminal will print.",
      ],
    },
    {
      heading: "Every Claude Code session field, ready to drop in.",
      paragraphs: [
        "On every render, Claude Code pipes the current session to your status line command as JSON on stdin, so the bar can reflect anything in that payload. statusline.sh ships ready-made elements for the fields people reach for most: the model name, the current directory, the active git branch and dirty state, a context-window progress bar or percentage, the session's running USD cost, elapsed duration, and the 5-hour and 7-day rate-limit meters.",
        "Separators, glyphs, and a rotator for cycling content let you shape the layout, while conditional elements hide a segment until it matters. Whether you want a minimalist single-line bar or a dense, context-aware dashboard, you compose it here and carry it to any machine with one install command.",
      ],
    },
    {
      heading: "Install with one command.",
      paragraphs: [
        "When your status line looks right, statusline.sh generates a self-contained bash or PowerShell installer. It structurally merges the statusLine setting into your Claude Code settings.json and writes a timestamped backup first, so every other key — model, permissions, MCP servers — survives untouched. No manual JSON editing, no sign-up, no account.",
        "Not sure where to start? Browse the community gallery for real status line examples, fork any design straight into the builder, or read the full guide on how a Claude Code statusline works.",
      ],
    },
  ],
  cta: { href: "/builder", label: "Open the builder" },
  related: [
    { href: "/builder", label: "Open the builder" },
    { href: "/community", label: "Browse community designs" },
    { href: STATUSLINE_GUIDE_PATH, label: "How to make a statusline" },
    {
      href: "/claude-code-statusline-git-branch",
      label: "Add a git branch element",
    },
    {
      href: "/claude-code-statusline-token-usage",
      label: "Add token-usage tracking",
    },
  ],
};

const BUILDER_CONTENT: StaticPageContent = {
  eyebrow: "Visual builder",
  h1: "Build a Claude Code statusline.",
  lede: "Drag statusline elements onto a canvas, style them with ANSI colors, preview the exact terminal output live, and install with a single command on macOS, Linux, or Windows.",
  sections: [
    {
      heading: "Drag, style, preview.",
      paragraphs: [
        "The builder gives you a palette of Claude Code statusline elements — model, working directory, git branch, context bar and percentage, cost, session duration, rate-limit bars, separators, glyphs, and a rotator for cycling content. Drop them onto the canvas, reorder them, and style each one with bold, italic, dim, and 16-color, 256-color, or truecolor ANSI styling.",
        "A live terminal preview re-renders on every change using the same interpreter that drives the installed bash and PowerShell scripts, so what you see is byte-for-byte what your terminal will print.",
      ],
    },
    {
      heading: "One-command install.",
      paragraphs: [
        "When the design is ready, the builder generates a self-contained installer. It embeds the compiled statusline in a quoted heredoc and structurally merges the statusLine setting into your Claude Code settings.json, writing a timestamped backup first so nothing else in the file is disturbed.",
      ],
    },
  ],
  cta: { href: "/builder", label: "Open the builder" },
  related: [
    {
      href: STATUSLINE_GUIDE_PATH,
      label: "Read the full guide",
    },
    { href: "/community", label: "Browse community designs" },
    {
      href: "/claude-code-statusline-model",
      label: "Add the model name",
    },
    {
      href: "/claude-code-statusline-git-branch",
      label: "Add the git branch",
    },
  ],
  extraJsonLd: [buildSoftwareApplicationJsonLd()],
};

const COMMUNITY_CONTENT: StaticPageContent = {
  eyebrow: "Community gallery",
  h1: "Claude Code statusline examples.",
  lede: "Browse real Claude Code statusline examples, templates, and themes — copy-paste to install in one command, or fork any design straight into the builder to make it your own.",
  sections: [
    {
      heading: "Find a statusline you like.",
      paragraphs: [
        "The community gallery collects Claude Code statusline designs shared by other developers — minimalist single-line bars, context-aware dashboards with usage bars, cost-conscious layouts, and more. Browse them as ready-made templates and themes: each design lists its elements and renders a live preview so you can see exactly what it produces.",
        "Found one you like? Copy-paste install it with the generated command, or fork it into the builder with a click, then tweak the colors, elements, and ordering before installing your own version.",
      ],
    },
  ],
  cta: { href: "/builder", label: "Open the builder" },
  related: [
    { href: "/builder", label: "Open the builder" },
    {
      href: STATUSLINE_GUIDE_PATH,
      label: "How to make a statusline",
    },
    {
      href: "/claude-code-statusline-rate-limit",
      label: "Add rate-limit bars",
    },
    {
      href: "/claude-code-statusline-duration",
      label: "Add session duration",
    },
  ],
};

const PRIVACY_CONTENT: StaticPageContent = {
  eyebrow: "Legal",
  h1: "Privacy policy.",
  lede: "statusline.sh has a free, open-source builder and optional accounts and Pro subscriptions. Publishing to the community gallery is opt-in.",
  sections: [
    {
      heading: "What we store.",
      paragraphs: [
        "Draft designs are stored in your browser. Saving or publishing sends the design to our servers. Private library designs and versions are linked to your account; community designs include the name, author, and description you provide. Team features store membership and a shared design. Claude Code session data is processed locally by the statusline command on your own machine.",
        "Optional accounts store profile and sign-in information, session records, and a password hash when password sign-in is used. Your browser stores a session token to keep you signed in. Lemon Squeezy processes checkout and payment information; our application stores subscription identifiers, status, and renewal or end dates to manage Pro access, rather than card details.",
        "Google Analytics is currently paused: its script is not loaded and activity is not queued for later tracking. Consent controls will be provided before enabling it. If you choose to allow it, Google Analytics can count page views and usage events, set cookies, and process your IP address as described in the [Google privacy policy](https://policies.google.com/privacy).",
        "We use Vercel Web Analytics on pages other than this privacy policy; see [Vercel's description of its analytics data](https://vercel.com/docs/analytics/privacy-policy). The site also uses Google Fonts and Cloudflare Turnstile. You can delete private designs from your library. Community designs have no self-service edit or unpublish controls. For data-removal requests, contact us through our GitHub repository.",
      ],
    },
    ADVERTISING_PRIVACY,
  ],
  related: [
    { href: "/terms", label: "Terms of service" },
    { href: "/builder", label: "Open the builder" },
  ],
};

const TERMS_CONTENT: StaticPageContent = {
  eyebrow: "Legal",
  h1: "Terms of service.",
  lede: "statusline.sh is an open-source Claude Code statusline builder with a free builder and an optional paid Pro subscription. By using it you agree to these terms.",
  sections: [
    {
      heading: "Using the builder.",
      paragraphs: [
        "You may use statusline.sh to design, preview, and install Claude Code statuslines for personal or commercial projects at no cost. Designs you publish to the community gallery may be viewed and forked by other users. The service is provided without warranty of any kind.",
      ],
    },
    {
      heading: "Accounts and Pro subscriptions.",
      paragraphs: [
        "Signing in adds a private library and account-linked community designs. Pro is an optional hosted subscription advertised at $5 USD per month. Lemon Squeezy handles checkout and recurring payments. Review the price, taxes, and billing interval at checkout before purchasing. Pro access is activated automatically when payment is confirmed.",
        "Manage or cancel your subscription from your account. Cancellation keeps Pro available until the end of the paid period. The free builder and generated installers remain available without Pro.",
      ],
    },
  ],
  related: [
    { href: "/privacy", label: "Privacy policy" },
    { href: "/builder", label: "Open the builder" },
  ],
};

/** Resolve the crawlable content for a given canonical route path. */
function contentForPath(path: string): StaticPageContent | undefined {
  if (path === "/") return HOME_CONTENT;
  if (path === "/builder") return BUILDER_CONTENT;
  if (path === "/community") return COMMUNITY_CONTENT;
  if (path === "/privacy") return PRIVACY_CONTENT;
  if (path === "/terms") return TERMS_CONTENT;
  const programmatic = PROGRAMMATIC_PAGES.find((page) => page.path === path);
  if (programmatic) return programmaticContent(programmatic);
  return undefined;
}

/**
 * Returns the crawlable HTML body for a static route, or `""` for routes with
 * no static content (e.g. the home page, whose shell is served from
 * `index.html` directly). The string is injected inside `<div id="root">`.
 */
export function renderStaticRouteBody(canonicalPath: string): string {
  const guide = guideByPath(canonicalPath);
  if (guide) return renderGuideBody(guide);
  const content = contentForPath(canonicalPath);
  if (!content) return "";

  const parts: string[] = [];
  parts.push(`<main style="${STYLE.main}"><article style="${STYLE.article}">`);
  parts.push(`<p style="${STYLE.eyebrow}">${escapeHtml(content.eyebrow)}</p>`);
  parts.push(`<h1 style="${STYLE.h1}">${escapeHtml(content.h1)}</h1>`);
  parts.push(`<p style="${STYLE.lede}">${escapeHtml(content.lede)}</p>`);
  if (content.cta) {
    parts.push(
      `<p><a href="${escapeHtml(content.cta.href)}" style="${STYLE.cta}">${escapeHtml(content.cta.label)}</a></p>`,
    );
  }

  for (const section of content.sections) {
    parts.push(`<section${section.id ? ` id="${escapeHtml(section.id)}"` : ""} style="${STYLE.section}">`);
    parts.push(`<h2 style="${STYLE.h2}">${escapeHtml(section.heading)}</h2>`);
    for (const paragraph of section.paragraphs) {
      parts.push(`<p style="${STYLE.para}">${renderInlineHtml(paragraph)}</p>`);
    }
    parts.push("</section>");
  }

  if (content.related && content.related.length > 0) {
    parts.push(`<section style="${STYLE.section}">`);
    parts.push(`<h2 style="${STYLE.h2}">Keep exploring</h2>`);
    parts.push(`<ul style="${STYLE.list}">`);
    for (const link of content.related) {
      parts.push(`<li>${anchor(link.href, link.label)}</li>`);
    }
    parts.push("</ul></section>");
  }

  parts.push(renderFooterNav(canonicalPath));
  parts.push("</article></main>");
  return parts.join("");
}

/**
 * Extra JSON-LD for a static route, beyond what `meta.jsonLd` already carries.
 * Used to attach `SoftwareApplication` schema to the builder page without
 * touching the shared `seo.ts` metadata.
 */
export function staticHeadJsonLd(canonicalPath: string): JsonLdObject[] {
  const content = contentForPath(canonicalPath);
  return content?.extraJsonLd ?? [];
}


// -----------------------------------------------------------------------------
// Guide pages
// -----------------------------------------------------------------------------

const GUIDE_STYLE = {
  toc: "border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#161618;padding:18px 22px;margin:36px 0 0;",
  tocTitle:
    "color:#8A8A86;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px;",
  tocList: "margin:0;padding-left:20px;color:#A8A8A4;font-size:14px;line-height:2;",
  tldr: "border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#161618;padding:24px 26px;margin:36px 0 0;",
  h3: "font-size:17px;font-weight:500;margin:26px 0 0;color:#E8E8E6;",
  code: "font-family:Geist Mono,ui-monospace,monospace;font-size:.92em;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 5px;color:#E8E8E6;",
  pre: "margin:0;padding:16px;overflow-x:auto;font-family:Geist Mono,ui-monospace,monospace;font-size:12.5px;line-height:1.65;color:#E8E8E6;background:rgba(0,0,0,.3);",
  codeWrap:
    "border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;margin:20px 0 0;",
  codeLabel:
    "padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.06);font-family:Geist Mono,ui-monospace,monospace;font-size:12px;color:#8A8A86;",
  table:
    "width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;color:#A8A8A4;",
  th: "text-align:left;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.12);color:#E8E8E6;font-weight:500;",
  td: "padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top;",
  callout:
    "border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#161618;padding:16px 20px;margin:22px 0 0;color:#A8A8A4;font-size:14px;line-height:1.7;",
  figure: "margin:24px 0 0;",
  img: "display:block;max-width:100%;height:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;",
  figcaption: "color:#8A8A86;font-size:13px;line-height:1.6;margin-top:10px;",
  details: "border-bottom:1px solid rgba(255,255,255,.08);padding:14px 0;",
  summary: "cursor:pointer;font-size:16px;font-weight:500;color:#E8E8E6;",
  meta: "color:#8A8A86;font-size:13px;margin:22px 0 0;",
} as const;

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

/** Inline mini-markup to escaped HTML (mirrors the React `Inline` renderer). */
function renderInlineHtml(text: string): string {
  return parseInline(text)
    .map((tok) => {
      switch (tok.t) {
        case "code":
          return `<code style="${GUIDE_STYLE.code}">${escapeHtml(tok.v)}</code>`;
        case "strong":
          return `<strong style="color:#E8E8E6;font-weight:600;">${escapeHtml(tok.v)}</strong>`;
        case "link":
          return isExternal(tok.href)
            ? `<a href="${escapeHtml(tok.href)}" rel="noopener noreferrer" style="${STYLE.link}">${escapeHtml(tok.v)}</a>`
            : anchor(tok.href, tok.v);
        default:
          return escapeHtml(tok.v);
      }
    })
    .join("");
}

function renderCodeBlockHtml(label: string, code: string): string {
  return (
    `<figure style="${GUIDE_STYLE.codeWrap}">` +
    `<figcaption style="${GUIDE_STYLE.codeLabel}">${escapeHtml(label)}</figcaption>` +
    `<pre style="${GUIDE_STYLE.pre}"><code>${escapeHtml(code)}</code></pre>` +
    `</figure>`
  );
}

function renderFigureHtml(figure: GuideFigure): string {
  const legend = figure.marks?.length
    ? `<ol style="${GUIDE_STYLE.tocList}">${figure.marks
        .map((m) => `<li>${escapeHtml(m.label)}</li>`)
        .join("")}</ol>`
    : "";
  const maxWidth = figure.maxWidth ? `max-width:${figure.maxWidth}px;` : "";
  return (
    `<figure style="${GUIDE_STYLE.figure}${maxWidth}">` +
    `<img src="${escapeHtml(figure.src)}" alt="${escapeHtml(figure.alt)}" width="${figure.width}" height="${figure.height}" loading="lazy" decoding="async" style="${GUIDE_STYLE.img}" />` +
    `<figcaption style="${GUIDE_STYLE.figcaption}">${renderInlineHtml(figure.caption)}${legend}</figcaption>` +
    `</figure>`
  );
}

function renderBlockHtml(block: GuideBlock): string {
  switch (block.kind) {
    case "p":
      return `<p style="${STYLE.para}">${renderInlineHtml(block.text)}</p>`;
    case "code":
      return renderCodeBlockHtml(block.label, block.code);
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag} style="${STYLE.list}">${block.items
        .map((item) => `<li>${renderInlineHtml(item)}</li>`)
        .join("")}</${tag}>`;
    }
    case "steps":
      return `<ol style="margin:0;padding:0;list-style:none;">${block.items
        .map(
          (step) =>
            `<li><h3 style="${GUIDE_STYLE.h3}">${escapeHtml(step.title)}</h3>` +
            `<p style="${STYLE.para}">${renderInlineHtml(step.text)}</p>` +
            (step.code ? renderCodeBlockHtml(step.code.label, step.code.code) : "") +
            (step.figure ? renderFigureHtml(step.figure) : "") +
            `</li>`,
        )
        .join("")}</ol>`;
    case "table": {
      const table =
        `<div style="overflow-x:auto;margin:20px 0 0;"><table style="${GUIDE_STYLE.table}">` +
        (block.caption
          ? `<caption style="text-align:left;color:#8A8A86;font-size:13px;padding-bottom:8px;">${escapeHtml(block.caption)}</caption>`
          : "") +
        `<thead><tr>${block.head
          .map((h) => `<th scope="col" style="${GUIDE_STYLE.th}">${escapeHtml(h)}</th>`)
          .join("")}</tr></thead><tbody>${block.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td style="${GUIDE_STYLE.td}">${renderInlineHtml(cell)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`;
      return block.collapsible
        ? `<details style="${GUIDE_STYLE.details}"><summary style="${GUIDE_STYLE.summary}">${escapeHtml(block.collapsible)}</summary>${table}</details>`
        : table;
    }
    case "callout":
      return `<aside style="${GUIDE_STYLE.callout}"><strong style="color:#E8E8E6;">${escapeHtml(calloutLead(block.title))}</strong> ${renderInlineHtml(block.text)}</aside>`;
    case "figure":
      return renderFigureHtml(block.figure);
    case "links":
      return `<ul style="${STYLE.list}">${block.items
        .map(
          (item) =>
            `<li>${anchor(item.href, item.title)}: ${escapeHtml(item.text)}</li>`,
        )
        .join("")}</ul>`;
    case "widget":
      return block.caption
        ? `<p style="${STYLE.para}">${renderInlineHtml(block.caption)}</p>`
        : "";
  }
}

/**
 * Crawlable body for a guide page. Same copy and structure as the React
 * `GuidePage` (both walk `guideContent.ts`): one H1, H2 per section, H3 per
 * step, `<details>` FAQ. Interactive widgets are omitted (their captions and
 * the tables that accompany them stay).
 */
export function renderGuideBody(page: GuidePageData): string {
  const parts: string[] = [];
  parts.push(`<main style="${STYLE.main}"><article style="${STYLE.article}">`);
  parts.push(
    `<p style="${STYLE.eyebrow}">${escapeHtml(page.eyebrow)}</p>`,
    `<h1 style="${STYLE.h1}">${escapeHtml(page.h1)}</h1>`,
    `<p style="${STYLE.lede}">${renderInlineHtml(page.lede)}</p>`,
    `<p style="${GUIDE_STYLE.meta}">Updated ${escapeHtml(formatGuideDate(page.modified))} &middot; ${page.readingMinutes} min read</p>`,
    `<p><a href="/builder" style="${STYLE.cta}">Open the Claude Code statusline builder</a></p>`,
  );

  parts.push(
    `<aside style="${GUIDE_STYLE.tldr}"><p style="${GUIDE_STYLE.tocTitle}">${escapeHtml(page.tldr.title)}</p><ul style="${STYLE.list}">${page.tldr.items
      .map((item) => `<li>${renderInlineHtml(item)}</li>`)
      .join("")}</ul></aside>`,
  );

  const tocItems = [
    ...page.sections.map((s) => ({ id: s.id, title: s.title })),
    { id: "faq", title: "Frequently asked questions" },
  ];
  parts.push(
    `<nav aria-label="On this page" style="${GUIDE_STYLE.toc}"><p style="${GUIDE_STYLE.tocTitle}">On this page</p><ol style="${GUIDE_STYLE.tocList}">${tocItems
      .map((t) => `<li><a href="#${escapeHtml(t.id)}" style="${STYLE.link}">${escapeHtml(t.title)}</a></li>`)
      .join("")}</ol></nav>`,
  );

  for (const section of page.sections) {
    parts.push(
      `<section id="${escapeHtml(section.id)}" style="${STYLE.section}"><h2 style="${STYLE.h2}">${escapeHtml(section.title)}</h2>`,
      ...section.blocks.map(renderBlockHtml),
      `</section>`,
    );
  }

  parts.push(
    `<section id="faq" style="${STYLE.section}"><h2 style="${STYLE.h2}">Frequently asked questions</h2>`,
    ...page.faqs.map(
      (faq) =>
        `<details style="${GUIDE_STYLE.details}"><summary style="${GUIDE_STYLE.summary}">${escapeHtml(faq.q)}</summary><p style="${STYLE.para}">${renderInlineHtml(faq.a)}</p></details>`,
    ),
    `</section>`,
  );

  parts.push(
    `<section style="${STYLE.section}"><h2 style="${STYLE.h2}">Keep reading</h2><ul style="${STYLE.list}">${page.related
      .map((r) => `<li>${anchor(r.href, r.title)}: ${escapeHtml(r.text)}</li>`)
      .join("")}</ul></section>`,
    `<section style="${STYLE.section}"><h2 style="${STYLE.h2}">${escapeHtml(page.cta.title)}</h2><p style="${STYLE.para}">${escapeHtml(page.cta.text)}</p><p><a href="/builder" style="${STYLE.cta}">${escapeHtml(page.cta.label)}</a></p></section>`,
  );

  parts.push(renderFooterNav(page.path));
  parts.push("</article></main>");
  return parts.join("");
}

/** Exposed for tests: every guide path the static renderer handles. */
export const GUIDE_STATIC_PATHS: string[] = GUIDE_PAGES.map((p) => p.path);
export { figuresOf };
