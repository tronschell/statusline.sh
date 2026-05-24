import { GithubLogoIcon } from "@phosphor-icons/react";
import { Link, usePath } from "../../router";
import { BrandArt } from "../Brand/BrandArt";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";

const GITHUB_URL = "https://github.com/tronschell/statusline.sh";

/**
 * Global site footer. Editorial 4-column layout on desktop, single column on
 * mobile. Mounted on every route except /builder (which is a full-viewport
 * workspace where a marketing footer would feel out of place).
 */
export function Footer() {
  const pathname = usePath();
  if (pathname === "/builder" || pathname.startsWith("/builder/")) return null;
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-white/[0.06] bg-[#0E0E10]">
      <div className="mx-auto max-w-[1400px] px-8 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <BrandArt size="xs" className="text-[#E8E8E6]" />
            <p className="mt-5 max-w-[36ch] text-[14px] leading-relaxed text-[#8A8A86]">
              The drag-and-drop builder for your Claude Code statusline. Free
              and open source.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-[4px] border border-white/[0.06] bg-[#161618] px-3.5 py-2 text-[13px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.12] hover:bg-[#1C1C1F]"
            >
              <GithubLogoIcon size={16} weight="fill" />
              Star on GitHub
            </a>
          </div>

          <FooterColumn title="Product">
            <FooterLink href="/builder">Builder</FooterLink>
            <FooterLink href="/community">Community</FooterLink>
            <FooterLink href="/how-to-make-a-claude-code-statusline">
              Statusline guide
            </FooterLink>
            <FooterLink href="/">Templates</FooterLink>
          </FooterColumn>

          <FooterColumn title="Project">
            <FooterExternal href={GITHUB_URL}>GitHub</FooterExternal>
            <FooterExternal href={`${GITHUB_URL}/issues`}>
              Report an issue
            </FooterExternal>
            <FooterExternal href={`${GITHUB_URL}/blob/main/README.md`}>
              Docs
            </FooterExternal>
          </FooterColumn>

          <FooterColumn title="Legal">
            <FooterLink href="/privacy">Privacy policy</FooterLink>
            <FooterLink href="/terms">Terms of service</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-8 text-[12px] text-[#8A8A86] md:flex-row md:items-center">
          <div>© {year} statusline.sh. Released under the MIT license.</div>
          <div className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>Built with</span>
            <a
              href="https://docs.claude.com/en/docs/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#E8E8E6] no-underline transition-colors hover:text-white"
            >
              <ClaudeCodeLogo size={12} title="Claude Code" />
              Claude Code
            </a>
            <span>by</span>
            <a
              href="https://www.linkedin.com/in/tron-schell-aa0856181/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8E8E6] no-underline transition-colors hover:text-white"
            >
              Tron Schell
            </a>
            <span>.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
        {title}
      </h3>
      <ul className="mt-5 space-y-3 text-[14px]">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6]"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterExternal({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6]"
      >
        {children}
      </a>
    </li>
  );
}

export default Footer;
