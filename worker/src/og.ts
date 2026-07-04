import type { Design } from "@statusline/shared/types";
import { parseAnsi, stripAnsi } from "@statusline/shared/ansi";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import type { CommunitySeoRow } from "./designs";
import { communityDescription } from "./seo";

function escapeSvgText(value: string): string {
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

function clampText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function wrapText(value: string, maxLineLength: number, maxLines: number): string[] {
  const words = clampText(value, maxLineLength * maxLines).split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function formatPublishedDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Published date unavailable";
  return date.toISOString().slice(0, 10);
}

// Geometry of the preview panel on the card. Kept in sync with the <rect> the
// renderer emits so the real statusline lands inside the same box the
// placeholder bars used to occupy.
const PREVIEW = {
  x: 796,
  y: 180,
  w: 312,
  h: 198,
  padX: 20,
  fontSize: 14,
  lineHeight: 24,
  maxLines: 6,
} as const;

// Terminal "default foreground" for glyphs the design leaves uncolored —
// matches the warm off-white the rest of the card mono text uses.
const DEFAULT_FILL = "#d6c8b9";

// The panel rect + placeholder bars. Rendered verbatim when there is no
// design to draw (or any render step throws) so the OG route never 500s and
// stays byte-identical to the pre-existing card for the no-design case.
const PREVIEW_BOX = `<rect x="${PREVIEW.x}" y="${PREVIEW.y}" width="${PREVIEW.w}" height="${PREVIEW.h}" rx="10" fill="#181613" stroke="#3c362f"/>`;
const PLACEHOLDER_BARS = `${PREVIEW_BOX}
  <path d="M828 224H1076M828 266H1018M828 308H1052M828 350H972" stroke="#8f8274" stroke-width="8" stroke-linecap="round"/>
  <path d="M828 224H930M828 308H908" stroke="#d0b99e" stroke-width="8" stroke-linecap="round"/>`;

/**
 * Normalise a CSS color produced by the ANSI parser into a `#rrggbb` fill.
 * `parseAnsi` emits either `#rrggbb` (16-color palette) or `rgb(r,g,b)`
 * (256-color / truecolor); resvg is happiest with hex, so convert `rgb()`.
 */
function toHexFill(css: string | undefined): string {
  if (!css) return DEFAULT_FILL;
  if (css.startsWith("#")) return css;
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(css);
  if (!m) return DEFAULT_FILL;
  const hex = (n: string) =>
    Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
  return `#${hex(m[1]!)}${hex(m[2]!)}${hex(m[3]!)}`;
}

/**
 * One rendered statusline line → a run of colored `<tspan>`s. Mirrors the
 * segment→style logic in ssr.ts (fg color, bold, italic, dim) but emits SVG
 * `fill`/`font-*`/`fill-opacity` attributes instead of CSS. All text is
 * XML-escaped.
 */
function lineToTspans(line: string): string {
  const segments = parseAnsi(line);
  if (segments.length === 0) return "";
  return segments
    .map((seg) => {
      const attrs = [`fill="${toHexFill(seg.fg)}"`];
      if (seg.bold) attrs.push(`font-weight="700"`);
      if (seg.italic) attrs.push(`font-style="italic"`);
      if (seg.dim) attrs.push(`fill-opacity="0.62"`);
      return `<tspan ${attrs.join(" ")}>${escapeSvgText(seg.text)}</tspan>`;
    })
    .join("");
}

/**
 * Render the design's real statusline into the preview panel. Any failure
 * (bad payload, interpreter throw, empty output) falls back to the placeholder
 * bars so the OG route can never 500. Long lines are condensed to the panel
 * width via `textLength`/`lengthAdjust` rather than truncated, so the whole
 * statusline stays visible.
 */
function renderPreview(design: Design | undefined): string {
  if (!design) return PLACEHOLDER_BARS;
  try {
    const ansi = renderToAnsi(design, DEFAULT_MOCK_STDIN);
    const rawLines = ansi.split("\n");
    // Drop trailing blank lines the compiler may emit after the last row.
    while (rawLines.length > 1 && stripAnsi(rawLines[rawLines.length - 1]!).trim() === "") {
      rawLines.pop();
    }
    const lines = rawLines.slice(0, PREVIEW.maxLines);
    if (lines.length === 0 || lines.every((l) => stripAnsi(l).trim() === "")) {
      return PLACEHOLDER_BARS;
    }

    const textX = PREVIEW.x + PREVIEW.padX;
    const usableW = PREVIEW.w - PREVIEW.padX * 2;
    // Rough monospace advance so we only squeeze lines that actually overflow.
    const advance = PREVIEW.fontSize * 0.6;
    const centerY = PREVIEW.y + PREVIEW.h / 2;
    const firstBaseline = Math.round(
      centerY -
        ((lines.length - 1) * PREVIEW.lineHeight) / 2 +
        PREVIEW.fontSize * 0.34,
    );

    const texts = lines.map((line, i) => {
      const y = firstBaseline + i * PREVIEW.lineHeight;
      const plainLen = stripAnsi(line).length;
      const fit =
        plainLen > 0 && plainLen * advance > usableW
          ? ` textLength="${usableW}" lengthAdjust="spacingAndGlyphs"`
          : "";
      return `<text x="${textX}" y="${y}" font-family="Geist Mono, SFMono-Regular, Consolas, monospace" font-size="${PREVIEW.fontSize}" xml:space="preserve"${fit}>${lineToTspans(line)}</text>`;
    });

    return `${PREVIEW_BOX}\n  ${texts.join("\n  ")}`;
  } catch (err) {
    console.warn("og: renderPreview failed", err);
    return PLACEHOLDER_BARS;
  }
}

export function renderCommunityOgSvg(row: CommunitySeoRow): string {
  const title = clampText(row.name, 72);
  const author = clampText(row.author_name, 42);
  const descriptionLines = wrapText(communityDescription(row), 82, 3);
  const date = formatPublishedDate(row.published_at);
  const slug = clampText(row.slug, 64);
  const stats = `${row.installs.toLocaleString("en-US")} installs / ${row.views.toLocaleString("en-US")} views / ${row.forks.toLocaleString("en-US")} forks`;

  const descriptionTspans = descriptionLines
    .map(
      (line, index) =>
        `<tspan x="92" dy="${index === 0 ? 0 : 34}">${escapeSvgText(line)}</tspan>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${escapeSvgText(title)}</title>
  <desc id="desc">${escapeSvgText(communityDescription(row))}</desc>
  <rect width="1200" height="630" fill="#0d0c0b"/>
  <rect x="36" y="36" width="1128" height="558" rx="18" fill="#12110f" stroke="#2a2723"/>
  <rect x="72" y="72" width="1056" height="486" rx="12" fill="#151311" stroke="#332f2a"/>
  <path d="M92 154H1108" stroke="#332f2a"/>
  <path d="M92 468H1108" stroke="#332f2a"/>
  <rect x="92" y="104" width="178" height="30" rx="6" fill="#221f1b" stroke="#4a4036"/>
  <text x="112" y="124" fill="#d6c8b9" font-family="Geist Mono, SFMono-Regular, Consolas, monospace" font-size="13" letter-spacing="1.6">COMMUNITY DESIGN</text>
  <text x="92" y="172" fill="#b7ada2" font-family="Geist Mono, SFMono-Regular, Consolas, monospace" font-size="16">by ${escapeSvgText(author)}</text>
  <text x="92" y="250" fill="#f3eee7" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="600" letter-spacing="-2.4">${escapeSvgText(title)}</text>
  <text x="92" y="314" fill="#a8a09a" font-family="Geist, 'Helvetica Neue', Arial, sans-serif" font-size="24" line-height="34">${descriptionTspans}</text>
  <rect x="92" y="506" width="432" height="30" rx="6" fill="#1d1a17" stroke="#332f2a"/>
  <text x="112" y="526" fill="#c6beb4" font-family="Geist Mono, SFMono-Regular, Consolas, monospace" font-size="13">statusline.sh/community/${escapeSvgText(slug)}</text>
  <text x="706" y="526" fill="#b7ada2" font-family="Geist Mono, SFMono-Regular, Consolas, monospace" font-size="13">${escapeSvgText(stats)}</text>
  <text x="928" y="526" fill="#847b72" font-family="Geist Mono, SFMono-Regular, Consolas, monospace" font-size="13">${escapeSvgText(date)}</text>
  <path d="M866 104h242M866 124h146M866 506h38M914 506h38M962 506h38" stroke="#6f6255" stroke-width="2" stroke-linecap="round" opacity="0.72"/>
  ${renderPreview(row.design)}
</svg>
`;
}
