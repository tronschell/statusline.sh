import { LegalLayout, LegalSection } from "./LegalLayout";
import { ADVERTISING_PRIVACY } from "../Advertising/advertising";
import { Inline } from "../Guides/guideUi";
import { useEffect } from "react";

/**
 * /privacy — describes the builder, optional accounts, hosted storage,
 * subscription billing, and the analytics integrations used by the app.
 */
export function PrivacyPage() {
  useEffect(() => {
    if (window.location.hash === "#advertising") {
      document.getElementById(ADVERTISING_PRIVACY.id)?.scrollIntoView();
    }
  }, []);

  return (
    <LegalLayout
      title="Privacy policy."
      subtitle="statusline.sh has a free, open-source builder and optional accounts and Pro subscriptions."
      lastUpdated="October 13, 2026"
    >
      <LegalSection title="The short version">
        <p>
          You can use the builder without an account. If you sign in, we store
          the account information needed to provide your private library and
          other account features. If you subscribe to Pro, Lemon Squeezy
          processes the payment and we store subscription details to manage
          your access. We use Vercel Web Analytics to understand how the site
          is used. Google Analytics is paused while consent controls are being
          prepared. Advertising is currently disabled.
        </p>
      </LegalSection>

      <LegalSection title="What we store on your device">
        <p>
          The builder uses your browser's <code>localStorage</code> to keep
          your in-progress design between visits so a refresh doesn't lose
          your work, and <code>sessionStorage</code> to remember which
          design ID you most recently saved. Both stay on your device.
          Clearing your browser storage removes them. When you sign in, the
          browser also stores a session token so you can stay signed in.
        </p>
      </LegalSection>

      <LegalSection title="What we store on our servers">
        <p>When you click <em>Save</em>, we store:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>The JSON of your design.</li>
          <li>A randomly generated design ID.</li>
          <li>Created and updated timestamps.</li>
        </ul>
        <p>If you then click <em>Publish to community</em>, we also store:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>The display name you choose for the design.</li>
          <li>The author name you type (free text — use a handle if you prefer).</li>
          <li>The short description you write.</li>
          <li>A public URL slug derived from the name.</li>
          <li>A view count, incremented when the public detail page loads.</li>
          <li>A fork count, incremented when another visitor forks it.</li>
        </ul>
        <p>
          Designs saved to your private library are linked to your account,
          along with their saved versions. Publishing while signed in links
          the community design to your public profile. Team features store
          team membership and the shared design.
        </p>
      </LegalSection>

      <LegalSection title="Accounts and subscriptions">
        <p>
          Account records include your username, email address when provided,
          display name, avatar, linked sign-in provider identifiers, and session
          records. For password sign-in, we store a password hash rather than
          the password itself. Google and GitHub sign-in provide the profile
          information used to create or link your account.
        </p>
        <p>
          Lemon Squeezy processes checkout and payment information. Our
          application stores customer and subscription identifiers, subscription
          status, and renewal or end dates to determine Pro access; it does not
          store your card details. Checkout includes your internal account ID
          so the subscription can be linked to your account.
        </p>
      </LegalSection>

      <LegalSection title="What our hosting provider sees">
        <p>
          Like any website, requests to statusline.sh pass through a hosting
          provider that may log standard HTTP information (IP address, user
          agent, request path, timestamp) for operational reasons such as
          abuse prevention and uptime monitoring. We do not access or use
          those logs for marketing or profiling.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and analytics">
        <p>
          Google Analytics is currently paused: its script is not loaded and
          activity is not queued for later tracking. Before enabling it, we
          will provide consent controls. If you choose to allow Google Analytics
          (GA4, measurement ID <code>G-JDKLE4R2EV</code>), it can count page views
          and usage events. Google may set its own cookies and process your
          IP address as described in the{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8FB8DA] underline-offset-2 hover:underline"
          >
            Google privacy policy
          </a>
          . We use Vercel Web Analytics on pages other than this privacy policy.
          See{" "}
          <a
            href="https://vercel.com/docs/analytics/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8FB8DA] underline-offset-2 hover:underline"
          >
            Vercel's description of its analytics data
          </a>
          . The site uses Google Fonts via
          CDN and Cloudflare Turnstile for abuse prevention. Browser privacy
          tools and tracker blockers can limit third-party analytics requests.
        </p>
      </LegalSection>

      <LegalSection id={ADVERTISING_PRIVACY.id} title={ADVERTISING_PRIVACY.heading}>
        {ADVERTISING_PRIVACY.paragraphs.map((paragraph) => (
          <p key={paragraph}><Inline text={paragraph} /></p>
        ))}
      </LegalSection>

      <LegalSection title="Children">
        <p>
          statusline.sh is a developer tool aimed at adults. We don't
          knowingly collect anything from children under 13.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          You can delete private designs from your library. Community designs
          have no self-service edit or unpublish controls. For data-removal
          requests, contact us through{" "}
          <a
            href="https://github.com/tronschell/statusline.sh/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8FB8DA] underline-offset-2 hover:underline"
          >
            our GitHub repository
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If we change this policy in a way that materially affects what we
          collect or how we use it, we'll update the date at the top of the
          page and note the change in our GitHub repository's commit
          history.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions, requests, or concerns:{" "}
          <a
            href="https://github.com/tronschell/statusline.sh/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8FB8DA] underline-offset-2 hover:underline"
          >
            open an issue on GitHub
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export default PrivacyPage;
