import { useEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { accountApi } from "../../lib/accountApi";
import { useAuthStore } from "../../store/authStore";
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
              <Btn variant="primary" className="w-full" onClick={upgrade} disabled={busy}>
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

// Bayer 4x4 ordered-dither thresholds (0..15)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CELL = 3; // CSS px per dither cell

/** Blue glow rising from the bottom edge to ~half the card, rendered as an ordered dither. */
function DitherGlow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 60) return; // ~16fps is plenty for a slow shimmer
      last = now;
      const img = ctx.createImageData(cols, rows);
      const t = still ? 0 : now / 1800;
      for (let y = 0; y < rows; y++) {
        // 0 at the top of the canvas (half-way up the card) → 1 at the bottom edge
        const v = y / (rows - 1);
        for (let x = 0; x < cols; x++) {
          const wave = 0.1 * Math.sin(x * 0.11 + t + y * 0.06) + 0.06 * Math.sin(x * 0.037 - t * 0.7);
          const level = Math.pow(v, 2.2) * 0.8 + wave * v * 0.6;
          if (level > (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16) {
            const i = (y * cols + x) * 4;
            img.data[i] = 95;
            img.data[i + 1] = 165;
            img.data[i + 2] = 240;
            img.data[i + 3] = 45 + 95 * v;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      if (still) cancelAnimationFrame(raf);
    };

    const size = () => {
      cancelAnimationFrame(raf);
      cols = Math.ceil(canvas.clientWidth / CELL);
      rows = Math.ceil(canvas.clientHeight / CELL);
      canvas.width = cols;
      canvas.height = rows;
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    size();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#5FA5F0]/[0.10] to-transparent"
      />
      <canvas
        ref={ref}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full [image-rendering:pixelated]"
      />
    </>
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
