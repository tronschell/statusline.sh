import { LegalLayout, LegalSection } from "./LegalLayout";

/**
 * /privacy — tailored to what the app actually collects and stores. There is
 * no auth, no analytics, no cookies. Designs are stored server-side only when
 * the user explicitly saves or publishes; otherwise everything lives in the
 * browser via localStorage / sessionStorage.
 */
export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy."
      subtitle="statusline.sh is a free, open-source tool. We collect as little as we can and never sell what we have."
      lastUpdated="May 24, 2026"
    >
      <LegalSection title="The short version">
        <p>
          We don't ask for an account. We don't run analytics. We don't set
          tracking cookies. The only data tied to you on our servers is what
          you choose to upload — the designs you save and the optional name
          and description you attach when publishing to the community.
        </p>
      </LegalSection>

      <LegalSection title="What we store on your device">
        <p>
          The builder uses your browser's <code>localStorage</code> to keep
          your in-progress design between visits so a refresh doesn't lose
          your work, and <code>sessionStorage</code> to remember which
          design ID you most recently saved. Both stay on your device.
          Clearing your browser storage removes them.
        </p>
      </LegalSection>

      <LegalSection title="What we store on our servers">
        <p>When you click <em>Save</em>, we store:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>The JSON of your design.</li>
          <li>A random 10-character ID we generate for the design.</li>
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
          We do not associate any of this with an email address, IP address,
          or device identifier in our application database.
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

      <LegalSection title="Cookies and tracking">
        <p>
          We don't set tracking cookies. We don't run Google Analytics,
          Plausible, PostHog, Segment, or any other third-party analytics.
          We don't load third-party advertising. The site uses Google Fonts
          via CDN — that's the only third-party request the page makes.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          statusline.sh is a developer tool aimed at adults. We don't
          knowingly collect anything from children under 13.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          To remove a published design, unpublish it from the builder. To
          fully delete a saved design from our servers, open an issue on{" "}
          <a
            href="https://github.com/tronschell/statusline.sh/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8FB8DA] underline-offset-2 hover:underline"
          >
            our GitHub repository
          </a>{" "}
          with the design ID and we'll remove it. Because there are no
          accounts, we can only verify ownership by your possession of the
          ID, so don't share it publicly if you don't want others to
          request deletion.
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
