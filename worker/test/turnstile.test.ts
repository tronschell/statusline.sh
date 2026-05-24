import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getClientIp, verifyTurnstile } from "../src/turnstile";

const SECRET = "1x0000000000000000000000000000000AA";

let originalFetch: typeof fetch;
let fetchCalls: Array<{ url: string; init?: RequestInit }>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetchOk(body: unknown): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function stubFetchStatus(status: number, body = ""): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
}

function stubFetchThrow(err: unknown): void {
  globalThis.fetch = (async () => {
    throw err;
  }) as unknown as typeof fetch;
}

describe("verifyTurnstile()", () => {
  test("null token → false without network call", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile(null, SECRET, null)).toBe(false);
    expect(called).toBe(false);
  });

  test("undefined token → false without network call", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile(undefined, SECRET, null)).toBe(false);
    expect(called).toBe(false);
  });

  test("empty string token → false without network call", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile("", SECRET, null)).toBe(false);
    expect(called).toBe(false);
  });

  test("siteverify returns {success:true} → true", async () => {
    stubFetchOk({ success: true });
    expect(await verifyTurnstile("real-token", SECRET, null)).toBe(true);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(fetchCalls[0]!.init?.method).toBe("POST");
  });

  test("siteverify returns {success:false} → false", async () => {
    stubFetchOk({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyTurnstile("bad-token", SECRET, null)).toBe(false);
  });

  test("siteverify returns non-2xx → false", async () => {
    stubFetchStatus(500, "boom");
    expect(await verifyTurnstile("real-token", SECRET, null)).toBe(false);
  });

  test("siteverify throws (network error) → false (no rethrow)", async () => {
    stubFetchThrow(new Error("network down"));
    expect(await verifyTurnstile("real-token", SECRET, null)).toBe(false);
  });

  test("IP is forwarded as remoteip when provided", async () => {
    stubFetchOk({ success: true });
    await verifyTurnstile("real-token", SECRET, "203.0.113.7");
    const init = fetchCalls[0]!.init!;
    const body = init.body as URLSearchParams;
    expect(body.get("remoteip")).toBe("203.0.113.7");
    expect(body.get("secret")).toBe(SECRET);
    expect(body.get("response")).toBe("real-token");
  });

  test("no IP → no remoteip field", async () => {
    stubFetchOk({ success: true });
    await verifyTurnstile("real-token", SECRET, null);
    const init = fetchCalls[0]!.init!;
    const body = init.body as URLSearchParams;
    expect(body.has("remoteip")).toBe(false);
  });

  test("success field missing in JSON → false", async () => {
    stubFetchOk({});
    expect(await verifyTurnstile("real-token", SECRET, null)).toBe(false);
  });
});

describe("getClientIp()", () => {
  test("prefers cf-connecting-ip", () => {
    const r = new Request("https://x/", {
      headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" },
    });
    expect(getClientIp(r)).toBe("1.2.3.4");
  });

  test("falls back to x-forwarded-for", () => {
    const r = new Request("https://x/", { headers: { "x-forwarded-for": "5.6.7.8" } });
    expect(getClientIp(r)).toBe("5.6.7.8");
  });

  test("returns null when neither header is set", () => {
    const r = new Request("https://x/");
    expect(getClientIp(r)).toBeNull();
  });
});
