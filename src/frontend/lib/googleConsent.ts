import type { AnalyticsConsent, AnalyticsConsentSource } from "./googleAnalytics";

type TCData = { listenerId?: number; cmpStatus?: string; eventStatus?: string; gdprApplies?: boolean };
type TCF = (command: string, version: number, callback: (data: TCData | boolean | undefined, success: boolean) => void, parameter?: number) => void;
type GoogleFC = {
  callbackQueue?: { push(callback: Record<string, () => void>): unknown };
  getGoogleConsentModeValues?(): { analyticsStoragePurposeConsentStatus?: number };
  showRevocationMessage?(): void;
};
export type GoogleConsentWindow = { googlefc?: GoogleFC; __tcfapi?: TCF };

/** Google owns the real choice UI and persistence. This adapter never writes consent. */
export function createGoogleConsent(win: GoogleConsentWindow): AnalyticsConsentSource & {
  canOpenPreferences(): boolean;
  dispose(): void;
} {
  const listeners = new Set<() => void>();
  let modeReady = false, apiReady = false, decisionReady = false, disposed = false;
  let gdprApplies = false;
  let listenerId: number | undefined;
  const emit = () => { if (!disposed) for (const listener of listeners) listener(); };
  const fail = () => { modeReady = false; decisionReady = false; emit(); };
  const queue = (callback: Record<string, () => void>) => {
    const fc = win.googlefc ??= {};
    (fc.callbackQueue ??= [] as Record<string, () => void>[]).push(callback);
  };

  try {
    queue({
      CONSENT_API_READY: () => {
        if (disposed) return;
        apiReady = typeof win.googlefc?.showRevocationMessage === "function";
        if (!win.__tcfapi) { fail(); return; }
        try {
          win.__tcfapi("addEventListener", 2, (data, success) => {
            if (disposed) return;
            if (!success || !data || typeof data !== "object" || data.cmpStatus !== "loaded") { fail(); return; }
            listenerId = data.listenerId ?? listenerId;
            gdprApplies = data.gdprApplies === true;
            decisionReady = data.eventStatus === "tcloaded" || data.eventStatus === "useractioncomplete";
            emit();
          });
        } catch { fail(); }
      },
    });
    queue({
      CONSENT_MODE_DATA_READY: () => { if (!disposed) { modeReady = true; emit(); } },
    });
  } catch { fail(); }

  return {
    getSnapshot(): AnalyticsConsent {
      if (disposed || !modeReady || !decisionReady) return "unknown";
      try {
        // Once CONSENT_MODE_DATA_READY fires, Google permits this current-value read.
        const value = win.googlefc?.getGoogleConsentModeValues?.().analyticsStoragePurposeConsentStatus;
        return value === 1 ? "granted" : value === 2 ? "denied" : "unknown";
      } catch { return "unknown"; }
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    canOpenPreferences() { return !disposed && apiReady && gdprApplies && typeof win.googlefc?.showRevocationMessage === "function"; },
    openPreferences() {
      if (!this.canOpenPreferences()) throw new Error("Google privacy controls are unavailable");
      // Google clears its saved EU choice and opens its own message. An active
      // analytics gate then reloads to discard the SDK, with the old choice gone.
      try { queue({ CONSENT_API_READY: () => { win.googlefc!.showRevocationMessage!(); } }); }
      catch (error) { fail(); throw error; }
      decisionReady = false;
      emit();
    },
    dispose() {
      disposed = true;
      listeners.clear();
      if (listenerId !== undefined) {
        try { win.__tcfapi?.("removeEventListener", 2, () => {}, listenerId); } catch { /* Already unavailable. */ }
      }
    },
  };
}
