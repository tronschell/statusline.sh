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
  <rect x="796" y="180" width="312" height="198" rx="10" fill="#181613" stroke="#3c362f"/>
  <path d="M828 224H1076M828 266H1018M828 308H1052M828 350H972" stroke="#8f8274" stroke-width="8" stroke-linecap="round"/>
  <path d="M828 224H930M828 308H908" stroke="#d0b99e" stroke-width="8" stroke-linecap="round"/>
</svg>
`;
}
