import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { renderStaticRouteHtmlShell } from "../build";
import { STATIC_ROUTE_META } from "../src/frontend/seo";
import { navigate } from "../src/frontend/lib/navigate";

const source = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
const bootstrap = source.match(/<script id="page-analytics">([\s\S]*?)<\/script>/)![1]!;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalPopStateEvent = Object.getOwnPropertyDescriptor(globalThis, "PopStateEvent");
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalPopStateEvent) Object.defineProperty(globalThis, "PopStateEvent", originalPopStateEvent);
  else Reflect.deleteProperty(globalThis, "PopStateEvent");
});

describe("privacy page analytics isolation", () => {
  test("built privacy HTML omits Google Analytics while retaining the app and structured content", () => {
    const html = renderStaticRouteHtmlShell(source, STATIC_ROUTE_META["/privacy"]!);
    expect(html).not.toMatch(/page-analytics|googletagmanager|G-JDKLE4R2EV/);
    expect(html).toContain('src="./frontend.tsx"');
    expect(html).toContain('rel="canonical" href="https://statusline.sh/privacy"');
    expect(html).toContain('id="advertising"');
    const home = renderStaticRouteHtmlShell(source, STATIC_ROUTE_META["/"]!);
    expect(home).toContain("googletagmanager");
    expect(home).toContain('type="application/ld+json"');
  });

  test.each(["/privacy", "/privacy/", "/privacy///"])(
    "dev/fallback bootstrap does not initialize or load analytics at %s", (pathname) => {
      const window: Record<string, unknown> = { location: { pathname } };
      const createElement = mock(() => ({}));
      const appendChild = mock(() => {});
      runInNewContext(bootstrap, { window, document: { createElement, head: { appendChild } } });
      expect(createElement).not.toHaveBeenCalled();
      expect(appendChild).not.toHaveBeenCalled();
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
    },
  );

  test("other pages keep the existing measurement ID and manual page views", () => {
    const window: Record<string, any> = { location: { pathname: "/builder" } };
    const appendChild = mock((_script: object) => {});
    runInNewContext(bootstrap, { window, document: { createElement: () => ({}), head: { appendChild } } });
    expect(appendChild.mock.calls).toEqual([[{
      async: true,
      src: "https://www.googletagmanager.com/gtag/js?id=G-JDKLE4R2EV",
    }]]);
    expect(Array.from(window.dataLayer[1])).toEqual([
      "config", "G-JDKLE4R2EV", { send_page_view: false },
    ]);
  });

  function installWindow(path: string) {
    Object.defineProperty(globalThis, "PopStateEvent", { configurable: true, value: class extends Event {} });
    const location = new URL(path, "https://statusline.sh");
    const assign = mock((_url: string) => {});
    const pushState = mock((_state: object, _title: string, _url: string) => {});
    const dispatchEvent = mock((_event: Event) => true);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: location.href, pathname: location.pathname, assign }, history: { pushState }, dispatchEvent },
    });
    return { assign, pushState, dispatchEvent };
  }

  test.each([
    ["/", "/privacy"],
    ["/community", "/privacy?from=footer#advertising"],
    ["/builder", "/privacy/"],
    ["/", "https://statusline.sh/privacy"],
    ["/privacy", "/builder?template=minimal"],
    ["/privacy/?from=footer", "/"],
  ])("navigation from %s to %s replaces the document", (from, to) => {
    const { assign, pushState, dispatchEvent } = installWindow(from!);
    navigate(to!);
    expect(assign).toHaveBeenCalledWith(to);
    expect(pushState).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  test("navigation between other pages retains SPA history behavior", () => {
    const { assign, pushState, dispatchEvent } = installWindow("/");
    navigate("/builder?template=minimal");
    expect(assign).not.toHaveBeenCalled();
    expect(pushState).toHaveBeenCalledWith({}, "", "/builder?template=minimal");
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe("popstate");
  });
});
