import { useState, useSyncExternalStore } from "react";
import { googleConsent } from "../../lib/googleConsentRuntime";

const unavailable = () => false;
const noSubscription = () => () => {};

export function GooglePrivacyChoices({ as: Container = "li" }: { as?: "li" | "div" }) {
  const available = useSyncExternalStore(googleConsent?.subscribe ?? noSubscription, googleConsent?.canOpenPreferences ?? unavailable, unavailable);
  const [error, setError] = useState(false);
  if (!available && !error) return null;
  return <Container>
    <button type="button" disabled={!available} className="text-[#8A8A86] transition-colors hover:text-[#E8E8E6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => {
      try { googleConsent?.openPreferences(); setError(false); } catch { setError(true); }
    }}>Privacy and cookie settings</button>
    {error ? <p role="alert" className="mt-2 text-[12px]">Privacy controls are unavailable. Please reload and try again.</p> : null}
  </Container>;
}
