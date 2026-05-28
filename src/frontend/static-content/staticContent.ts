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
  PROGRAMMATIC_PAGES,
  type ProgrammaticPageConfig,
} from "../components/Programmatic/programmatic";
import {
  STATUSLINE_GUIDE_PATH,
  buildSoftwareApplicationJsonLd,
  type JsonLdObject,
} from "../seo";

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
  sections: Array<{ heading: string; paragraphs: string[] }>;
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

const GUIDE_CONTENT: StaticPageContent = {
  eyebrow: "Claude Code guide",
  h1: "How to make a Claude Code status line.",
  lede: "Claude Code calls the bottom bar a statusline. Many people search for it as a status line or status bar. statusline.sh helps you build, customize, preview, and install one visually — no shell scripting required.",
  sections: [
    {
      heading: "What is a Claude Code statusline?",
      paragraphs: [
        "A Claude Code statusline is an executable command configured under the statusLine key in settings.json. On every render Claude Code pipes the current session as JSON on stdin, and your command prints styled terminal text to stdout. That output becomes the bar at the bottom of the Claude Code terminal.",
        "Because it is just a command, a statusline can show anything derivable from the session: the active model, working directory, git branch, context-window usage, running cost, session duration, and Claude Code's rate-limit budgets.",
      ],
    },
    {
      heading: "Build it visually.",
      paragraphs: [
        "Use the builder to add model, directory, git branch, context, cost, duration, separators, glyphs, and ANSI styling. A live preview renders the exact bytes your terminal will show, using the same interpreter that powers the installed script.",
        "When the design looks right, install it with a generated bash or PowerShell command. The installer structurally merges the statusLine setting into settings.json and writes a timestamped backup first, so every other key — model, permissions, MCP servers — survives untouched.",
      ],
    },
    {
      heading: "Frequently asked",
      paragraphs: [
        "Is it called a statusline or a status bar? Claude Code documentation uses statusline; people often describe the same area as a status line or status bar. Does it work on Windows? Yes — the builder generates a PowerShell installer for Windows and a bash installer for macOS or Linux. Can you share a design? Yes — publish it to the community gallery and others can preview or fork it.",
      ],
    },
  ],
  cta: { href: "/builder", label: "Open the builder" },
  related: [
    { href: "/builder", label: "Open the builder" },
    { href: "/community", label: "Browse community designs" },
    {
      href: "/claude-code-statusline-git-branch",
      label: "Add a git branch element",
    },
    {
      href: "/claude-code-statusline-token-usage",
      label: "Add token-usage tracking",
    },
    { href: "/claude-code-statusline-cost", label: "Add a cost display" },
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
  lede: "Browse statuslines published by the community, preview each one in a live terminal, and fork any design straight into the builder to make it your own.",
  sections: [
    {
      heading: "Find a statusline you like.",
      paragraphs: [
        "The community gallery collects Claude Code statusline designs shared by other developers — minimalist single-line bars, context-aware dashboards with usage bars, cost-conscious layouts, and more. Each design lists its elements and renders a live preview so you can see exactly what it produces.",
        "Found one you like? Fork it into the builder with a click, then tweak the colors, elements, and ordering before installing your own version.",
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
  lede: "statusline.sh is an open-source Claude Code statusline builder. Your designs are stored in your browser; publishing to the community gallery is opt-in.",
  sections: [
    {
      heading: "What we store.",
      paragraphs: [
        "Draft statusline designs are persisted locally in your browser and never leave your device unless you choose to publish them. Publishing a design to the community gallery sends only the design JSON you created. We do not collect Claude Code session data — that JSON is processed locally by the statusline command on your own machine.",
      ],
    },
  ],
  related: [
    { href: "/terms", label: "Terms of service" },
    { href: "/builder", label: "Open the builder" },
  ],
};

const TERMS_CONTENT: StaticPageContent = {
  eyebrow: "Legal",
  h1: "Terms of service.",
  lede: "statusline.sh is provided as-is as a free, open-source Claude Code statusline builder. By using it you agree to these terms.",
  sections: [
    {
      heading: "Using the builder.",
      paragraphs: [
        "You may use statusline.sh to design, preview, and install Claude Code statuslines for personal or commercial projects at no cost. Designs you publish to the community gallery may be viewed and forked by other users. The service is provided without warranty of any kind.",
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
  if (path === STATUSLINE_GUIDE_PATH) return GUIDE_CONTENT;
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
    parts.push(`<section style="${STYLE.section}">`);
    parts.push(`<h2 style="${STYLE.h2}">${escapeHtml(section.heading)}</h2>`);
    for (const paragraph of section.paragraphs) {
      parts.push(`<p style="${STYLE.para}">${escapeHtml(paragraph)}</p>`);
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
