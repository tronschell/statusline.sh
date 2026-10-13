import { useRef, useState, useSyncExternalStore } from "react";
import { Btn } from "../../src/frontend/components/Account/ui";
import type { AnalyticsConsentSource } from "../../src/frontend/lib/googleAnalytics";

type PreviewSource = AnalyticsConsentSource & { save(choice: "granted" | "denied"): boolean };

/** Design prototype only: optional analytics, no advertising/TCF consent. */
export function AnalyticsConsentPreview({ source }: { source: PreviewSource }) {
  const choice = useSyncExternalStore(source.subscribe, source.getSnapshot, () => "unknown");
  const [visible, setVisible] = useState(choice === "unknown");
  const [manage, setManage] = useState(false);
  const [allow, setAllow] = useState(choice === "granted");
  const [error, setError] = useState(false);
  const footer = useRef<HTMLElement>(null);
  const checkbox = useRef<HTMLInputElement>(null);

  function choose(next: "granted" | "denied") {
    if (!source.save(next)) { setError(true); return; }
    setError(false);
    setVisible(false);
    requestAnimationFrame(() => footer.current?.querySelector("button")?.focus());
  }

  function openPreferences() {
    setAllow(choice === "granted");
    setManage(true);
    setVisible(true);
    requestAnimationFrame(() => checkbox.current?.focus());
  }

  return <>
    <footer ref={footer} className="preview-footer">
      <span role="status">Optional analytics: {choice === "granted" ? "on" : "off"} · preview only</span>
      <Btn onClick={openPreferences}>Privacy choices</Btn>
    </footer>
    {visible ? <aside className="consent-preview" aria-labelledby="consent-title">
      <div className="consent-summary">
        <div><h2 id="consent-title">A little insight. Your choice.</h2>
          <p>Allow optional analytics to help improve statusline.sh? It stays off until you say yes. Change your mind any time in Privacy choices.</p>
        </div>
        <div className="consent-actions">
          <Btn onClick={() => choose("denied")}>Reject analytics</Btn>
          <Btn onClick={() => choose("granted")}>Accept analytics</Btn>
          <Btn aria-expanded={manage} aria-controls="consent-details" onClick={() => { setAllow(choice === "granted"); setManage(!manage); }}>Manage</Btn>
        </div>
      </div>
      {manage ? <div id="consent-details" className="consent-details">
        <p>The site works with analytics off. This preview stores your choice only in this browser.</p>
        <label><input ref={checkbox} type="checkbox" checked={allow} onChange={event => setAllow(event.target.checked)} />
          <span><strong>Optional analytics</strong><small>Page views and usage events. This preview simulates them locally; no data goes to Google.</small></span>
        </label>
        <div className="consent-actions"><Btn onClick={() => choose(allow ? "granted" : "denied")}>Save choice</Btn>
          <Btn onClick={() => choose("denied")}>Turn analytics off</Btn></div>
      </div> : null}
      {error ? <p role="alert">Your choice could not be saved. Analytics has not been enabled by this action.</p> : null}
    </aside> : null}
  </>;
}
