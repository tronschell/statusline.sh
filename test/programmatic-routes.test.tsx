import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Route, Router } from "../src/frontend/router";
import { ProgrammaticRoutes } from "../src/frontend/components/Programmatic/ProgrammaticPage";
import { renderStaticRouteBody } from "../src/frontend/static-content/staticContent";
import { PROGRAMMATIC_PAGES } from "../src/frontend/components/Programmatic/programmatic";

// Regression: the router only treats a segment that STARTS with ":" as a param, so
// the old `/claude-code-statusline-:topic` pattern never matched any real URL and
// every programmatic page fell through to the SPA's not-found view.
const g = globalThis as { window?: unknown };
const realWindow = g.window;
afterEach(() => {
  g.window = realWindow;
});

function renderAt(pathname: string, ui: React.ReactNode) {
  g.window = { location: { pathname, search: "" } };
  return renderToStaticMarkup(<Router>{ui}</Router>);
}

test.each(PROGRAMMATIC_PAGES.map((p) => [p.path, p.h1] as const))(
  "%s renders its own page",
  (path, h1) => {
    const html = renderAt(path, <ProgrammaticRoutes />);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain(h1.replace(/&/g, "&amp;"));
    // Copy uses `code` mini-markup; it must render as <code>, never as raw backticks.
    expect(html).not.toContain("`");
    expect(html).toContain("<code");
    expect(renderStaticRouteBody(path)).not.toContain("`");
  },
);

test("the mid-segment :topic pattern does not match (why literal routes are used)", () => {
  const html = renderAt(
    PROGRAMMATIC_PAGES[0]!.path,
    <Route path="/claude-code-statusline-:topic">match</Route>,
  );
  expect(html).toBe("");
});

test("unknown programmatic slug renders nothing", () => {
  expect(renderAt("/claude-code-statusline-nope", <ProgrammaticRoutes />)).toBe("");
});

test("branch guide distinguishes checkout branches, worktree names, and sample data", () => {
  const path = "/claude-code-statusline-git-branch";
  for (const html of [renderAt(path, <ProgrammaticRoutes />), renderStaticRouteBody(path)]) {
    expect(html).toContain("rev-parse --abbrev-ref HEAD");
    expect(html).toContain("not a reliable branch name");
    expect(html).toContain("Browser previews use sample session data");
    expect(html).toContain('href="https://code.claude.com/docs/en/statusline#available-data"');
    expect(html).not.toContain("element reads");
  }
});
