# Advertising preparation

Ads are disabled. The HTML shell includes the existing publisher account's
public `google-adsense-account` meta tag for site ownership verification. This
tag does not load an ad SDK, request ads, or establish site approval. There is
no CMP or ads.txt seller entry. The existing Google Analytics and Vercel
Analytics integrations are separate and unchanged.

## Placement review

There is one candidate manual placement: after **When the statusline refreshes**
on `/how-to-make-a-claude-code-statusline`. This is a long editorial tutorial;
the placement sits in normal document flow after prose, with its own
Advertisement label, borders, and vertical separation. Review the surrounding
content and mobile layout again before any live implementation. Spacing alone
does not establish policy compliance or guarantee AdSense approval.

To inspect the non-networked layout locally, open:

`http://localhost:3001/how-to-make-a-claude-code-statusline?ad-preview=1#refresh`

The marker requires both a loopback hostname and that exact editorial route
and section. Deployed hosts ignore the query parameter. Without it, the
component renders nothing: no placeholder, blank reserved space, cookies, or
advertising requests. It has no live-enable setting.

Do not add global Auto ads or placements to the builder, install/download/copy
controls, dialogs, community or profile content, account/billing/auth routes,
legal pages, navigation-only, loading, empty, or error screens. These surfaces
are not included in this preparation. An additional placement needs an
explicit content and interaction review; a route name is not proof of value.

## Before enabling ads (separate reviewed change)

1. Obtain the user's sign-off, deploy the readiness changes, and submit the
   correct site through the user's AdSense account. Site approval is Google's
   decision. Use the account's real publisher and manual ad-unit identifiers;
   do not invent an ads.txt entry.
2. Configure and publish the account's required consent messages. For
   personalized ads in the EEA, UK, and Switzerland, use a Google-certified CMP
   integrated with the IAB TCF, such as Google's Privacy & messaging offering.
   Review other applicable regional choices as well. This repository has no
   certified CMP or consent UI yet.
3. Integrate the selected CMP's documented signals and a working way to reopen
   choices. Fail closed when configuration or consent signals are absent,
   loading, unavailable, or denied; do not treat a homemade banner, a local
   storage boolean, or Consent Mode alone as a certified CMP. Test accept,
   decline, withdrawal, navigation, and blocked-CMP cases before any ad requests.
4. Update the shared privacy disclosure for the actual providers, purposes,
   choices, and data flows. The current advertising section accurately says
   that ads are off and no ad consent preferences exist.
5. Keep ads away from interactive controls and unreviewed content. Test the
   approved manual placement on desktop and mobile and verify that denied or
   unavailable consent leaves no ads or obstructive gaps. Do not click live ads
   or use live ad traffic for automated tests.

## References checked October 12, 2026

- [Publisher privacy disclosures and interaction policies](https://support.google.com/adsense/answer/10502938?hl=en-GB)
- [Google's consent management requirements](https://support.google.com/adsense/answer/13554116?hl=en)
- [Screens without publisher content](https://support.google.com/publisherpolicies/answer/11112688?hl=en)
- [Ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en)
- [Claude Code statusline fields](https://code.claude.com/docs/en/statusline#available-data)

The Git branch guide now describes the generated scripts' normal Git lookup
and distinguishes it from linked-worktree metadata and browser sample data.
The compilers' legacy no-Git fallback to `workspace.git_worktree` is unchanged;
the guide requires Git and does not recommend that fallback as a branch source.
