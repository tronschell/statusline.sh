# AdSense readiness review

Reviewed October 12, 2026 against Google's current documentation and the
public production site. This is a technical review, not a guarantee of
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

**Existing Google Analytics is a separate, current consent gap outside the
policy page:** other routes, including Worker-rendered community pages, load
GA without a consent gate. The unpublished draft cannot provide consent for
those scripts. Before claiming site-wide readiness, implement and validate
the applicable analytics consent flow or pause those tags across both deploy
targets. That change needs an explicit review of the frontend and Worker;
this PR does not deploy unrelated Worker code or alter shared account settings.

Before any advertising activation, resolve that gap and the vendor discrepancy,
integrate the chosen certified CMP and real consent-revocation control, review
the actual providers/purposes and applicable regional choices, and test accept,
decline, withdrawal, navigation, and unavailable/blocked-CMP cases. Required
consent must gate the corresponding requests. Do not test by clicking live ads.
Keep the privacy page free of consent-dependent scripts and consent messages.

The inherited account-level fallback-message setting can apply to all sites
when a required TC string is missing. A site's draft status alone must not be
treated as an advertising consent gate.

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
