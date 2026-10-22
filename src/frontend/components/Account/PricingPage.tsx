import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { accountApi } from "../../lib/accountApi";
import { useAuthStore } from "../../store/authStore";
import { DitherGlow } from "./DitherGlow";
import { Btn, LinkBtn, Notice, Page, VerifiedBadge } from "./ui";

const FREE = [
  "Full builder and every element",
  "One-line installers for macOS, Linux, Windows",
  "Publish and fork on the community",
  "Save 3 designs to a private library",
  "Public @username and donation link",
];

const PRO: React.ReactNode[] = [
  <span key="verified">
    Verified badge on your name and designs
    <span className="ml-2.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.05] px-2.5 py-0.5 align-middle font-mono text-[12px] text-[#E8E8E6]">
      @you <VerifiedBadge size={15} />
    </span>
  </span>,
  "Permanent install links that auto-update — edit once, every install follows",
  "Private cloud library, up to 200 designs, 20 versions each with restore",
  "Team statuslines: one shared design for up to 25 people",
  "Featured slots at the top of the community gallery",
];

export function PricingPage() {
  const me = useAuthStore((s) => s.me);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = me?.plan.priceUsdPerMonth ?? 5;

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await accountApi.checkout();
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Page title="Pricing" width="max-w-[1000px]">
      <div className="grid gap-5 md:grid-cols-2">
        <Plan
          name="Free"
          price="$0"
          blurb="Everything you need to make and share a statusline."
          items={FREE}
          cta={
            me ? (
              <LinkBtn href="/builder" className="w-full">Open the builder</LinkBtn>
            ) : (
              <LinkBtn href="/signin?next=/pricing" className="w-full">Create a free account</LinkBtn>
            )
          }
        />
        <Plan
          name="Pro"
          price={`$${price}`}
          per="/ month"
          highlight
          blurb="For statuslines that live on more than one machine."
          items={PRO}
          cta={
            me?.pro.active ? (
              <LinkBtn href="/account" variant="primary" className="w-full">You're on Pro — manage plan</LinkBtn>
            ) : me ? (
              <Btn variant="primary" className="w-full" onClick={upgrade} disabled={busy || !me.billing_configured}>
                {busy ? "Opening checkout…" : `Upgrade for $${price}/month`}
              </Btn>
            ) : (
              <LinkBtn href="/signin?next=/pricing" variant="primary" className="w-full">
                Sign in to upgrade
              </LinkBtn>
            )
          }
        />
      </div>

      {me && !me.pro.active && !me.billing_configured ? (
        <div className="mt-5"><Notice tone="info">Pro checkout is not available yet. Please check back soon.</Notice></div>
      ) : null}

      {error ? (
        <div className="mt-5" role="alert" ref={(el) => el?.scrollIntoView({ block: "nearest" })}>
          <Notice>{error}</Notice>
        </div>
      ) : null}

      <div className="mt-12 grid gap-8 border-t border-white/[0.06] pt-10 md:grid-cols-3">
        <Fact title="Cancel any time">
          Manage or cancel from your account. You keep Pro until the end of the period you paid for.
        </Fact>
        <Fact title="Nothing breaks if you stop">
          Statuslines you've installed keep working. A lapsed permanent link stays live; you just can't
          edit it until you renew or switch the link off.
        </Fact>
        <Fact title="Your installs are yours">
          Anonymous one-off installs and community links behave exactly as before, with or without an account.
        </Fact>
      </div>

      <p className="mt-10 flex items-center gap-1.5 text-[13px] text-[#8A8A86]">
        <VerifiedBadge /> Pro members get a verified badge across the community.
      </p>
    </Page>
  );
}

function Plan({
  name,
  price,
  per,
  blurb,
  items,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  per?: string;
  blurb: string;
  items: React.ReactNode[];
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-[10px] border p-7 ${
        highlight ? "border-[#8FB8DA]/40 bg-[#161B20]" : "border-white/[0.06] bg-[#161618]"
      }`}
    >
      {highlight ? <DitherGlow /> : null}
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-[#8A8A86]">
          {name}
          {highlight ? <VerifiedBadge size={13} /> : null}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-mono text-5xl tracking-tight text-[#E8E8E6]">{price}</span>
          {per ? <span className="text-[13px] text-[#8A8A86]">{per}</span> : null}
        </div>
        <p className="mt-2 text-[14px] text-[#8A8A86]">{blurb}</p>
        <ul className="my-6 flex flex-1 flex-col gap-3">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-snug text-[#E8E8E6]">
              <Check size={15} weight="bold" className={`mt-0.5 shrink-0 ${highlight ? "text-[#8FB8DA]" : "text-[#8A8A86]"}`} />
              {t}
            </li>
          ))}
        </ul>
        {cta}
      </div>
    </section>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[14px] font-medium text-[#E8E8E6]">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A8A86]">{children}</p>
    </div>
  );
}
