import { useEffect, useRef, useState } from "react";
import { BookmarksSimple, IdentificationBadge, SealCheck, SignIn, SignOut, UserCircle, UsersThree } from "@phosphor-icons/react";
import { navigate } from "../../lib/navigate";
import { useAuthStore } from "../../store/authStore";
import { Link } from "../../router";
import { Avatar, VerifiedBadge } from "./ui";

const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#E8E8E6] no-underline hover:bg-white/[0.04]";
const icon = { size: 15, weight: "bold" as const, className: "shrink-0 opacity-60" };

/** Account destinations + sign out; shared by the avatar dropdown and the phone nav menu. */
export function AccountLinks({ onDone, omitAccount }: { onDone(): void; omitAccount?: boolean }) {
  const me = useAuthStore((s) => s.me);
  const signOut = useAuthStore((s) => s.signOut);
  if (!me) {
    return (
      <Link href="/signin" className={item} onClick={onDone}>
        <SignIn {...icon} />
        Sign in
      </Link>
    );
  }
  const close = onDone;
  return (
    <>
      {omitAccount ? null : <Link href="/account" className={item} onClick={close}><UserCircle {...icon} />Account</Link>}
      <Link href="/library" className={item} onClick={close}><BookmarksSimple {...icon} />Library</Link>
      <Link href="/teams" className={item} onClick={close}><UsersThree {...icon} />Teams</Link>
      <Link href={`/u/${me.user.username}`} className={item} onClick={close}><IdentificationBadge {...icon} />Public profile</Link>
      {!me.pro.active ? <Link href="/pricing" className={item + " text-[#8FB8DA]"} onClick={close}><SealCheck {...icon} />Upgrade to Pro</Link> : null}
      <button
        type="button"
        className={item + " border-t border-white/[0.06]"}
        onClick={async () => {
          close();
          await signOut();
          navigate("/");
        }}
      >
        <SignOut {...icon} />
        Sign out
      </button>
    </>
  );
}

/** Right-side nav slot: "Sign in" when signed out, avatar menu when signed in. */
export function AccountMenu() {
  const me = useAuthStore((s) => s.me);
  const ready = useAuthStore((s) => s.ready);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!ready) return <span className="w-[68px]" aria-hidden="true" />;
  if (!me) {
    return (
      <Link href="/signin" className="text-[13px] text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6]">
        Sign in
      </Link>
    );
  }
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-[999px] border border-white/[0.06] py-0.5 pl-0.5 pr-0.5 transition-colors sm:pr-2.5 hover:border-white/[0.18]"
      >
        <Avatar name={me.user.display_name} url={me.user.avatar_url} size={26} />
        <span className="hidden text-[13px] text-[#E8E8E6] sm:inline">@{me.user.username}</span>
        {me.pro.active ? <VerifiedBadge size={13} /> : null}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#161618] py-1 shadow-xl">
          <AccountLinks onDone={close} />
        </div>
      ) : null}
    </div>
  );
}
