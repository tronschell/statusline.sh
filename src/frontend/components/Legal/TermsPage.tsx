import { LegalLayout, LegalSection } from "./LegalLayout";

/**
 * /terms — straightforward terms for a free, open-source tool. Covers
 * community submissions, the install script (which writes to the user's
 * filesystem), and the standard "as-is" disclaimer that any OSS project ships.
 */
export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of service."
      subtitle="Plain-English terms for using statusline.sh. By using the site you agree to these."
      lastUpdated="May 24, 2026"
    >
      <LegalSection title="What this is">
        <p>
          statusline.sh is a free, open-source web app that lets you design,
          save, and share Claude Code statusline configurations. The source
          code is available on{" "}
          <a
            href="https://github.com/tronschell/statusline.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8FB8DA] underline-offset-2 hover:underline"
          >
            GitHub
          </a>{" "}
          under the MIT license.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          There isn't one. You don't sign up, you don't log in. Designs are
          identified by random IDs, and ownership is established by
          possession of the ID rather than by an authenticated session.
        </p>
      </LegalSection>

      <LegalSection title="Community submissions">
        <p>By publishing a design to the community, you confirm that:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            You're allowed to share what you uploaded — the design, the
            author name, and the description.
          </li>
          <li>
            You grant other visitors a non-exclusive, royalty-free right to
            view, fork, and modify your published design via the site.
          </li>
          <li>
            You won't publish content that is unlawful, harassing, or
            infringing, and you won't try to use design fields (name,
            description, glyphs, static text) to attack other users.
          </li>
        </ul>
        <p>
          We reserve the right to remove published designs that violate
          these rules, without notice.
        </p>
      </LegalSection>

      <LegalSection title="The install script">
        <p>
          The installer served at <code>/i/&lt;id&gt;.sh</code> and{" "}
          <code>/i/&lt;id&gt;.ps1</code> is a shell script that writes a
          statusline file under <code>~/.claude/</code> and structurally
          merges a <code>statusLine</code> entry into your{" "}
          <code>~/.claude/settings.json</code>. It writes a timestamped
          backup of <code>settings.json</code> before modifying it.
        </p>
        <p>
          You should read any shell script before piping it into your
          terminal — including ours. The compiled script and installer
          source are open and reproducible from the repository.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don't:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Attempt to break, overload, or probe the service for vulnerabilities outside a coordinated disclosure on GitHub.</li>
          <li>Scrape the community catalog at a rate that materially affects availability for others.</li>
          <li>Upload content designed to mislead, defraud, or harm other users.</li>
        </ul>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          statusline.sh is provided <strong>as is</strong>, without warranty
          of any kind, express or implied, including but not limited to the
          warranties of merchantability, fitness for a particular purpose,
          and non-infringement. We make no guarantees about availability,
          uptime, or data durability — back up anything you can't afford to
          lose.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, the operators and
          contributors of statusline.sh will not be liable for any
          incidental, indirect, consequential, or punitive damages arising
          from your use of the site or any installed statusline script.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these terms occasionally. Material changes will be
          reflected in the "Last updated" date above and the commit history
          of the repository. Continued use of the site after a change
          constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions, takedown requests, or security reports:{" "}
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

export default TermsPage;
