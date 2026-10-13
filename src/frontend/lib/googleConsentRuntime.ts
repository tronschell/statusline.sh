import { createGoogleConsent, type GoogleConsentWindow } from "./googleConsent";
import { isPrivacyPath } from "./navigate";

// This queues supported Google callbacks; it does not load a CMP/ad tag.
// Keep the privacy document free of consent-message initialization as well.
export const googleConsent = typeof window !== "undefined" && !isPrivacyPath(window.location.pathname)
  ? createGoogleConsent(window as Window & GoogleConsentWindow) : undefined;
