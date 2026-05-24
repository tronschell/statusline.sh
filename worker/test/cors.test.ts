import { describe, expect, test } from "bun:test";
import { cors, mergeCorsHeaders } from "../src/cors";

function req(method: string, init: { origin?: string } = {}): Request {
  const headers = new Headers();
  if (init.origin) headers.set("origin", init.origin);
  return new Request("https://worker.example.com/anything", { method, headers });
}

describe("cors()", () => {
  test("allowed origin echoes the origin and sets vary/methods/headers", () => {
    const { headers, preflightResponse } = cors(req("GET", { origin: "https://statusline.sh" }), {});
    expect(headers.get("access-control-allow-origin")).toBe("https://statusline.sh");
    expect(headers.get("vary")).toBe("origin");
    expect(headers.get("access-control-allow-methods")).toContain("GET");
    expect(headers.get("access-control-allow-methods")).toContain("POST");
    expect(headers.get("access-control-allow-methods")).toContain("OPTIONS");
    expect(headers.get("access-control-allow-headers")).toBe("content-type");
    expect(headers.get("access-control-max-age")).toBe("86400");
    expect(preflightResponse).toBeNull();
  });

  test("www subdomain allowed", () => {
    const { headers } = cors(req("GET", { origin: "https://www.statusline.sh" }), {});
    expect(headers.get("access-control-allow-origin")).toBe("https://www.statusline.sh");
  });

  test("vercel production alias allowed", () => {
    const { headers } = cors(
      req("GET", { origin: "https://statusline-maker.vercel.app" }),
      {},
    );
    expect(headers.get("access-control-allow-origin")).toBe(
      "https://statusline-maker.vercel.app",
    );
  });

  test("vercel preview URL (team-scoped) allowed", () => {
    const { headers } = cors(
      req("GET", { origin: "https://statusline-maker-42ntldmyn-tronschells-projects.vercel.app" }),
      {},
    );
    expect(headers.get("access-control-allow-origin")).toBe(
      "https://statusline-maker-42ntldmyn-tronschells-projects.vercel.app",
    );
  });

  test("vercel URL from a different team rejected", () => {
    const { headers } = cors(
      req("GET", { origin: "https://statusline-maker-abc-other-team.vercel.app" }),
      {},
    );
    expect(headers.get("access-control-allow-origin")).toBeNull();
  });

  test("localhost rejected in production", () => {
    // Production CORS does not include localhost — dev uses `wrangler dev --local`
    // which runs its own Worker on :8787, so the local SPA never hits the
    // deployed Worker's CORS.
    const { headers } = cors(req("GET", { origin: "http://localhost:3001" }), {});
    expect(headers.get("access-control-allow-origin")).toBeNull();
  });

  test("127.0.0.1 rejected in production", () => {
    const { headers } = cors(req("GET", { origin: "http://127.0.0.1:8787" }), {});
    expect(headers.get("access-control-allow-origin")).toBeNull();
  });

  test("disallowed origin → no CORS headers", () => {
    const { headers, preflightResponse } = cors(
      req("GET", { origin: "https://evil.example.com" }),
      {},
    );
    expect(headers.get("access-control-allow-origin")).toBeNull();
    expect(headers.get("vary")).toBeNull();
    expect(preflightResponse).toBeNull();
  });

  test("no Origin header (curl / iwr) → no CORS headers, no error", () => {
    const { headers, preflightResponse } = cors(req("GET"), {});
    expect(headers.get("access-control-allow-origin")).toBeNull();
    // Most importantly: did not throw and did not return a preflight.
    expect(preflightResponse).toBeNull();
  });

  test("OPTIONS preflight from allowed origin → 204 with headers", async () => {
    const { preflightResponse } = cors(
      req("OPTIONS", { origin: "https://statusline.sh" }),
      {},
    );
    expect(preflightResponse).not.toBeNull();
    expect(preflightResponse!.status).toBe(204);
    expect(preflightResponse!.headers.get("access-control-allow-origin")).toBe(
      "https://statusline.sh",
    );
  });

  test("OPTIONS preflight from disallowed origin → still 204 but without CORS headers", () => {
    const { preflightResponse } = cors(
      req("OPTIONS", { origin: "https://evil.example.com" }),
      {},
    );
    expect(preflightResponse).not.toBeNull();
    expect(preflightResponse!.status).toBe(204);
    expect(preflightResponse!.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("non-matching scheme (http://statusline.sh) rejected", () => {
    const { headers } = cors(req("GET", { origin: "http://statusline.sh" }), {});
    expect(headers.get("access-control-allow-origin")).toBeNull();
  });

  test("non-matching vercel app pattern rejected", () => {
    const { headers } = cors(
      req("GET", { origin: "https://other-project-abc.vercel.app" }),
      {},
    );
    expect(headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("mergeCorsHeaders()", () => {
  test("copies headers from corsHeaders onto the response", () => {
    const corsH = new Headers();
    corsH.set("access-control-allow-origin", "https://statusline.sh");
    corsH.set("vary", "origin");
    const res = new Response("ok", { headers: { "content-type": "text/plain" } });
    const merged = mergeCorsHeaders(res, corsH);
    expect(merged.headers.get("access-control-allow-origin")).toBe("https://statusline.sh");
    expect(merged.headers.get("vary")).toBe("origin");
    expect(merged.headers.get("content-type")).toBe("text/plain");
  });

  test("returns the same response instance (mutating its headers)", () => {
    const res = new Response("ok");
    const merged = mergeCorsHeaders(res, new Headers());
    expect(merged).toBe(res);
  });
});
