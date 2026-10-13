# AdSense readiness review

Reviewed October 12–13, 2026 against Google's current documentation and the
public production site, with a separate draft analytics-gate follow-up. This is a technical review, not a guarantee of
Google's approval or a legal-compliance certification. Ads remain disabled.

## Site review and technical checks

| Area | Evidence and current state |
| --- | --- |
| Ownership and review | The existing AdSense account verified statusline.sh using its public meta tag. Review was requested; the dashboard says **Getting ready**, not Ready. All 13 public HTML routes checked returned HTTP 200 and the expected publisher meta tag. |
| Public content | The home page, builder, community page, eight editorial guides, privacy policy, and terms are reachable without signing in. The long tutorial includes original instructions, examples, installation steps, and troubleshooting. Content is present in server HTML. These observations are not a quality score or an approval threshold. |
| Navigation | Public navigation connects the builder, examples, guides, project documentation, privacy policy, and terms. Editorial content remains separate from installation and download controls. |
| Privacy disclosures | Both the rendered policy and its static version disclose account/storage/billing data, existing analytics, and the inactive advertising setup. The advertising section describes potential cookies, web beacons, IP addresses/device identifiers, and links prominently to Google's partner-site data and advertising explanations. |
| Privacy-page isolation | The production build omits GA from `/privacy`; React omits its analytics components and page-view event. Entering or leaving the policy replaces the document so an existing analytics script cannot survive an SPA transition. The page contains no advertising or Funding Choices loader. |
| Advertising placement | No live ad SDK, slot, Auto ads integration, or enable switch exists. A loopback-only layout preview is restricted to one section of the long editorial tutorial. Deployed hosts ignore its query parameter. No ads are placed beside copy/install/download controls, on account or legal pages, or in unreviewed community content. |
| Seller authorization | `/ads.txt` is copied as a root text asset during the build. Its single line is the exact snippet displayed for statusline.sh by the existing AdSense account. Google describes ads.txt as recommended, not mandatory. This file does not request ads or confer site approval. |
| Crawling | Public pages and `/robots.txt` returned HTTP 200. The site exposes static page content and sitemaps. This does not prove that Google's review crawl has completed. |

## Consent work that remains

The saved **European regulations message - statusline.sh** is an unpublished
draft scoped only to statusline.sh, with its privacy URL set to
`https://statusline.sh/privacy`. Consent, Manage options, and Do not consent
are enabled; message optimization is off. No live CMP is integrated in this
repository. The **Advertising and choices** footer link is informational,
not a working withdrawal control.

The account's actual partner selector reports **198 selected** and includes
Google Advertising Products. The editor's first screen displays **0 partners**
and its vendor-preferences preview is empty. Google says the selected partners
populate its messages; the reviewed documentation does not explain this
preview discrepancy. It remains unresolved. No shared partner/purpose setting
was changed to conceal or work around it. Do not publish or activate the
message until the real vendor list and purpose presentation can be verified.

Bounded diagnosis: the actual selector is populated (including the required
Google vendor), so this is not evidence of an empty saved partner selection.
Both the first-screen count and vendor-preferences editor are empty. Google's
partner-selection and troubleshooting documentation do not identify this as
normal preview behavior. Classify it as an **unresolved Google CMP dashboard
discrepancy**, not a confirmed preview-only limitation or a proven server-side
fault. Resolution needs a correct preview/live integration test or a specific
answer from Google; changing shared vendors merely to affect the preview is
not justified. No message was published to diagnose it.

**The separate draft analytics change closes the unconditional-loader gap in
code, but has not been deployed:** it removes GA bootstraps from the frontend
and both Worker HTML renderers, and uses a default-denied gate with no
production consent adapter. GA therefore remains paused in that build. See
[analytics consent and validation](analytics-consent.md). Production still has
the previous behavior until the user approves and both targets are deployed.
The local simulated acceptance/withdrawal tests do not prove live CMP behavior.

Before any advertising activation, resolve that gap and the vendor discrepancy,
integrate the chosen certified CMP and real consent-revocation control, review
the actual providers/purposes and applicable regional choices, and test accept,
decline, withdrawal, navigation, and unavailable/blocked-CMP cases. Required
consent must gate the corresponding requests. Do not test by clicking live ads.
Keep the privacy page free of consent-dependent scripts and consent messages.

The inherited account-level fallback-message setting can apply to all sites
when a required TC string is missing. A site's draft status alone must not be
treated as an advertising consent gate.

## Review readiness versus ad-serving readiness

| Check | Current result |
| --- | --- |
| Accessible content, navigation, privacy disclosures | Reviewed; privacy isolation and ads.txt from PR #9 are deployed. Google still decides content quality and site approval. |
| GA before consent | Fixed and tested in the separate draft only. Pending user review and coordinated frontend/Worker deployment. |
| Analytics after future consent | Gate lifecycle tested with a local mock CMP/SDK. No real CMP adapter is connected; no production path grants consent. |
| Google site decision | Submitted; last observed Getting ready / Review requested. Not approved. |
| Vendor/purpose presentation | Unresolved Google dashboard preview discrepancy. Draft remains unpublished. |
| Live consent and revocation | Not integrated or tested live. Must be completed before tracking is re-enabled or ads are considered. |
| Ad-serving activation | Disabled. Requires site approval, reviewed CMP/provider/purpose/regional choices, live consent validation, and user approval for the chosen placement. |

## Sources checked

- [AdSense program policies](https://support.google.com/adsense/answer/48182?hl=en)
- [Google Publisher Policies](https://support.google.com/adsense/answer/10502938?hl=en)
- [Privacy disclosures](https://support.google.com/publisherpolicies/answer/10437794)
- [Content and user experience](https://support.google.com/adsense/answer/10015918?hl=en)
- [Add and verify a new site](https://support.google.com/adsense/answer/12169212?hl=en)
- [Ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en)
- [Privacy policy URLs and script restrictions](https://support.google.com/adsense/answer/10961370?hl=en)
- [Google EU user consent policy](https://www.google.com/about/company/user-consent-policy/)
- [Certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en)
- [Manage GDPR ad partners](https://support.google.com/adsense/answer/10960670?hl=en)
- [European regulations messages and revocation](https://support.google.com/adsense/answer/10961068?hl=en)
