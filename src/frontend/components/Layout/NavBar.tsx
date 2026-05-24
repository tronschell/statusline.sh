import { Link, usePath } from "../../router";
import { BrandArt } from "../Brand/BrandArt";

/**
 * Sticky top navigation. ASCII-art brand mark on the left, three center
 * links, primary CTA on the right. Dark-mode minimalist per the design spec.
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
          <NavLink href="/builder" active={isActive(pathname, "/builder")}>
            Build
          </NavLink>
          <NavLink
            href="/community"
            active={isActive(pathname, "/community")}
          >
            Community
          </NavLink>
          <NavLink href="/" active={false}>
            Docs
          </NavLink>
        </nav>

        <Link
          href="/builder"
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] no-underline transition-transform hover:scale-[0.98]"
        >
          New statusline
          <span aria-hidden="true">{"→"}</span>
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
}

function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link
      href={href}
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

export default NavBar;
