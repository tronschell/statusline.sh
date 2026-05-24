// Hand-rolled URL.pathname matcher. No external deps.
//
// Routes register a method + pattern; patterns may contain `:param`
// placeholders which match a single non-slash segment and are exposed to the
// handler via the `params` argument.

export type Handler = (
  req: Request,
  env: any,
  ctx: ExecutionContext,
  params: Record<string, string>,
) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

export function route(method: string, pattern: string, handler: Handler): void {
  const keys: string[] = [];
  // Escape regex metacharacters BEFORE substituting `:param` placeholders, so
  // dots etc. in the literal path don't act as wildcards. The substitution
  // step looks for `\:name` because the leading `:` was just escaped.
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    "^" +
      escaped.replace(/:(\w+)/g, (_, k) => {
        keys.push(k);
        return "([^/]+)";
      }) +
      "$",
  );
  routes.push({ method, pattern: re, keys, handler });
}

export interface MatchResult {
  handler: Handler;
  params: Record<string, string>;
}

// Kept for backwards-compat with the S0 stub typings; an alias of MatchResult.
export type MatchedRoute = MatchResult;

export function match(method: string, pathname: string): MatchResult | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    let decodeFailed = false;
    r.keys.forEach((k, i) => {
      try {
        params[k] = decodeURIComponent(m[i + 1]!);
      } catch {
        // Malformed percent-encoding (e.g. `/community/%FF`). Skip this route
        // and let the caller fall through to 404 rather than 500.
        decodeFailed = true;
      }
    });
    if (decodeFailed) continue;
    return { handler: r.handler, params };
  }
  return null;
}

// For tests: reset the route table between cases.
export function _clearRoutes(): void {
  routes.length = 0;
}
