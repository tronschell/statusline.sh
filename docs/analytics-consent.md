# Google Analytics consent gate

This draft pauses Google Analytics across the frontend and Worker-rendered
community HTML. No live CMP is installed and no production consent adapter
is connected. Publishing a consent message alone cannot enable tracking.
The change is prepared for review; production retains its previous behavior
until both deployment targets are updated with approval.

## Behavior and impact

- There is no unconditional GA bootstrap in any HTML entry point.
- The browser starts with Google's measurement opt-out flag set. Without a
  source of explicit analytics consent, it creates no Google script or event
  queue. No cookieless denied pings are used. A missing, invalid, unavailable,
  or refusing provider keeps the gate closed for every region.
- A future reviewed adapter must own the actual consent UI, current consent
  state, records, persistence, updates, and revocation. A localStorage flag,
  region, TCF string alone, `NOT_CONFIGURED`, or a timeout is not consent.
  There is no query parameter, browser-global setter, or build flag that grants
  production consent. The entry point deliberately supplies no adapter.
- With an explicit grant from the injected test provider, the gate loads one
  SDK and sends only the current page and subsequent activity. Duplicate
  effect/callback events are deduplicated; earlier denied activity is dropped.
  Page-view query strings and fragments are excluded. Advertising consent
  remains denied; Google signals/ad-personalization features remain disabled.
- On refusal/withdrawal/provider failure after a grant, collection is disabled
  before the denied update. The event function and script element are removed,
  then the document reloads to discard the SDK's existing listeners/timers.
  The adapter must persist the new choice before notifying the gate. An SDK
  load failure closes the gate without a reload loop. Cached-page restoration
  and each manual event recheck current consent.
- `/privacy` never loads GA, even with a simulated grant. Its existing Vercel
  exclusion and document navigation remain in place. Worker community pages
  are content-only HTML today; removing their GA tags leaves their content and
  navigation intact and means they stay untracked even after a future SPA grant.

**Expected impact if approved:** GA page views, builder-start, install-handoff,
and publish-success events stop until a reviewed live consent integration is
added. Existing data is not deleted. The Vercel analytics component outside
the privacy page and server-side operational/community counters are unchanged.

Vercel documents aggregate analytics without cross-site personal identifiers,
request-derived visitor hashes, and 24-hour sessions. That supports preserving
the existing separate integration in this scoped change; it is not a blanket
statement that every provider, configuration, region, or URL is consent-exempt.

## Reproduce the local checks

Run `bun test`, `bun x tsc --noEmit`, and `bun run build`. The focused cases are
`test/google-analytics-consent.test.ts`, `test/privacy-analytics.test.ts`, and
the Worker HTML regression in `worker/test/seo.test.ts`.

After the build, run `bun scripts/preview-analytics-consent.ts` and open
`http://127.0.0.1:4319/__consent-test`. This loopback-only server and its fixture
are excluded from the production build. They explicitly label every choice
as simulated and replace the SDK URL with a local fake implementation. The
network record counts actual requests to that local SDK and collector.

1. Reset: unknown consent, zero SDK/analytics requests.
2. Open Manage and keep analytics off; refusal and attempted events stay at zero.
3. Accept: one local SDK request and one current page event. Navigate and send
   a mock action; only subsequent events are collected.
4. Withdraw: the page reloads with denied consent. Further attempted events do
   not increase the collector count or load another SDK.
5. Repeat with the unavailable-provider control, a reload, and browser history.
6. Visit the actual build at `/`, `/builder`, a guide, and `/privacy`; verify
   rendering/navigation and absence of the Google loader. The privacy page
   additionally has no Vercel analytics script.

These tests validate gate mechanics and generated HTML. They do not establish
real Google CMP consent, legal validity, or actual Google SDK behavior after
acceptance. A live CMP test is still required before enabling tracking.

### Own-style design preview

The same local server serves `/__consent-design`: a 58-line React component
using the existing `Btn`, plus a 21-line versioned preview-choice store. The
fixture's HTML, CSS, and local fake-SDK wiring bring its total to 158 lines.
There are no new dependencies and no production entry-point changes for this
preview. Its isolated localStorage key is never read by the application.

Accept, reject, and manage use the same button treatment. Manage expands an
inline panel with an initially unchecked optional-analytics control; the
footer's Privacy choices control reopens it. Choices persist across reloads;
withdrawal uses the existing gate's document reload to discard the fake SDK.
The page labels all collection as simulated, uses no external font request,
and restricts network destinations to its own loopback origin with CSP.
This is an analytics UI design prototype, not a certified advertising CMP,
production consent record, or substitute for Google's advertising controls.

Focused validation: 32 tests / 185 assertions passed; root TypeScript and
production build passed. Browser checks at 1280×720 and 390×844 verified equal
44px choice controls, keyboard operation/focus return, no horizontal overflow,
zero local SDK/events before consent and after refusal, grant persistence,
and withdrawal persistence without another SDK load or event. After grant
and one reload the counters were 2 SDK loads / 2 simulated events; withdrawal
and another reload left them at 2 / 2 with the SDK absent. Preview assets and
its storage key are absent from `dist`.

The same draft corrects a separate copy discrepancy: the privacy page claimed
community designs could be unpublished, while current API/UI only support
private-library deletion. Privacy and guide copy now describe the available
controls consistently, with a focused test covering React and static HTML.
This discrepancy is not evidence of any historical AdSense rejection cause.

Validation recorded for this draft: 528 tests passed, 11 PowerShell execution
skips on macOS, 0 failures; 1,940 assertions. Root TypeScript and the production
build passed. Local browser simulation recorded zero SDK/collector requests
for unknown/refused consent; acceptance loaded one fake SDK, and withdrawal
and provider failure stopped subsequent collection. The actual built home,
builder, guide, and privacy page rendered without a GA loader; privacy also
omitted Vercel's script. No browser warnings/errors were captured.

The separate `tsc -p worker/tsconfig.json` command reports DOM-type errors in
the frontend SEO module imported by Worker tests. An isolated archive of
unchanged main (`00d1e45`) with the same installed dependencies reproduces
the same errors. That pre-existing configuration issue was not changed here;
the Worker regression tests pass.

## Deployment and decisions

Do not merge or deploy this draft without the user's review of lost GA
measurement and the withdrawal reload behavior. A later approved rollout must
update the existing Worker as well as the frontend; deploying the frontend
alone leaves direct community pages with their old inline GA loader. Verify
the existing Worker version/bindings and deploy only the reviewed source.
No new Worker, secret, vendor setting, ad unit, or CMP publication is needed
to keep GA paused. Do not apply migrations or change account/payout settings
as part of this analytics change.

`vercel.json` disables automatic Git deployments for this draft branch only
(`codex/analytics-consent-gate`), using Vercel's documented
[`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
setting. Main and other branches keep their existing deployment behavior.
This prevents opening the draft PR from creating an unapproved hosted preview.

## Official references checked October 13, 2026

- [Basic versus advanced consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Consent defaults, updates, and withdrawal](https://developers.google.com/tag-platform/security/guides/consent)
- [GA disable flag and advertising controls](https://developers.google.com/tag-platform/security/guides/privacy)
- [Google CMP API and explicit analytics consent values](https://developers.google.com/funding-choices/fc-api-docs)
- [Vercel analytics data and privacy design](https://vercel.com/docs/analytics/privacy-policy)
