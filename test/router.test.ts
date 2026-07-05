import { describe, expect, test } from "bun:test";
import { matchPath } from "../src/frontend/router";

// `matchPath(pattern, pathname)` reproduces exactly what `<Route>` computes at
// runtime (query string dropped, trailing slash stripped, exact segment-count
// match unless a wildcard is present). These cases pin the whole-segment
// behaviors that must never regress AND the in-segment `:param` support that
// backs every `/claude-code-statusline-*` programmatic page.

describe("router matchPath", () => {
  describe("literal segments", () => {
    test("exact literal matches with empty params", () => {
      expect(matchPath("/community", "/community")).toEqual({
        matched: true,
        params: {},
      });
    });

    test("literal does not match a different path", () => {
      expect(matchPath("/community", "/other").matched).toBe(false);
    });

    test("literal does not match a deeper path (exact-match semantics)", () => {
      expect(matchPath("/community", "/community/extra").matched).toBe(false);
    });

    test("root matches only the root path", () => {
      expect(matchPath("/", "/").matched).toBe(true);
      expect(matchPath("/", "/builder").matched).toBe(false);
    });

    test("query string and trailing slash are normalized away", () => {
      expect(matchPath("/community", "/community/").matched).toBe(true);
      expect(matchPath("/community", "/community?ref=x").matched).toBe(true);
    });

    test("multi-segment literal route matches exactly", () => {
      expect(
        matchPath(
          "/how-to-make-a-claude-code-statusline",
          "/how-to-make-a-claude-code-statusline",
        ).matched,
      ).toBe(true);
      expect(
        matchPath("/best-claude-code-statusline", "/best-claude-code-statusline")
          .matched,
      ).toBe(true);
    });
  });

  describe("whole-segment :param (the /community/:slug case)", () => {
    test("captures the slug", () => {
      expect(matchPath("/community/:slug", "/community/neon-bar")).toEqual({
        matched: true,
        params: { slug: "neon-bar" },
      });
    });

    test("URL-encoded slug is decoded", () => {
      expect(
        matchPath("/community/:slug", "/community/hello%20world").params.slug,
      ).toBe("hello world");
    });

    test("does not match when the param segment is missing", () => {
      expect(matchPath("/community/:slug", "/community").matched).toBe(false);
    });

    test("param does not span a slash", () => {
      expect(matchPath("/community/:slug", "/community/a/b").matched).toBe(false);
    });
  });

  describe("wildcard", () => {
    test("matches any deeper path", () => {
      expect(matchPath("/community/*", "/community/a/b/c").matched).toBe(true);
    });

    test("matches with zero remaining segments", () => {
      expect(matchPath("/community/*", "/community").matched).toBe(true);
    });
  });

  describe("in-segment :param (/claude-code-statusline-:topic)", () => {
    const pattern = "/claude-code-statusline-:topic";

    test("captures a simple topic", () => {
      expect(matchPath(pattern, "/claude-code-statusline-cost")).toEqual({
        matched: true,
        params: { topic: "cost" },
      });
    });

    test("captures a hyphenated topic value", () => {
      expect(
        matchPath(pattern, "/claude-code-statusline-vs-ccstatusline"),
      ).toEqual({ matched: true, params: { topic: "vs-ccstatusline" } });
    });

    test("does not match a different prefix", () => {
      expect(matchPath(pattern, "/best-claude-code-statusline").matched).toBe(
        false,
      );
    });

    test("does not match an empty topic", () => {
      expect(matchPath(pattern, "/claude-code-statusline-").matched).toBe(false);
    });

    test("does not match with a trailing extra segment", () => {
      expect(
        matchPath(pattern, "/claude-code-statusline-cost/extra").matched,
      ).toBe(false);
    });

    test("URL-encoded in-segment value is decoded", () => {
      expect(
        matchPath(pattern, "/claude-code-statusline-a%2Bb").params.topic,
      ).toBe("a+b");
    });
  });

  describe("in-segment escaping + multiple captures", () => {
    test("a literal dot is matched literally, not as a wildcard", () => {
      // Mirrors worker/src/router.ts: the `.` is escaped before compilation.
      expect(matchPath("/file-:name.txt", "/file-notes.txt")).toEqual({
        matched: true,
        params: { name: "notes" },
      });
      expect(matchPath("/file-:name.txt", "/file-notesXtxt").matched).toBe(false);
    });

    test("multiple in-segment params each capture independently", () => {
      expect(matchPath("/version-:major.:minor", "/version-1.2")).toEqual({
        matched: true,
        params: { major: "1", minor: "2" },
      });
    });
  });
});
