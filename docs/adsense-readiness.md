# AdSense readiness checklist

Reviewed October 13, 2026 against the public site, existing code, Google's
current official guidance, and the actual statusline.sh AdSense draft. This
records evidence and gaps; it is not a guarantee of approval or a blanket
legal-compliance certification. Ads remain off. PR #10 is draft and undeployed.

## Live passes

| Check | Evidence and limit |
| --- | --- |
| Public access and ownership | All 13 core public HTML pages returned HTTP 200 with the existing publisher ownership meta tag. This verifies availability and the tag, not Google's approval. |
| Content and navigation | Home, builder, community, eight original guides, privacy and terms are accessible. Guides have substantive server-rendered examples, instructions and troubleshooting, with relevant navigation. No arbitrary word-count threshold or standalone About/Contact page is claimed as a Google requirement. |
| Crawl surfaces | Robots and sitemaps are reachable, with content in HTML. Google's review crawl completion is not proven. |
| Seller authorization | The root ads.txt contains the exact existing account seller entry. Google recommends ads.txt; it does not activate ads or guarantee approval. Dashboard crawler status may lag the actual file. |
| Privacy-page isolation | The deployed privacy page excludes GA, Vercel analytics, ads and CMP loaders. Crossing its boundary uses a new document. |
| Advertising currently off | No active ad SDK or slots. The only layout marker is loopback-only, limited to the refresh section of the long tutorial. No live Auto ads or enable switch. |
| Existing disclosures | Privacy describes account/storage/billing data, analytics and inactive advertising, with Google's partner-data explanation. One inaccurate community-unpublish promise still needs the draft correction below. |

## Draft passes — not production fixes

| Check | Prepared result and validation |
| --- | --- |
| GA before consent | Unconditional frontend and both Worker HTML bootstraps removed. The gate stays closed worldwide without an explicit analytics grant. Production nonprivacy HTML still loads GA G-JDKLE4R2EV without a consent default; send_page_view:false does not gate the SDK. |
| Google-native adapter | Uses documented callbackQueue entries, TCF changes, and Google's current analyticsStoragePurposeConsentStatus. Only GRANTED (1) permits collection; missing, invalid, denied, NOT_APPLICABLE and NOT_CONFIGURED do not. No invented TCF strings, localStorage consent, custom consent banner or regional grant. No CMP/ad loader is installed. |
| Native withdrawal entry | Footer and builder toolbar show Privacy and cookie settings only when Google's real EU revocation API is available. It calls showRevocationMessage through Google's queue; Google owns the record and UI. Active GA is disabled before a reload discards its listeners. Real persistence and ordering remain unverified. |
| Accurate publishing copy | React and static privacy/guide text now distinguish private-library deletion from unavailable community self-service edit/unpublish controls. Existing GitHub removal-request guidance remains. No new legal policy or removal capability is invented. |
| Local verification | Latest focused run: 60 passing tests, 244 assertions, root TypeScript and production build pass. Includes Google API contract simulations, grant/refusal/failure/revocation, privacy isolation, copy consistency and placement exclusions. Earlier gate baseline: 528 tests passed, 11 macOS PowerShell skips. Earlier actual-build desktop/mobile checks are not a real Google CMP test. |
| Review scope | Custom analytics-only design prototype and its storage code removed from this PR; recoverable in prior commit ebadb35. The clearly labelled technical mock gate harness remains loopback-only. Branch-specific Vercel Git deployments stay disabled. |

## Google-native draft styling

The existing **European regulations message - statusline.sh** remains saved,
unpublished and scoped only to statusline.sh. Its policy URL is
https://statusline.sh/privacy. Consent, Do not consent and Manage options are
on; close-as-refusal and message optimization are off. Other sites' published
messages were not edited.

Saved theme: primary **#252521**, background **#f6f5f2**, Roboto title/body,
rounded corners, matching charcoal filled Consent and Do not consent buttons.
Google's required wording is preserved. Desktop and mobile editor screenshots
are available privately. The standard editor exposes no custom CSS or
bottom-placement control.

| Formatting check | Observed result |
| --- | --- |
| Choice contrast | Consent and Do not consent: #f6f5f2 on #252521; Manage: reverse colors. All three calculate to 14.11:1, above Google's minimum 5:1. |
| Same choice font/style | **Unresolved.** Computed desktop preview styles: Consent/Do not consent Roboto 14px normal 700; Manage Arial 14px normal 600 despite the common Roboto setting. No separate Manage font control or Arial option was exposed. This may be preview-specific, but that is not established. Do not claim formatting fully passes. |
| Required purposes/vendors | **Unresolved.** Settings list 198 ad partners, including Google Advertising Products; the first screen says 0 and the vendor preview is empty. Selected partners normally populate messages. No documented explanation was found and no shared vendor setting was changed as a workaround. |
| Real mobile accessibility | Editor mobile preview inspected; actual-device keyboard, focus, readable purposes, all choices and revocation flow still need staged verification. |

