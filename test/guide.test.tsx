import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaudeCodeStatuslineGuidePage } from "../src/frontend/components/Guides/ClaudeCodeStatuslineGuidePage";
import { STATUSLINE_GUIDE_PATH } from "../src/frontend/seo";
import { renderStaticRouteBody } from "../src/frontend/static-content/staticContent";

test("guide heading uses a decorative logo and matches the crawlable heading", () => {
  const html = renderToStaticMarkup(<ClaudeCodeStatuslineGuidePage />);
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  expect(headings).toHaveLength(1);
  const heading = headings[0]![1]!;
  expect(heading).toMatch(/<svg\b[^>]*aria-hidden="true"/);
  expect(heading).not.toContain("<title>");
  const text = heading.replace(/<[^>]+>/g, "");
  expect(text).toBe("How to make a Claude Code status line.");

  const staticHtml = renderStaticRouteBody(STATUSLINE_GUIDE_PATH);
  expect(staticHtml.match(/<h1\b[^>]*>([^<]+)<\/h1>/)?.[1]).toBe(text);
});
