import { isPrivacyPath } from "./navigate";

export const GA_MEASUREMENT_ID = "G-JDKLE4R2EV";
export const GA_SCRIPT_URL = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

export type AnalyticsConsent = "unknown" | "denied" | "granted";

/**
 * A reviewed CMP adapter must supply current, explicit analytics consent and
 * notify on changes/failure. It owns persistence, consent evidence, and the
 * real preferences UI. A TCF string, region, or localStorage boolean alone is
 * not this contract. There is no production adapter while the CMP is a draft.
 */
export interface AnalyticsConsentSource {
  getSnapshot(): AnalyticsConsent;
  subscribe(onChange: () => void): () => void;
  openPreferences(): void;
}

type AnalyticsWindow = Window & {
  dataLayer?: IArguments[];
  gtag?: (...args: unknown[]) => void;
  "ga-disable-G-JDKLE4R2EV"?: boolean;
};

const DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

/** Basic-mode gate: no Google script, pings, or event backlog before consent. */
export function startGoogleAnalytics(win: AnalyticsWindow, source?: AnalyticsConsentSource) {
  const disableKey = `ga-disable-${GA_MEASUREMENT_ID}` as const;
  win[disableKey] = true;
  delete win.gtag;
  let active = false;
  let stopped = false;
  let script: HTMLScriptElement | undefined;
  let lastPage: string | undefined;
  let unsubscribe: (() => void) | undefined;

  function allowed() {
    if (stopped || !source || isPrivacyPath(win.location.pathname)) return false;
    try { return source.getSnapshot() === "granted"; }
    catch { return false; }
  }

  // gtag.js consumes the standard arguments-object dataLayer protocol.
  function command(..._args: unknown[]) { win.dataLayer?.push(arguments); }

  function stop(reload = true) {
    const wasActive = active;
    active = false;
    win[disableKey] = true; // Disable collection before updating consent/teardown.
    if (wasActive) command("consent", "update", DENIED);
    if (win.gtag === event) delete win.gtag;
    script?.remove();
    if (wasActive) {
      stopped = true;
      // Removing a script tag cannot unload its listeners/timers. A new
      // document discards the SDK; the CMP must restore the latest choice.
      if (reload) win.location.reload();
    }
  }

  function event(...args: unknown[]) {
    if (!active || !allowed()) { stop(); return; }
    if (args[0] !== "event") return;
    if (args[1] === "page_view") {
      const page = win.location.pathname + win.location.search;
      if (page === lastPage) return;
      lastPage = page;
      // Never send query/hash tokens from account, checkout, or shared URLs.
      args[2] = {
        page_path: win.location.pathname,
        page_location: win.location.origin + win.location.pathname,
        page_title: win.document.title,
      };
    }
    command(...args);
  }

  function sync() {
    if (!allowed()) { stop(); return; }
    if (active) { win[disableKey] = false; return; }
    active = true;
    win.dataLayer = []; // Discard any pre-consent backlog; never replay it.
    win.gtag = event;
    command("consent", "default", DENIED);
    command("consent", "update", { ...DENIED, analytics_storage: "granted" });
    command("js", new Date());
    command("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    win[disableKey] = false;
    script = win.document.createElement("script");
    script.async = true;
    script.src = GA_SCRIPT_URL;
    script.onerror = () => stop(false);
    win.document.head.appendChild(script);
    event("event", "page_view"); // Only the current page, never prior activity.
  }

  if (source && !isPrivacyPath(win.location.pathname)) {
    try {
      unsubscribe = source.subscribe(sync);
      sync();
    } catch { stop(); }
  }
  win.addEventListener("pageshow", sync);

  return {
    openPreferences(): boolean {
      if (!source || isPrivacyPath(win.location.pathname)) return false;
      try { source.openPreferences(); return true; }
      catch { stop(); return false; }
    },
    dispose() {
      win.removeEventListener("pageshow", sync);
      try { unsubscribe?.(); }
      catch { /* A failed CMP cleanup must not interrupt the application. */ }
      stop();
    },
  };
}
