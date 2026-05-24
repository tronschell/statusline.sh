import { describe, expect, test } from "bun:test";
import { parseBuilderQuery } from "../src/frontend/components/Builder/BuilderPage";

describe("parseBuilderQuery", () => {
  test("returns empty object for empty search", () => {
    expect(parseBuilderQuery("")).toEqual({});
  });

  test("returns empty object for lone '?'", () => {
    expect(parseBuilderQuery("?")).toEqual({});
  });

  test("returns empty object when no relevant params present", () => {
    expect(parseBuilderQuery("?other=foo&x=1")).toEqual({});
  });

  test("parses ?template=minimal", () => {
    expect(parseBuilderQuery("?template=minimal")).toEqual({
      templateId: "minimal",
    });
  });

  test("parses search without leading '?'", () => {
    expect(parseBuilderQuery("template=verbose-dev")).toEqual({
      templateId: "verbose-dev",
    });
  });

  test("ignores unrelated keys but keeps relevant ones", () => {
    expect(parseBuilderQuery("?garbage=1&template=powerline&extra=2")).toEqual({
      templateId: "powerline",
    });
  });

  test("ignores ?fork= (no longer parsed)", () => {
    expect(parseBuilderQuery("?fork=abc123")).toEqual({});
  });
});
