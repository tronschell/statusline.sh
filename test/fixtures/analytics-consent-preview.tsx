import { createRoot } from "react-dom/client";
import { GA_SCRIPT_URL, startGoogleAnalytics } from "../../src/frontend/lib/googleAnalytics";
import { AnalyticsConsentPreview } from "./AnalyticsConsentPreview";
import { PREVIEW_CHOICE_KEY, readPreviewChoice, savePreviewChoice } from "./analytics-preview-choice";

// TEST ONLY. The loopback page also blocks external requests with CSP.
const append = document.head.appendChild.bind(document.head);
document.head.appendChild = function <T extends Node>(node: T): T {
  if (node instanceof HTMLScriptElement && node.src === GA_SCRIPT_URL) node.src = "/__mock-gtag.js";
  return append(node) as T;
};
const changes = new EventTarget();
const source = {
  getSnapshot: () => { try { return readPreviewChoice(localStorage); } catch { return "unknown" as const; } },
  subscribe(fn: () => void) {
    changes.addEventListener("change", fn);
    const storage = (event: StorageEvent) => { if (event.key === PREVIEW_CHOICE_KEY || event.key === null) fn(); };
    window.addEventListener("storage", storage);
    return () => { changes.removeEventListener("change", fn); window.removeEventListener("storage", storage); };
  },
  openPreferences() { document.querySelector<HTMLButtonElement>(".preview-footer button")?.click(); },
  save(choice: "granted" | "denied") {
    try { if (!savePreviewChoice(localStorage, choice)) return false; } catch { return false; }
    changes.dispatchEvent(new Event("change"));
    return true;
  },
};
startGoogleAnalytics(window, source);
createRoot(document.getElementById("consent-root")!).render(<AnalyticsConsentPreview source={source} />);
document.getElementById("reset-preview")!.onclick = async () => {
  localStorage.removeItem(PREVIEW_CHOICE_KEY);
  await fetch("/__test-reset", { method: "POST" });
  location.reload();
};
setInterval(async () => {
  const state = await (await fetch("/__test-status")).json();
  document.getElementById("mock-counts")!.textContent = `${state.sdkRequests} local SDK loads · ${state.analyticsRequests} simulated events`;
}, 300);
