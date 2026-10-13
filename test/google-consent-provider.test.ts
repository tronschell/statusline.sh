import { expect, mock, test } from "bun:test";
import { createGoogleConsent, type GoogleConsentWindow } from "../src/frontend/lib/googleConsent";
import { startGoogleAnalytics } from "../src/frontend/lib/googleAnalytics";

// API-contract simulations only. These do not verify Google's live record or UI.

function googleFixture(savedChoice = 4) {
  let value = savedChoice;
  let tcfListener: Parameters<NonNullable<GoogleConsentWindow["__tcfapi"]>>[2] | undefined;
  const queued: Record<string, () => void>[] = [];
  const apiReady = new Set<string>();
  const revoked = mock(() => { value = 0; });
  const tcf = mock<NonNullable<GoogleConsentWindow["__tcfapi"]>>((command, _version, callback) => {
    if (command === "addEventListener") tcfListener = callback;
  });
  const win: GoogleConsentWindow = {
    googlefc: {
      callbackQueue: { push(record) {
        queued.push(record);
        for (const [key, callback] of Object.entries(record)) if (apiReady.has(key)) callback();
      } },
      getGoogleConsentModeValues: () => ({ analyticsStoragePurposeConsentStatus: value }),
      showRevocationMessage: revoked,
    }, __tcfapi: tcf,
  };
  const source = createGoogleConsent(win);
  function ready(key: string) { apiReady.add(key); for (const item of [...queued]) item[key]?.(); }
  function decision(next: number, eventStatus = "useractioncomplete", gdprApplies = true) {
    value = next;
    tcfListener?.({ listenerId: 7, cmpStatus: "loaded", eventStatus, gdprApplies }, true);
  }
  return { source, win, ready, decision, revoked, tcf, queued,
    fail: () => tcfListener?.(undefined, false),
  };
}

test("only explicit Google analytics consent grants; missing and nonapplicable states stay closed", () => {
  const f = googleFixture(1);
  expect(f.source.getSnapshot()).toBe("unknown");
  expect(f.queued.every(item => Object.keys(item).length === 1)).toBe(true);
  f.ready("CONSENT_API_READY");
  f.decision(1, "tcloaded");
  expect(f.source.getSnapshot()).toBe("unknown");
  f.ready("CONSENT_MODE_DATA_READY");
  expect(f.source.getSnapshot()).toBe("granted");
  for (const value of [0, 3, 4, 99]) { f.decision(value); expect(f.source.getSnapshot()).toBe("unknown"); }
  f.decision(2); expect(f.source.getSnapshot()).toBe("denied");
  f.decision(1, "cmpuishown"); expect(f.source.getSnapshot()).toBe("unknown");
});

test.each([1, 2])("a fresh page reads Google's existing decision %s without local consent storage", value => {
  const f = googleFixture(value);
  f.ready("CONSENT_API_READY"); f.decision(value, "tcloaded"); f.ready("CONSENT_MODE_DATA_READY");
  expect(f.source.getSnapshot()).toBe(value === 1 ? "granted" : "denied");
});

test("Google's native revocation API clears the old decision before notifying the analytics gate", () => {
  const f = googleFixture(1);
  f.ready("CONSENT_API_READY"); f.decision(1, "tcloaded"); f.ready("CONSENT_MODE_DATA_READY");
  expect(f.source.canOpenPreferences()).toBe(true);
  const states: string[] = [];
  f.source.subscribe(() => states.push(f.source.getSnapshot()));
  f.source.openPreferences();
  expect(f.revoked).toHaveBeenCalledTimes(1);
  expect(states).toEqual(["unknown"]);
  f.decision(2); expect(f.source.getSnapshot()).toBe("denied");
  f.decision(1); expect(f.source.getSnapshot()).toBe("granted");
});

test("TCF failure, unreadable Google data, or unavailable API cannot retain a grant", () => {
  const f = googleFixture(1);
  f.ready("CONSENT_API_READY"); f.decision(1); f.ready("CONSENT_MODE_DATA_READY");
  f.win.googlefc!.getGoogleConsentModeValues = () => { throw new Error("blocked"); };
  expect(f.source.getSnapshot()).toBe("unknown");
  f.fail(); expect(f.source.getSnapshot()).toBe("unknown");
  const missing = createGoogleConsent({});
  expect(missing.canOpenPreferences()).toBe(false);
  expect(() => missing.openPreferences()).toThrow();
  expect(missing.getSnapshot()).toBe("unknown");
});

test("outside-region status does not grant consent or expose the EU revocation control", () => {
  const f = googleFixture(3);
  f.ready("CONSENT_API_READY"); f.decision(3, "tcloaded", false); f.ready("CONSENT_MODE_DATA_READY");
  expect(f.source.getSnapshot()).toBe("unknown");
  expect(f.source.canOpenPreferences()).toBe(false);
});

test("cleanup removes the TCF listener and ignores late callbacks", () => {
  const f = googleFixture(1);
  f.ready("CONSENT_API_READY"); f.decision(1); f.ready("CONSENT_MODE_DATA_READY");
  const changed = mock(() => {});
  f.source.subscribe(changed);
  f.source.dispose();
  expect(f.tcf.mock.calls.at(-1)?.[0]).toBe("removeEventListener");
  expect(f.tcf.mock.calls.at(-1)?.[3]).toBe(7);
  f.decision(1); f.ready("CONSENT_MODE_DATA_READY");
  expect(changed).not.toHaveBeenCalled();
  expect(f.source.getSnapshot()).toBe("unknown");
});

test("the Google adapter and gate load only after a grant, then disable after native revocation", () => {
  const f = googleFixture(4);
  const loads: string[] = [];
  const script = { src: "", async: false, remove: mock(() => {}) };
  let disabledAtReload = false;
  const host = {
    location: { pathname: "/builder", search: "", origin: "https://statusline.sh", reload: mock(() => { disabledAtReload = host["ga-disable-G-JDKLE4R2EV"]; }) },
    document: { title: "statusline.sh", createElement: () => script, head: { appendChild: () => loads.push(script.src) } },
    addEventListener() {}, removeEventListener() {}, "ga-disable-G-JDKLE4R2EV": false,
  };
  startGoogleAnalytics(host as unknown as Parameters<typeof startGoogleAnalytics>[0], f.source);
  f.ready("CONSENT_API_READY"); f.decision(4, "tcloaded"); f.ready("CONSENT_MODE_DATA_READY");
  expect(loads).toHaveLength(0);
  f.decision(2); expect(loads).toHaveLength(0);
  f.decision(1); expect(loads).toHaveLength(1);
  f.source.openPreferences();
  expect(f.revoked).toHaveBeenCalledTimes(1);
  expect(disabledAtReload).toBe(true);
  expect(host.location.reload).toHaveBeenCalledTimes(1);
  expect(script.remove).toHaveBeenCalledTimes(1);
});
