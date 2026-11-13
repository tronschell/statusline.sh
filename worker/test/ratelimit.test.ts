import { expect, test } from "bun:test";
import { checkRateLimit } from "../src/ratelimit";

const binding = (success: boolean) => ({ limit: async () => ({ success }) });

test("a denied request gets a 429 with a JSON error the SPA clients can read", async () => {
  const res = await checkRateLimit({ RATE_LIMITER_INSTALLER: binding(false) }, "installer", "1.1.1.1");
  expect(res!.status).toBe(429);
  expect(res!.headers.get("retry-after")).toBe("60");
  expect(res!.headers.get("content-type")).toBe("application/json; charset=utf-8");
  expect(await res!.json()).toEqual({ error: "Too many requests. Wait a minute and try again." });
});

test("an allowed request and an unconfigured binding both pass through", async () => {
  expect(await checkRateLimit({ RATE_LIMITER_INSTALLER: binding(true) }, "installer", "1.1.1.1")).toBeNull();
  expect(await checkRateLimit({}, "installer", "1.1.1.1")).toBeNull();
});
