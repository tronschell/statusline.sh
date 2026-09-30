import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClaudeCodeStatuslineCommandPage,
  ClaudeCodeStatuslineGuidePage,
} from "../src/frontend/components/Guides/ClaudeCodeStatuslineGuidePage";
import { COMMAND_GUIDE_PATH, GUIDE_PAGES } from "../src/frontend/components/Guides/guideContent";
import { STATUSLINE_GUIDE_PATH } from "../src/frontend/seo";
import { renderStaticRouteBody } from "../src/frontend/static-content/staticContent";

const PAGES = [
  ["pillar", STATUSLINE_GUIDE_PATH, ClaudeCodeStatuslineGuidePage],
  ["command", COMMAND_GUIDE_PATH, ClaudeCodeStatuslineCommandPage],
] as const;

test("guide heading uses a decorative logo and matches the crawlable heading", () => {
  const html = renderToStaticMarkup(<ClaudeCodeStatuslineGuidePage />);
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  expect(headings).toHaveLength(1);
  const heading = headings[0]![1]!;
  expect(heading).toMatch(/<svg\b[^>]*aria-hidden="true"/);
  expect(heading).not.toContain("<title>");
  const text = heading.replace(/<[^>]+>/g, "");
  expect(text).toBe("How to make a Claude Code statusline.");

  const staticHtml = renderStaticRouteBody(STATUSLINE_GUIDE_PATH);
  expect(staticHtml.match(/<h1\b[^>]*>([^<]+)<\/h1>/)?.[1]).toBe(text);
});

test.each(PAGES)("%s guide: one H1, FAQ <details> and TOC match the data", (_n, path, Page) => {
  const page = GUIDE_PAGES.find((p) => p.path === path)!;
  const html = renderToStaticMarkup(<Page />);

  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toContain("[render error");
  // Every FAQ is a native <details>, so it works with JS off.
  expect(html.match(/<details\b/g)!.length).toBeGreaterThanOrEqual(page.faqs.length);
  // Every TOC entry points at a section that exists.
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const s of page.sections) expect(ids.has(s.id)).toBe(true);
  // Every image has alt text and an explicit size to avoid layout shift.
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    expect(img).toMatch(/\balt="[^"]+"/);
    expect(img).toMatch(/\bwidth="\d+"/);
    expect(img).toMatch(/\bheight="\d+"/);
  }
});

test("command guide has its own H1 and static body", () => {
  const html = renderToStaticMarkup(<ClaudeCodeStatuslineCommandPage />);
  const text = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]!.replace(/<[^>]+>/g, "");
  const staticHtml = renderStaticRouteBody(COMMAND_GUIDE_PATH);
  expect(staticHtml.match(/<h1\b[^>]*>([^<]+)<\/h1>/)?.[1]).toBe(text);
  expect(text).not.toBe("How to make a Claude Code statusline.");
});
