import { afterEach, describe, expect, test } from "bun:test";
import { _clearRoutes, match, route, type Handler } from "../src/router";

const noopHandler: Handler = () => new Response("ok");

afterEach(() => {
  _clearRoutes();
});

describe("router", () => {
  test("static path matches", () => {
    route("GET", "/api/community", noopHandler);
    const m = match("GET", "/api/community");
    expect(m).not.toBeNull();
    expect(m!.params).toEqual({});
  });

  test("static path mismatch returns null", () => {
    route("GET", "/api/community", noopHandler);
    expect(match("GET", "/api/other")).toBeNull();
  });

  test(":param extracts correctly", () => {
    route("GET", "/api/community/:id", noopHandler);
    const m = match("GET", "/api/community/abc123");
    expect(m).not.toBeNull();
    expect(m!.params).toEqual({ id: "abc123" });
  });

  test("multiple :param segments extract independently", () => {
    route("GET", "/api/:scope/:id", noopHandler);
    const m = match("GET", "/api/community/xyz");
    expect(m).not.toBeNull();
    expect(m!.params).toEqual({ scope: "community", id: "xyz" });
  });

  test("method mismatch returns null", () => {
    route("GET", "/api/community", noopHandler);
    expect(match("POST", "/api/community")).toBeNull();
  });

  test("URL-encoded param is decoded", () => {
    route("GET", "/i/:slug", noopHandler);
    const m = match("GET", "/i/hello%20world");
    expect(m).not.toBeNull();
    expect(m!.params.slug).toBe("hello world");
  });

  test("trailing slash mismatch (anchored at $)", () => {
    route("GET", "/api/community", noopHandler);
    expect(match("GET", "/api/community/")).toBeNull();
  });

  test(":param does not match across slashes", () => {
    route("GET", "/api/community/:id", noopHandler);
    expect(match("GET", "/api/community/abc/extra")).toBeNull();
  });

  test("dot in literal path is treated literally, not as a wildcard", () => {
    route("GET", "/i/:id.sh", noopHandler);
    // The literal `.sh` requires a real dot — `xsh` should NOT match.
    expect(match("GET", "/i/abcxsh")).toBeNull();
    const m = match("GET", "/i/abc.sh");
    expect(m).not.toBeNull();
    expect(m!.params.id).toBe("abc");
  });

  test("first registered route wins on ambiguity", () => {
    let hit = "";
    route("GET", "/api/community/:id", (() => {
      hit = "first";
      return new Response("first");
    }) as Handler);
    route("GET", "/api/community/:slug", (() => {
      hit = "second";
      return new Response("second");
    }) as Handler);
    const m = match("GET", "/api/community/xyz");
    expect(m).not.toBeNull();
    m!.handler(new Request("https://x/"), {} as any, {} as ExecutionContext, m!.params);
    expect(hit).toBe("first");
  });

  test("clear-and-reregister works", () => {
    route("GET", "/api/community", noopHandler);
    expect(match("GET", "/api/community")).not.toBeNull();
    _clearRoutes();
    expect(match("GET", "/api/community")).toBeNull();
    route("POST", "/api/community", noopHandler);
    expect(match("GET", "/api/community")).toBeNull();
    expect(match("POST", "/api/community")).not.toBeNull();
  });

  test("handler is the one registered", () => {
    const customHandler: Handler = () => new Response("custom", { status: 201 });
    route("POST", "/api/publish", customHandler);
    const m = match("POST", "/api/publish");
    expect(m).not.toBeNull();
    expect(m!.handler).toBe(customHandler);
  });
});
