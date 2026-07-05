/**
 * Tiny hand-rolled history router. No external dependencies.
 *
 * Surfaces:
 *  - `<Router>`: provider that listens to `popstate` and exposes current path
 *    via context. Wrap the app once.
 *  - `<Route path="/...">`: renders children when the current pathname matches.
 *    - Exact match: `/community`
 *    - Wildcard prefix: `/community/*` (matches `/community/anything`)
 *    - Param extraction: `/community/:slug` (captures `slug` into context)
 *  - `useParams<T>()`: returns extracted params for the surrounding `<Route>`.
 *  - `usePath()`: current pathname (no querystring).
 *  - `<Link href="...">`: anchor that calls `navigate(href)` on click.
 *
 * The router intentionally renders every matching `<Route>` (the parent app
 * is expected to mount mutually-exclusive route paths). This keeps the
 * component dead simple and matches the existing path-based switch logic.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { getPath, navigate } from "./lib/navigate";

interface RouterContextValue {
  path: string; // full path + search (mirrors getPath)
  pathname: string; // pathname only, no querystring
}

const RouterContext = createContext<RouterContextValue | null>(null);

const ParamsContext = createContext<Readonly<Record<string, string>>>({});

function splitPath(full: string): { pathname: string } {
  const pathname = (full.split("?")[0] ?? "/").replace(/\/+$/, "") || "/";
  return { pathname };
}

export interface RouterProps {
  children: ReactNode;
}

export function Router({ children }: RouterProps) {
  const [path, setPath] = useState<string>(() => getPath());

  useEffect(() => {
    const h = () => setPath(getPath());
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  useEffect(() => {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [path]);

  const value = useMemo<RouterContextValue>(() => {
    const { pathname } = splitPath(path);
    return { path, pathname };
  }, [path]);

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

function useRouterContext(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    // Fallback so components are still usable outside a Router (tests, etc.).
    const full = getPath();
    return { path: full, ...splitPath(full) };
  }
  return ctx;
}

export function usePath(): string {
  return useRouterContext().pathname;
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}

/**
 * Compile a route pattern into a matcher. Supports:
 *  - literal segments: `/community`
 *  - param segments: `/:slug` -> captures into params
 *  - in-segment params: `/claude-code-statusline-:topic` -> literal text mixed
 *    with one or more `:name` tokens; captured via a per-segment regex
 *  - wildcard suffix: `/community/*` -> matches any deeper path
 */
interface CompiledRoute {
  segments: Array<
    | { kind: "literal"; value: string }
    | { kind: "pattern"; regex: RegExp; keys: string[] }
    | { kind: "wildcard" }
  >;
}

/**
 * Compile a single path segment. A segment that contains one or more `:name`
 * tokens (whether it is a whole-segment param like `:slug` or an in-segment
 * mix like `claude-code-statusline-:topic`) becomes a `pattern` segment: an
 * anchored regex where each `:name` is a `([^/]+)` capture and the literal
 * portions are matched verbatim.
 *
 * Mirrors `worker/src/router.ts`: regex metacharacters in the literal portions
 * are escaped BEFORE substituting the placeholders, so dots/hyphens etc. match
 * literally instead of acting as regex operators. The substitution runs on the
 * escaped source and looks for `:(\w+)` (the `:` is not a metacharacter, so it
 * survives escaping untouched).
 */
function compileSegment(part: string): CompiledRoute["segments"][number] {
  if (part === "*") return { kind: "wildcard" };
  if (!part.includes(":")) return { kind: "literal", value: part };
  const keys: string[] = [];
  const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = escaped.replace(/:(\w+)/g, (_, k: string) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { kind: "pattern", regex: new RegExp("^" + source + "$"), keys };
}

function compileRoute(pattern: string): CompiledRoute {
  const trimmed = pattern.replace(/\/+$/, "");
  const raw = trimmed === "" ? "/" : trimmed;
  if (raw === "/") return { segments: [] };
  const parts = raw.split("/").filter((s) => s.length > 0);
  return { segments: parts.map(compileSegment) };
}

function matchRoute(
  compiled: CompiledRoute,
  pathname: string,
): { matched: boolean; params: Record<string, string> } {
  const path = pathname === "/" ? [] : pathname.split("/").filter((s) => s.length > 0);
  const params: Record<string, string> = {};
  const segs = compiled.segments;

  let i = 0;
  for (; i < segs.length; i++) {
    const s = segs[i];
    if (!s) continue;
    if (s.kind === "wildcard") {
      // Wildcard matches the rest (including zero remaining segments).
      return { matched: true, params };
    }
    const piece = path[i];
    if (piece === undefined) return { matched: false, params: {} };
    if (s.kind === "literal") {
      if (piece !== s.value) return { matched: false, params: {} };
    } else {
      // pattern: whole-segment or in-segment `:param` captures. The anchored
      // regex must consume the entire piece, so an empty capture (e.g. the
      // `/claude-code-statusline-` prefix with no topic) fails to match.
      const m = s.regex.exec(piece);
      if (!m) return { matched: false, params: {} };
      for (let g = 0; g < s.keys.length; g++) {
        const key = s.keys[g]!;
        const raw = m[g + 1] ?? "";
        try {
          params[key] = decodeURIComponent(raw);
        } catch {
          params[key] = raw;
        }
      }
    }
  }

  // No wildcard hit; must have consumed all of the path for exact match.
  if (i !== path.length) return { matched: false, params: {} };
  return { matched: true, params };
}

/**
 * Match a route `pattern` against a `pathname`, returning whether it matched
 * and any captured params — using the exact same normalization and exact-match
 * semantics that `<Route>` applies at runtime (query string dropped, trailing
 * slashes stripped). Exposed for unit tests; `<Route>` itself uses the memoized
 * `compileRoute`/`matchRoute` pair below.
 */
export function matchPath(
  pattern: string,
  pathname: string,
): { matched: boolean; params: Record<string, string> } {
  return matchRoute(compileRoute(pattern), splitPath(pathname).pathname);
}

export interface RouteProps {
  path: string;
  children: ReactNode;
}

export function Route({ path, children }: RouteProps) {
  const { pathname } = useRouterContext();
  const compiled = useMemo(() => compileRoute(path), [path]);
  const { matched, params } = useMemo(
    () => matchRoute(compiled, pathname),
    [compiled, pathname],
  );
  if (!matched) return null;
  return <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>;
}

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
}

export function Link({ href, onClick, children, ...rest }: LinkProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        // Let modifier-clicks (cmd/ctrl/shift) fall through to native behavior.
        if (
          e.defaultPrevented ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        // Give the user's onClick a chance to preventDefault first; only then
        // take over with SPA navigation.
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

// Re-export navigate for ergonomics: `import { navigate } from '.../router'`.
export { navigate } from "./lib/navigate";
