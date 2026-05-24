/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  decodeCursor,
  encodeCursor,
  kebabCase,
} from "../src/designs";

describe("kebabCase", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(kebabCase("Hello World")).toBe("hello-world");
  });

  test("collapses multiple spaces and underscores", () => {
    expect(kebabCase("foo   bar___baz")).toBe("foo-bar-baz");
  });

  test("strips punctuation but preserves word chars", () => {
    expect(kebabCase("My Cool!! Design??")).toBe("my-cool-design");
  });

  test("trims leading and trailing hyphens", () => {
    expect(kebabCase("---trimmed---")).toBe("trimmed");
  });

  test("collapses consecutive hyphens", () => {
    expect(kebabCase("a--b---c")).toBe("a-b-c");
  });

  test("normalises unicode (NFKD)", () => {
    // é → "e" + combining acute, then [^\w\s-] strips the combining mark
    expect(kebabCase("café")).toBe("cafe");
  });

  test("returns 'design' for empty / pure-symbol input", () => {
    expect(kebabCase("")).toBe("design");
    expect(kebabCase("!!!")).toBe("design");
    expect(kebabCase("   ")).toBe("design");
  });

  test("preserves existing hyphens", () => {
    expect(kebabCase("foo-bar")).toBe("foo-bar");
  });

  test("handles mixed case and digits", () => {
    expect(kebabCase("My Design v2")).toBe("my-design-v2");
  });
});

describe("encodeCursor / decodeCursor round-trip", () => {
  test("round-trips a recent-cursor shape", () => {
    const cur = { pub: 1716583200000, id: "abcd123XYZ" };
    const enc = encodeCursor(cur);
    expect(typeof enc).toBe("string");
    expect(decodeCursor(enc)).toEqual(cur);
  });

  test("round-trips a popular-cursor shape", () => {
    const cur = { forks: 42, views: 1337, id: "zzzzz99999" };
    expect(decodeCursor(encodeCursor(cur))).toEqual(cur);
  });

  test("produces URL-safe output (no +, /, or =)", () => {
    // Try a payload that's known to produce + / = in standard base64.
    const cur = { pub: 999_999_999_999, id: "??>>>>>>>>" };
    const enc = encodeCursor(cur);
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeCursor(enc)).toEqual(cur);
  });

  test("handles unicode strings", () => {
    const cur = { pub: 1, id: "café-✨-design" };
    expect(decodeCursor(encodeCursor(cur))).toEqual(cur);
  });

  test("returns null on malformed input", () => {
    expect(decodeCursor("!!!not-base64!!!")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    // valid base64 but not JSON
    expect(decodeCursor("aGVsbG8")).toBeNull();
  });

  test("handles arrays and nested objects", () => {
    const obj = { a: [1, 2, 3], b: { c: "d", e: null } };
    expect(decodeCursor(encodeCursor(obj))).toEqual(obj);
  });

  test("padding-free output decodes correctly regardless of length mod 4", () => {
    // Cycle through a few lengths so we exercise each `%4` branch in decodeCursor.
    for (const id of ["a", "ab", "abc", "abcd", "abcde"]) {
      const cur = { pub: 1, id };
      const enc = encodeCursor(cur);
      expect(enc.endsWith("=")).toBe(false);
      expect(decodeCursor(enc)).toEqual(cur);
    }
  });
});
