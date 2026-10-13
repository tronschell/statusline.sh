import { GA_SCRIPT_URL, startGoogleAnalytics, type AnalyticsConsent } from "../../src/frontend/lib/googleAnalytics";

// TEST ONLY. This entry is never included in the application build.
const key = "statusline-mock-analytics-consent";
let changed = () => {};
const panel = document.querySelector<HTMLDialogElement>("#preferences")!;
const append = document.head.appendChild.bind(document.head);
document.head.appendChild = function <T extends Node>(node: T): T {
  if (node instanceof HTMLScriptElement && node.src === GA_SCRIPT_URL) {
    node.src = "/__mock-gtag.js"; // Local fake SDK; never contact Google.
  }
  return append(node) as T;
};

const gate = startGoogleAnalytics(window, {
  getSnapshot() {
    const saved = sessionStorage.getItem(key);
    if (saved === "unavailable") throw new Error("Simulated unavailable CMP");
    return (saved ?? "unknown") as AnalyticsConsent;
  },
  subscribe(fn) { changed = fn; return () => { changed = () => {}; }; },
  openPreferences() { panel.showModal(); },
});

function choose(value: string) {
  sessionStorage.setItem(key, value); // Only this clearly-labelled mock uses local state.
  if (panel.open) panel.close();
  changed();
  void refresh();
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-choice]")) {
  button.onclick = () => choose(button.dataset.choice!);
}
document.querySelector<HTMLButtonElement>("#manage")!.onclick = () => { gate.openPreferences(); };
document.querySelector<HTMLButtonElement>("#event")!.onclick = () => {
  (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", "mock_action", { test_only: true });
  void refresh();
};
document.querySelector<HTMLButtonElement>("#navigate")!.onclick = () => {
  history.pushState({}, "", "/__consent-test/next?example=mock#simulation");
  (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", "page_view");
  void refresh();
};
document.querySelector<HTMLButtonElement>("#reset")!.onclick = async () => {
  sessionStorage.removeItem(key);
  await fetch("/__test-reset", { method: "POST" });
  location.href = "/__consent-test";
};
async function refresh() {
  const response = await fetch("/__test-status");
  const status = await response.json();
  document.querySelector("#state")!.textContent = sessionStorage.getItem(key) ?? "unknown";
  document.querySelector("#path")!.textContent = location.pathname;
  document.querySelector("#requests")!.textContent = JSON.stringify(status, null, 2);
}
void refresh();
setInterval(() => void refresh(), 300);
