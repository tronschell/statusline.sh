import { expect, test } from "bun:test";
import { PREVIEW_CHOICE_KEY, readPreviewChoice, savePreviewChoice } from "./fixtures/analytics-preview-choice";

function storage(initial: string | null = null) {
  let value = initial;
  return { getItem: (_key: string) => value, setItem: (key: string, next: string) => {
    expect(key).toBe(PREVIEW_CHOICE_KEY); value = next;
  } };
}

test("a new, corrupt, old-version, or invalid preview record never grants analytics", () => {
  for (const value of [null, "true", "granted", "{", "null", '{"version":0,"choice":"granted","savedAt":1}', '{"version":1,"choice":"granted"}', '{"version":1,"choice":"all","savedAt":1}']) {
    expect(readPreviewChoice(storage(value))).toBe("unknown");
  }
});

test("explicit preview choices persist and withdrawal replaces the earlier grant", () => {
  const store = storage();
  expect(savePreviewChoice(store, "granted")).toBe(true);
  expect(readPreviewChoice(store)).toBe("granted");
  expect(savePreviewChoice(store, "denied")).toBe(true);
  expect(readPreviewChoice(store)).toBe("denied");
  expect(JSON.parse(store.getItem(PREVIEW_CHOICE_KEY)!)).toMatchObject({ version: 1, choice: "denied" });
});

test("unavailable storage fails closed and reports an unsaved choice", () => {
  const store = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  expect(readPreviewChoice(store)).toBe("unknown");
  expect(savePreviewChoice(store, "granted")).toBe(false);
});
