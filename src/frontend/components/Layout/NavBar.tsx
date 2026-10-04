import { useEffect, useState } from "react";
import { BookOpenText, CaretRight, FileText, Globe, List, SignIn, SignOut, Tag, X } from "@phosphor-icons/react";
import { Link, usePath } from "../../router";
import { BrandArt } from "../Brand/BrandArt";
import { AccountMenu } from "../Account/AccountMenu";
import { navigate } from "../../lib/navigate";
import { Avatar, VerifiedBadge } from "../Account/ui";
import { useAuthStore } from "../../store/authStore";
import { useLiquidGlass } from "./liquidGlass";
import { ACCOUNTS_ENABLED } from "../../lib/config";

const DOCS_URL = "https://github.com/tronschell/statusline.sh/blob/main/README.md";

/**
 * Sticky top navigation. ASCII-art brand mark on the left, center links,
 * primary CTA on the right. Dark-mode minimalist per the design spec.
 */
export function NavBar() {
  const pathname = usePath();
  const me = useAuthStore((s) => s.me);
  const signOut = useAuthStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);
  const glass = useLiquidGlass(22);
  // Close after navigating, and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [menuOpen]);
  const links = [
    { href: "/community", title: "Browse Claude Code statusline examples", label: "Community", icon: Globe },
    { href: "/how-to-make-a-claude-code-statusline", title: "How to make a Claude Code statusline", label: "Guide", icon: BookOpenText },
    ...(ACCOUNTS_ENABLED ? [{ href: "/pricing", title: "Statusline.sh Pro pricing", label: "Pricing", icon: Tag }] : []),
    { href: DOCS_URL, title: "Claude Code statusline docs", label: "Docs", icon: FileText, external: true },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#0E0E10]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8">
        <Link
          href="/"
          aria-label="statusline.sh home"
          className="group flex items-center text-[#E8E8E6] no-underline opacity-90 hover:opacity-100"
        >
          <BrandArt size="xs" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 text-[13px] sm:flex">
          {links.map((l) =>
            l.external ? (
              <ExternalNavLink key={l.href} href={l.href} title={l.title}>
                {l.label}
              </ExternalNavLink>
            ) : (
              <NavLink key={l.href} href={l.href} active={isActive(pathname, l.href)} title={l.title}>
                {l.label}
              </NavLink>
            ),
          )}
        </nav>

        {/* Wrapper is layout-neutral (contents) from sm up; on phones it pins menu + account + CTA to one row. */}
        <div className="ml-auto flex items-center gap-3 sm:contents">
          {ACCOUNTS_ENABLED ? <div className="hidden sm:block"><AccountMenu /></div> : null}

          <Link
            href="/builder"
            title="Claude Code Statusline Builder"
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E8E8E6] px-4 py-2 text-[13px] font-medium text-[#0E0E10] no-underline transition-transform duration-150 ease-out hover:scale-[0.98] active:scale-[0.96]"
          >
            Build
            <CaretRight size={14} weight="bold" />
          </Link>

          {/* Phones: links + account live in a glass panel (rendered below, outside the header's own backdrop blur). */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[6px] text-[#A8A8A4] transition-colors hover:text-[#E8E8E6] sm:hidden"
          >
            {menuOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>
        </div>
      </div>
    </header>
    {menuOpen ? <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setMenuOpen(false)} aria-hidden /> : null}
    {/* Always mounted so it can wipe out as well as in: clip-path animates the reveal, visibility flips after the wipe-out. */}
    <div
      ref={glass.ref}
      aria-hidden={!menuOpen}
      style={{
        ...glass.style,
        clipPath: menuOpen ? "inset(0 -40px -60px -40px)" : "inset(0 -40px 100% -40px)",
        visibility: menuOpen ? "visible" : "hidden",
        transition: `clip-path 192ms cubic-bezier(0.22,1,0.36,1), visibility 0s linear ${menuOpen ? 0 : 192}ms`,
      }}
      className="glass-box fixed inset-x-0 top-[61px] z-50 max-h-[calc(100svh-61px)] overflow-y-auto rounded-b-[22px] bg-white/[0.045] px-5 pb-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_28px_56px_-18px_rgba(0,0,0,0.85),0_2px_6px_rgba(0,0,0,0.4)] sm:hidden"
    >
      {glass.filter}
      {/* Same pattern as Linear/Stripe: one column of large rows, hairlines between, account as plain rows below. */}
      <nav className="relative flex flex-col text-[18px] [&>*]:flex [&>*]:items-center [&>*]:rounded-none [&>*]:border-b [&>*]:border-white/[0.07] [&>*]:px-0 [&>*]:py-3.5 [&>*]:text-[18px] [&>*]:no-underline [&>button]:w-full [&>*]:gap-3 [&>*]:text-left">
        {links.map((l) => {
          const cls = isActive(pathname, l.href) && !l.external ? "text-[#F2F2F0]" : "text-[#C9C9C5] hover:text-[#F2F2F0]";
          return l.external ? (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
              <l.icon size={18} weight="bold" className="shrink-0 opacity-60" />
              {l.label}
            </a>
          ) : (
            <Link key={l.href} href={l.href} className={cls}>
              <l.icon size={18} weight="bold" className="shrink-0 opacity-60" />
              {l.label}
            </Link>
          );
        })}
        {ACCOUNTS_ENABLED ? (
          me ? (
            <>
              <Link href="/account" onClick={() => setMenuOpen(false)} className="text-[#F2F2F0]">
                <Avatar name={me.user.display_name} url={me.user.avatar_url} size={24} />
                <span className="truncate">@{me.user.username}</span>
                {me.pro.active ? <VerifiedBadge size={14} /> : null}
              </Link>
              <button
                type="button"
                className="text-[#C9C9C5] hover:text-[#F2F2F0]"
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                  navigate("/");
                }}
              >
                <SignOut size={18} weight="bold" className="shrink-0 text-[#E89B9E]" />
                Sign out
              </button>
            </>
          ) : (
            <Link href="/signin" className="text-[#F2F2F0]">
              <SignIn size={18} weight="bold" className="shrink-0 opacity-60" />
              Sign in
            </Link>
          )
        ) : null}
      </nav>
    </div>
    </>
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
