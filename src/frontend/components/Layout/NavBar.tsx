import { CaretRight } from "@phosphor-icons/react";
import { Link, usePath } from "../../router";
import { BrandArt } from "../Brand/BrandArt";

const DOCS_URL = "https://github.com/tronschell/statusline.sh/blob/main/README.md";

/**
 * Sticky top navigation. ASCII-art brand mark on the left, center links,
 * primary CTA on the right. Dark-mode minimalist per the design spec.
 */
export function NavBar() {
  const pathname = usePath();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#0E0E10]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-8 py-3">
        <Link
          href="/"
          aria-label="statusline.sh home"
          className="group flex items-center text-[#E8E8E6] no-underline opacity-90 hover:opacity-100"
        >
          <BrandArt size="xs" />
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-8 text-[13px]">
          <NavLink
            href="/community"
            active={isActive(pathname, "/community")}
            title="Browse Claude Code statusline examples"
          >
            Community
          </NavLink>
          <NavLink
            href="/how-to-make-a-claude-code-statusline"
            active={isActive(pathname, "/how-to-make-a-claude-code-statusline")}
            title="How to make a Claude Code statusline"
          >
            Guide
          </NavLink>
          <ExternalNavLink href={DOCS_URL} title="Claude Code statusline docs">
            Docs
          </ExternalNavLink>
        </nav>

        <Link
          href="/builder"
          title="Claude Code Statusline Builder"
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-4 py-2 text-[13px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
        >
          Build
          <CaretRight size={14} weight="bold" />
        </Link>
      </div>
    </header>
  );
}

function isActive(pathname: string, base: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}

interface NavLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
  title?: string;
}

function NavLink({ href, active, children, title }: NavLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      className={
        "no-underline transition-colors " +
        (active
          ? "text-[#E8E8E6] underline underline-offset-[6px] decoration-white/30"
          : "text-[#8A8A86] hover:text-[#E8E8E6]")
      }
    >
      {children}
    </Link>
  );
}

function ExternalNavLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6]"
    >
      {children}
    </a>
  );
}

export default NavBar;
