import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { canPreviewEditorialAd } from "../src/frontend/components/Advertising/advertising";
import { EditorialAdPlacement } from "../src/frontend/components/Advertising/EditorialAdPlacement";
import { PrivacyPage } from "../src/frontend/components/Legal/PrivacyPage";
import { ClaudeCodeStatuslineGuidePage } from "../src/frontend/components/Guides/ClaudeCodeStatuslineGuidePage";
import { renderStaticRouteBody } from "../src/frontend/static-content/staticContent";

const guide = "/how-to-make-a-claude-code-statusline";
const g = globalThis as { window?: unknown };
const realWindow = g.window;
afterEach(() => { g.window = realWindow; });

function at(pathname: string, search = "", hostname = "localhost") {
  g.window = { location: { hostname, pathname, search } };
  return { hostname, pathname, search };
}

test("unconfigured advertising leaves no slot or consent UI", () => {
  at(guide);
  expect(renderToStaticMarkup(<EditorialAdPlacement afterSection="refresh" />)).toBe("");
  expect(renderToStaticMarkup(<ClaudeCodeStatuslineGuidePage />)).not.toContain("data-ad-layout-preview");
  const privacy = renderToStaticMarkup(<PrivacyPage />);
  expect(privacy).toContain("Advertising is currently disabled");
  expect(privacy).toContain("There are no advertising consent preferences to change");
  expect(privacy).not.toContain("<button");
});

test("the local marker is limited to one editorial placement and never requests ads", () => {
  at(guide, "?ad-preview=1");
  const html = renderToStaticMarkup(<ClaudeCodeStatuslineGuidePage />);
  expect(html.match(/data-ad-layout-preview/g)).toHaveLength(1);
  expect(html.indexOf("data-ad-layout-preview")).toBeGreaterThan(html.indexOf('id="refresh"'));
  expect(html.indexOf("data-ad-layout-preview")).toBeLessThan(html.indexOf('id="windows"'));
  expect(html).toContain("Advertisement layout preview");
  expect(html).not.toMatch(/<script|<iframe|adsbygoogle|data-ad-client|data-ad-slot/);
  expect(renderToStaticMarkup(<EditorialAdPlacement afterSection="install" />)).toBe("");
});

test.each(["statusline.sh", "www.statusline.sh", "preview.vercel.app", "localhost.example.com"])(
  "preview query cannot enable an ad placement on %s", (hostname) => {
    at(guide, "?ad-preview=1", hostname);
    expect(renderToStaticMarkup(<EditorialAdPlacement afterSection="refresh" />)).toBe("");
  },
);

test.each([
  "/", "/builder", "/community", "/community/example", "/u/example",
  "/signin", "/auth/callback", "/account", "/pricing", "/library", "/teams",
  "/privacy", "/terms", "/unknown", "/claude-code-statusline-git-branch",
  "/claude-code-statusline-command",
])("%s has no eligible placement, including with local preview requested", (pathname) => {
  expect(canPreviewEditorialAd(at(pathname, "?ad-preview=1"), "refresh")).toBe(false);
});

test("privacy advertising disclosure and links reach both JS and static readers", () => {
  at("/privacy");
  for (const html of [renderToStaticMarkup(<PrivacyPage />), renderStaticRouteBody("/privacy")]) {
    expect(html).toContain('id="advertising"');
    expect(html).toContain("Advertising is currently disabled");
    expect(html).toContain("that setup is not active on this site today");
    expect(html).toContain('href="https://policies.google.com/technologies/partner-sites"');
    expect(html).toContain('href="https://policies.google.com/technologies/ads"');
  }
});
