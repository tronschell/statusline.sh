import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderStaticRouteHtmlShell } from "../build";
import { STATIC_ROUTE_META } from "../src/frontend/seo";
import { navigate } from "../src/frontend/lib/navigate";

const source = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
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
    expect(home).not.toMatch(/page-analytics|googletagmanager/);
    expect(home).toContain('type="application/ld+json"');
  });

  test("no static route loads Google Analytics before the consent gate", () => {
    for (const meta of Object.values(STATIC_ROUTE_META)) {
      const html = renderStaticRouteHtmlShell(source, meta);
      expect(html).not.toMatch(/page-analytics|googletagmanager|gtag\(/);
    }
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
