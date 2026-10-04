import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { SealCheck } from "@phosphor-icons/react";
import { navigate } from "../../lib/navigate";
import { useAuthStore } from "../../store/authStore";
import { ACCOUNTS_ENABLED } from "../../lib/config";
import { Link } from "../../router";
import { DitherGlow } from "./DitherGlow";

export const inputClass =
  "w-full rounded-[6px] border border-white/[0.08] bg-[#0E0E10] px-3 py-2 text-[14px] text-[#E8E8E6] placeholder:text-[#5A5A57] transition-colors hover:border-white/[0.16] focus:border-[#8FB8DA] focus:outline-none disabled:opacity-50";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-[#E8E8E6] text-[#0E0E10] border-transparent",
  secondary: "bg-[#1C1C1F] text-[#E8E8E6] border-white/[0.08] hover:border-white/[0.18]",
  danger: "bg-transparent text-[#E89B9E] border-[#E89B9E]/30 hover:bg-[#3A1F21]/40",
  ghost: "bg-transparent text-[#8A8A86] border-transparent hover:text-[#E8E8E6]",
};

export function Btn({
  variant = "secondary",
  className = "",
  dither = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; dither?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={dither ? () => setHover(true) : undefined}
      onMouseLeave={dither ? () => setHover(false) : undefined}
      {...rest}
      className={`${dither ? "relative overflow-hidden " : ""}inline-flex items-center justify-center gap-1.5 rounded-[6px] border px-3.5 py-2 text-[13px] font-medium transition-transform duration-150 hover:scale-[0.98] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${variants[variant]} ${className}`}
    >
      {dither && hover && !rest.disabled ? <DitherGlow className="h-full animate-[fadein_200ms_ease-out]" /> : null}
      {dither ? <span className="relative">{children}</span> : children}
    </button>
  );
}

/** Anchor styled like <Btn> for in-app navigation. */
export function LinkBtn({
  href,
  variant = "secondary",
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[6px] border px-3.5 py-2 text-[13px] font-medium no-underline transition-transform duration-150 hover:scale-[0.98] ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[#8A8A86]">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-[#6F6F6B]">{hint}</span> : null}
    </label>
  );
}

export function Notice({
  tone = "error",
  children,
}: {
  tone?: "error" | "ok" | "info";
  children: ReactNode;
}) {
  const t = {
    error: "border-[#E89B9E]/30 bg-[#3A1F21]/30 text-[#E89B9E]",
    ok: "border-[#9CC09F]/30 bg-[#1E2A22]/40 text-[#9CC09F]",
    info: "border-white/[0.08] bg-[#161618] text-[#A8A8A4]",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-[8px] border px-3.5 py-2.5 text-[13px] ${t}`}>
      {children}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  right,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-white/[0.06] bg-[#161618] p-6">
      {title ? (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-medium tracking-tight text-[#E8E8E6]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-[#8A8A86]">{description}</p>
            ) : null}
          </div>
          {right}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Page({
  eyebrow,
  title,
  lead,
  actions,
  children,
  width = "max-w-[960px]",
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <div className={`mx-auto px-6 pb-24 pt-14 md:px-8 md:pt-20 ${width}`}>
        <header className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? (
              <div className="text-[12px] uppercase tracking-[0.16em] text-[#8A8A86]">{eyebrow}</div>
            ) : null}
            <h1
              className="mt-2 text-4xl leading-[1.08] tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)" }}
            >
              {title}
            </h1>
            {lead ? (
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-[#8A8A86]">{lead}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

/** Blue seal shown next to the name of an active Pro member. */
export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span title="Verified — Pro member" aria-label="Verified" className="inline-flex align-middle text-[#8FB8DA]">
      <SealCheck size={size} weight="bold" />
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 28,
}: {
  name: string;
  url?: string;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full border border-white/[0.08] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#1C1C1F] text-[#A8A8A4]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

/**
 * Gate for account pages: renders children only for a signed-in user. When the
 * accounts feature flag is off the route behaves like any unknown page.
 */
export function RequireAuth({ children }: { children: (me: NonNullable<ReturnType<typeof useAuthStore.getState>["me"]>) => ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const ready = useAuthStore((s) => s.ready);
  useEffect(() => {
    if (ACCOUNTS_ENABLED && ready && !me) {
      navigate(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [ready, me]);
  if (!ACCOUNTS_ENABLED) return null;
  if (!me) return <div className="min-h-screen bg-[#0E0E10] px-8 pt-24 text-[13px] text-[#8A8A86]">Loading…</div>;
  return <>{children(me)}</>;
}

/** Copy-to-clipboard button with transient "Copied" state. */
export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Btn
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // clipboard blocked
        }
      }}
    >
      {done ? "Copied" : label}
    </Btn>
  );
}
