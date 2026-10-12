/**
 * Placement preparation only. There is deliberately no ad SDK, publisher ID,
 * live enable switch, or consent implementation in this release.
 * See docs/advertising.md before adding any network-backed advertising.
 */
export const EDITORIAL_AD_PLACEMENT = {
  path: "/how-to-make-a-claude-code-statusline",
  afterSection: "refresh",
} as const;

export function canPreviewEditorialAd(location: {
  hostname: string;
  pathname: string;
  search: string;
}, afterSection: string): boolean {
  return (
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) &&
    location.pathname === EDITORIAL_AD_PLACEMENT.path &&
    afterSection === EDITORIAL_AD_PLACEMENT.afterSection &&
    new URLSearchParams(location.search).get("ad-preview") === "1"
  );
}

// Shared by the React privacy page and its no-JavaScript/crawler version.
export const ADVERTISING_PRIVACY = {
  id: "advertising",
  heading: "Advertising and your choices",
  paragraphs: [
    "Advertising is currently disabled on statusline.sh. We do not load Google AdSense or request ads. There are no advertising consent preferences to change at present. The analytics described above are separate from advertising.",
    "If we introduce advertising, Google and other advertising providers may place or read cookies, use web beacons, and process IP addresses or other device identifiers to deliver and measure ads, personalize ads where permitted, and prevent fraud. This can involve information about visits to this and other sites. Read [how Google uses data on partner sites](https://policies.google.com/technologies/partner-sites) and [Google's advertising technologies](https://policies.google.com/technologies/ads).",
    "Before enabling ads, we will update this disclosure to describe the providers and choices in use and provide the required consent controls. Where consent is required, declining or withdrawing it must remain possible. A Google-certified consent management platform must be configured before serving personalized Google ads in the EEA, UK, or Switzerland; that setup is not active on this site today.",
  ],
};
