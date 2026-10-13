import { describe, expect, mock, test } from "bun:test";
import { startGoogleAnalytics, GA_SCRIPT_URL, type AnalyticsConsent, type AnalyticsConsentSource } from "../src/frontend/lib/googleAnalytics";

// Mock CMP and SDK host only: these tests do not obtain or prove real consent.
function fixture(initial: AnalyticsConsent = "unknown", pathname = "/") {
  let state = initial;
  let notify = () => {};
  let fail = false;
  const source: AnalyticsConsentSource = {
    getSnapshot() { if (fail) throw new Error("CMP unavailable"); return state; },
    subscribe(fn) { notify = fn; return () => { notify = () => {}; }; },
    openPreferences: mock(() => {}),
  };
  const requests: string[] = [];
  const script = { src: "", async: false, onerror: undefined as (() => void) | undefined, remove: mock(() => {}) };
  const listeners = new Map<string, () => void>();
  const host = {
    location: { pathname, search: "", origin: "https://statusline.sh", reload: mock(() => {}) },
    document: {
      title: "statusline.sh",
      createElement: mock(() => script),
      head: { appendChild: mock((element: typeof script) => { requests.push(element.src); }) },
    },
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
    dataLayer: undefined as IArguments[] | undefined,
    gtag: undefined as ((...args: unknown[]) => void) | undefined,
    "ga-disable-G-JDKLE4R2EV": undefined as boolean | undefined,
  };
  const window = host as unknown as Parameters<typeof startGoogleAnalytics>[0];
  return {
    source, host, window, script, requests, listeners,
    choose(next: AnalyticsConsent) { state = next; notify(); },
    unavailable() { fail = true; notify(); },
    stale(next: AnalyticsConsent) { state = next; },
    commands: () => host.dataLayer?.map(entry => Array.from(entry)) ?? [],
    events: () => host.dataLayer?.map(entry => Array.from(entry)).filter(entry => entry[0] === "event") ?? [],
  };
}

describe("Google Analytics basic consent gate (mock provider)", () => {
  test.each([undefined, "unknown", "denied", "unexpected"])("fails closed for %s consent", state => {
    const f = fixture(state as AnalyticsConsent);
    startGoogleAnalytics(f.window, state === undefined ? undefined : f.source);
    f.host.gtag?.("event", "builder_start");
    expect(f.requests).toEqual([]);
    expect(f.host.dataLayer).toBeUndefined();
    expect(f.host.gtag).toBeUndefined();
    expect(f.host["ga-disable-G-JDKLE4R2EV"]).toBe(true);
  });

  test("manage and refusal cannot create consent or queue earlier events", () => {
    const f = fixture();
    const gate = startGoogleAnalytics(f.window, f.source);
    expect(gate.openPreferences()).toBe(true);
    expect(f.source.openPreferences).toHaveBeenCalledTimes(1);
    f.choose("denied");
    f.host.gtag?.("event", "private_pre_consent_activity");
    expect(f.requests).toEqual([]);
    f.host.location.pathname = "/builder";
    f.choose("granted");
    expect(f.requests).toEqual([GA_SCRIPT_URL]);
    expect(f.events()).toEqual([["event", "page_view", {
      page_path: "/builder", page_location: "https://statusline.sh/builder", page_title: "statusline.sh",
    }]]);
    const commands = f.commands();
    expect(commands[0]).toEqual(["consent", "default", expect.objectContaining({ analytics_storage: "denied" })]);
    expect(commands[1]).toEqual(["consent", "update", {
      analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    }]);
    expect(commands[3]).toEqual(["config", "G-JDKLE4R2EV", {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    }]);
  });

  test("duplicate consent/effects do not duplicate the SDK or page view; SPA navigation is tracked", () => {
    const f = fixture("granted");
    startGoogleAnalytics(f.window, f.source);
    f.choose("granted");
    f.host.gtag?.("event", "page_view", {});
    f.host.gtag?.("event", "page_view", {});
    expect(f.requests).toHaveLength(1);
    expect(f.events()).toHaveLength(1);
    f.host.location.pathname = "/builder";
    f.host.location.search = "?token=never-send-this";
    f.host.gtag?.("event", "page_view", { page_location: "unsafe-url" });
    f.host.gtag?.("event", "builder_start", { element_count: 4 });
    expect(f.events()).toHaveLength(3);
    expect(JSON.stringify(f.host.dataLayer)).not.toContain("never-send-this");
    expect(JSON.stringify(f.host.dataLayer)).not.toContain("unsafe-url");
  });

  test.each(["denied", "unknown"] as const)("withdrawal to %s disables before reload and drops subsequent events", state => {
    const f = fixture("granted");
    startGoogleAnalytics(f.window, f.source);
    const oldGtag = f.host.gtag!;
    const before = f.events().length;
    f.choose(state);
    expect(f.host["ga-disable-G-JDKLE4R2EV"]).toBe(true);
    expect(f.host.gtag).toBeUndefined();
    expect(f.script.remove).toHaveBeenCalled();
    expect(f.host.location.reload).toHaveBeenCalledTimes(1);
    oldGtag("event", "after_withdrawal");
    f.choose("granted"); // The old SDK document remains closed until reloaded.
    expect(f.events()).toHaveLength(before);
    expect(f.requests).toHaveLength(1);
  });

  test("an unavailable provider revokes active analytics", () => {
    const f = fixture("granted");
    startGoogleAnalytics(f.window, f.source);
    f.unavailable();
    expect(f.host["ga-disable-G-JDKLE4R2EV"]).toBe(true);
    expect(f.host.location.reload).toHaveBeenCalledTimes(1);
  });

  test("every event rechecks current consent even if a provider callback is late", () => {
    const f = fixture("granted");
    startGoogleAnalytics(f.window, f.source);
    f.stale("denied");
    f.host.gtag?.("event", "too_late");
    expect(f.events()).toHaveLength(1);
    expect(f.host.location.reload).toHaveBeenCalledTimes(1);
  });

  test("restoring a cached page rechecks the provider", () => {
    const f = fixture("granted");
    startGoogleAnalytics(f.window, f.source);
    f.stale("denied");
    f.listeners.get("pageshow")!();
    expect(f.host["ga-disable-G-JDKLE4R2EV"]).toBe(true);
    expect(f.host.location.reload).toHaveBeenCalledTimes(1);
  });

  test("an SDK load failure disables collection without a reload loop", () => {
    const f = fixture("granted");
    startGoogleAnalytics(f.window, f.source);
    f.script.onerror!();
    f.choose("granted");
    expect(f.requests).toHaveLength(1);
    expect(f.host["ga-disable-G-JDKLE4R2EV"]).toBe(true);
    expect(f.host.location.reload).not.toHaveBeenCalled();
  });

  test.each(["/privacy", "/privacy/", "/privacy///"])("%s never loads GA or a preferences UI even with mocked consent", path => {
    const f = fixture("granted", path);
    const gate = startGoogleAnalytics(f.window, f.source);
    expect(gate.openPreferences()).toBe(false);
    expect(f.requests).toEqual([]);
    expect(f.host.dataLayer).toBeUndefined();
    expect(f.source.openPreferences).not.toHaveBeenCalled();
  });
});