## Unverified requirements and blockers

- **Google site decision:** last observed Getting ready / Review requested.
  Not approved. No repeat review request was submitted.
- **Consent Mode:** the account's optional Enable consent mode for advertising
  purposes is unchecked. The additional analytics choice cannot be inspected
  without enabling the parent. This setting applies across European messages,
  including the other published sites; it is not a statusline-only switch.
- **Real integration:** no approved CMP/tag bootstrap exists. Google's documented
  live preview requires a published message. No publication was authorized.
  Passing mocks does not prove Google's stored decisions, actual callback
  ordering, refusal network behavior, regional applicability or revocation.
- **UGC controls:** community publication has rate limits, authentication or
  Turnstile, shape validation, and limited text/profanity filtering. No dedicated
  report/moderation queue or public-design unpublish endpoint was found. Paid
  verified/featured status is not moderation approval. Generic GitHub issue and
  removal-request links exist. Keep all community content ad-free; this review
  does not claim these controls are sufficient for advertising on UGC.
- **US-state choices, GPC and restricted data processing:** applicability and
  correct account configuration were not verified publicly. No global setting
  was changed. Review actual users, purposes and providers before activation.
- **Scope of analytics:** Vercel outside privacy and operational server counters
  are unchanged. That is not a claim that every configuration is consent-exempt.
- **Worker standalone TypeScript:** existing DOM-type errors reproduce on
  unchanged main with the same dependencies; Worker regression tests pass.

## Manual decisions and exact next actions

1. **Code review first:** review PR #10's loss of GA measurement and withdrawal
   reload behavior. If approved later, deploy the reviewed frontend and existing
   Worker together; otherwise direct Worker HTML retains the old GA bootstrap.
   There is no approval to merge or deploy now.
2. **Shared setting approval:** before any change, obtain permission for AdSense
   → Privacy & messaging → European regulations → Settings → Enable consent
   mode for advertising purposes, then review the newly exposed analytics
   storage option and Save. Explain that other published European messages are
   affected. Do not enable it merely to inspect the hidden child setting.
3. **Publication boundary:** resolve the vendor/font discrepancy through a
   correct Google preview or specific Google guidance. Review the actual
   purposes and tag-loading arrangement. If live verification still requires
   publication, request separate approval to publish only the statusline.sh
   draft for that purpose. Do not publish other sites or activate ad serving.
4. **Approved staged verification:** inspect fresh/no-choice, refusal, saved
   refusal after reload, grant, saved grant, Manage, withdrawal, navigation,
   blocked/failed CMP and applicable region cases. Verify actual network
   requests, persistence, complete vendors/purposes and choice formatting.
   Before re-enabling tracking, confirm the real adapter's event ordering and
   Google SDK behavior rather than relying on the mock contract.
5. **Any later ad activation:** requires site approval, reviewed regional choices
   and disclosures, successful live consent tests and separate user approval.
   Keep private/login/account, loading, empty, error, legal, interactive
   copy/install/download controls and all unreviewed or flagged UGC ad-free.
   Consider only the reviewed editorial placement; do not click live ads.

No further implementation, repeated unavailable live checks, deployment or
publication is included in this handoff. The checklist and saved visual draft
are ready to review; the consent integration is not ready for activation.

## Official references

- [AdSense program policies](https://support.google.com/adsense/answer/48182?hl=en)
- [Content and user experience](https://support.google.com/adsense/answer/10015918?hl=en)
- [Privacy disclosures](https://support.google.com/adsense/answer/1348695?hl=en)
- [Ads.txt guidance](https://support.google.com/adsense/answer/12171612?hl=en)
- [Privacy policy URL restrictions](https://support.google.com/adsense/answer/10961370?hl=en)
- [Certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en)
- [Message formatting and contrast](https://support.google.com/adsense/answer/10958856?hl=en)
- [Ad-partner selection](https://support.google.com/adsense/answer/10960670?hl=en)
- [European messages and optional Consent Mode](https://support.google.com/adsense/answer/10961068?hl=en)
- [Google CMP API, current values and live preview](https://developers.google.com/funding-choices/fc-api-docs)
- [Publisher responsibility for UGC](https://support.google.com/adsense/answer/1355699?hl=en)
- [US-state messages](https://support.google.com/adsense/answer/10961479?hl=en)
- [Restricted data processing](https://support.google.com/adsense/answer/14182916?hl=en)
