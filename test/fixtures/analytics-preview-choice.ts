import type { AnalyticsConsent } from "../../src/frontend/lib/googleAnalytics";

// Local preview only; never read by the application or a real CMP.
export const PREVIEW_CHOICE_KEY = "statusline-local-preview.analytics.v1";
type Store = Pick<Storage, "getItem" | "setItem">;

export function readPreviewChoice(store: Store): AnalyticsConsent {
  try {
    const record = JSON.parse(store.getItem(PREVIEW_CHOICE_KEY) ?? "null");
    return record?.version === 1 && Number.isFinite(record.savedAt)
      && (record.choice === "granted" || record.choice === "denied")
      ? record.choice : "unknown";
  } catch { return "unknown"; }
}

export function savePreviewChoice(store: Store, choice: "granted" | "denied"): boolean {
  try {
    store.setItem(PREVIEW_CHOICE_KEY, JSON.stringify({ version: 1, choice, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}
