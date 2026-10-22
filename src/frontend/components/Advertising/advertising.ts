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
  heading: "Advertising",
  paragraphs: [
    "We do not run advertising on statusline.sh. The analytics described above are separate from advertising.",
  ],
};
