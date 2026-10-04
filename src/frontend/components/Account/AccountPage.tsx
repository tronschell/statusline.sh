import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BookmarksSimple, CaretRight, GearSix, IdentificationBadge, SignOut, UsersThree } from "@phosphor-icons/react";
import { accountApi, type Me, type MyDesign } from "../../lib/accountApi";
import { useAuthStore } from "../../store/authStore";
import { navigate } from "../../lib/navigate";
import { Link } from "../../router";
import { Avatar, Btn, Field, LinkBtn, Notice, Page, RequireAuth, VerifiedBadge, fmtDate, inputClass } from "./ui";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Settings-style row: label + blurb on the left, content on the right, hairline above. */
function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-white/[0.06] py-8 md:grid-cols-[220px_1fr] md:gap-10">
      <div>
        <h2 className="text-[15px] font-medium tracking-tight text-[#E8E8E6]">{title}</h2>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-[#8A8A86]">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Native <details> toggle for things people rarely need; keeps the page short. */
function Disclosure({ summary, hint, defaultOpen, children }: { summary: string; hint?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] text-[#A8A8A4] transition-colors hover:text-[#E8E8E6] [&::-webkit-details-marker]:hidden">
        <CaretRight size={12} weight="bold" className="transition-transform group-open:rotate-90" />
        <span>{summary}</span>
        {hint ? <span className="text-[#6F6F6B]">{hint}</span> : null}
      </summary>
      <div className="mt-4 pl-5">{children}</div>
    </details>
  );
}

export function AccountPage() {
  return <RequireAuth>{(me) => <AccountInner me={me} />}</RequireAuth>;
}

function AccountInner({ me }: { me: Me }) {
  const signOut = useAuthStore((s) => s.signOut);
  const params = new URLSearchParams(window.location.search);
  const justPaid = params.get("checkout") === "success";
  const justReset = params.get("reset") === "1";
  const [editing, setEditing] = useState(false);

  return (
    <Page
      eyebrow="Account"
      title={`@${me.user.username}`}
      lead={me.pro.active ? <span className="inline-flex items-center gap-1.5"><VerifiedBadge /> Pro member</span> : "Free plan"}
      actions={
        <>
          <Btn
            variant="ghost"
            className={`!px-2 ${editing ? "!text-[#E8E8E6]" : ""}`}
            aria-label="Edit profile"
            aria-expanded={editing}
            title="Edit profile"
            onClick={() => setEditing((e) => !e)}
          >
            <GearSix size={16} weight="bold" />
          </Btn>
          <LinkBtn href="/library"><BookmarksSimple size={15} weight="bold" className="opacity-60" />Library</LinkBtn>
          <LinkBtn href="/teams"><UsersThree size={15} weight="bold" className="opacity-60" />Teams</LinkBtn>
          <LinkBtn href={`/u/${me.user.username}`}><IdentificationBadge size={15} weight="bold" className="opacity-60" />Public profile</LinkBtn>
          <Btn
            variant="ghost"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <SignOut size={15} weight="bold" className="opacity-60" />
            Sign out
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {justReset ? <Notice tone="ok">Password updated. Your other sessions were signed out.</Notice> : null}
        {justPaid ? <CheckoutWatcher /> : null}
      </div>
      <div className={justReset || justPaid ? "mt-4" : ""}>
        {editing ? <ProfileCard me={me} /> : null}
        <SubscriptionCard me={me} awaitingPayment={justPaid && !me.pro.active} />
        <PublishedCard me={me} />
        <SecurityCard me={me} />
      </div>
    </Page>
  );
}

/** After Lemon Squeezy redirects back, the webhook may lag a few seconds — poll /me until Pro shows up. */
function CheckoutWatcher() {
  const refresh = useAuthStore((s) => s.refresh);
  const active = useAuthStore((s) => s.me?.pro.active ?? false);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (active) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      void refresh();
      if (n >= 15) {
        clearInterval(t);
        setGaveUp(true);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [active, refresh]);
  if (active) return <Notice tone="ok">Payment confirmed — welcome to Pro.</Notice>;
  return gaveUp ? (
    <Notice tone="info">
      Payment received, but confirmation is taking longer than usual. Refresh in a minute; if Pro still hasn't
      appeared, your payment provider's receipt has the details to send us.
    </Notice>
  ) : (
    <Notice tone="info">Confirming your payment…</Notice>
  );
}

function SubscriptionCard({ me, awaitingPayment }: { me: Me; awaitingPayment: boolean }) {
  const refresh = useAuthStore((s) => s.refresh);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { pro, plan } = me;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const openPortal = (which: "url" | "update_payment_method_url") =>
    run(which, async () => {
      const r = await accountApi.portal();
      const url = which === "url" ? r.url : (r.update_payment_method_url ?? r.url);
      window.location.assign(url);
    });

  const cancelled = pro.status === "cancelled";
  const pastDue = pro.status === "past_due" || pro.status === "unpaid";
  const hasSub = pro.status !== null;
  const canCancel = hasSub && (pro.status === "active" || pro.status === "on_trial" || pastDue);

  let summary: string;
  if (!hasSub) summary = pro.active ? `Pro is active until ${fmtDate(pro.until)}.` : "You're on the Free plan.";
  else if (cancelled && pro.active) summary = `Cancelled — Pro stays on until ${fmtDate(pro.ends_at ?? pro.until)}.`;
  else if (cancelled) summary = `Your Pro plan ended on ${fmtDate(pro.ends_at ?? pro.until)}.`;
  else if (pastDue) summary = "Your last payment didn't go through. Update your payment method to keep Pro.";
  else if (pro.active) summary = `Pro is active. Renews on ${fmtDate(pro.renews_at)}.`;
  else summary = `Subscription status: ${pro.status}.`;

  const checkoutBtn =
    !pro.active && !pastDue && !awaitingPayment ? (
      // Hidden while a just-paid checkout awaits its webhook, so nobody pays twice.
      <Btn
        variant="primary"
        disabled={busy !== null}
        onClick={() =>
          run("checkout", async () => {
            window.location.assign((await accountApi.checkout()).url);
          })
        }
      >
        {busy === "checkout" ? "Opening checkout…" : cancelled ? "Resubscribe" : `Upgrade to Pro — $${plan.priceUsdPerMonth}/mo`}
      </Btn>
    ) : null;

  const paymentBtn = hasSub ? (
    <Btn variant={pastDue ? "primary" : "secondary"} disabled={busy !== null} onClick={() => openPortal("update_payment_method_url")}>
      Update payment method
    </Btn>
  ) : null;

  const resumeBtn =
    cancelled && pro.active ? (
      <Btn
        variant="primary"
        disabled={busy !== null}
        onClick={() =>
          run("resume", async () => {
            await accountApi.resumeSub();
            await refresh();
            setInfo("Subscription resumed.");
          })
        }
      >
        Resume subscription
      </Btn>
    ) : null;

  return (
    <Section title="Plan" description="Your subscription and billing.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${
              pro.active ? "border-[#8FB8DA]/40 text-[#8FB8DA]" : "border-white/[0.1] text-[#8A8A86]"
            }`}
          >
            {pro.active ? "Pro" : "Free"}
          </span>
          <span className="text-[14px] text-[#E8E8E6]">{summary}</span>
        </div>

        {!pro.active && !cancelled && !hasSub ? (
          <p className="max-w-[60ch] text-[13px] leading-relaxed text-[#8A8A86]">
            Pro is ${plan.priceUsdPerMonth}/month: permanent auto-updating links, a {plan.proLibraryCap}-design private
            library, teams, featured slots and a verified badge. <Link href="/pricing" className="text-[#E8E8E6] underline underline-offset-[4px]">See what's included</Link>.
          </p>
        ) : null}

        {checkoutBtn || resumeBtn || (pastDue && paymentBtn) ? (
          <div className="flex flex-wrap gap-2">
            {checkoutBtn}
            {resumeBtn}
            {pastDue ? paymentBtn : null}
          </div>
        ) : null}

        {hasSub ? (
          <Disclosure summary="Manage billing">
            <div className="flex flex-wrap gap-2">
              <Btn disabled={busy !== null} onClick={() => openPortal("url")}>
                {busy === "url" ? "Opening…" : "Billing & invoices"}
              </Btn>
              {!pastDue ? paymentBtn : null}
              {canCancel && !cancelled ? (
                <Btn
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`Cancel Pro? You keep it until ${fmtDate(pro.renews_at ?? pro.until)}.`)) return;
                    void run("cancel", async () => {
                      await accountApi.cancelSub();
                      await refresh();
                      setInfo("Subscription cancelled. Pro stays on until the end of the period you paid for.");
                    });
                  }}
                >
                  Cancel subscription
                </Btn>
              ) : null}
            </div>
          </Disclosure>
        ) : null}

        {!me.billing_configured ? <Notice tone="info">Billing isn't enabled on this server yet.</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
      </div>
    </Section>
  );
}

function ProfileCard({ me }: { me: Me }) {
  const refresh = useAuthStore((s) => s.refresh);
  const [username, setUsername] = useState(me.user.username);
  const [displayName, setDisplayName] = useState(me.user.display_name);
  const [donation, setDonation] = useState(me.user.donation_url ?? "");
  const [avail, setAvail] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | null>(null);
  const lastSaved = useRef({ u: me.user.username, d: me.user.display_name, l: me.user.donation_url ?? "" });
  const seq = useRef(0);

  // Debounced availability check for the username field.
  useEffect(() => {
    setAvail(null);
    const u = username.trim().toLowerCase();
    if (!u || u === me.user.username) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      accountApi
        .usernameAvailable(u)
        .then((r) => {
          if (mine === seq.current)
            setAvail(r.available ? { ok: true, text: "Available" } : { ok: false, text: r.reason ?? "Not available" });
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [username, me.user.username]);

  // Autosave once typing pauses; the server re-validates, so a bad value just shows its error.
  useEffect(() => {
    const u = username.trim();
    const d = displayName.trim();
    const l = donation.trim();
    const s = lastSaved.current;
    if (!u || !d || avail?.ok === false || (u === s.u && d === s.d && l === s.l)) return;
    setStatus(null);
    const t = setTimeout(async () => {
      setStatus("saving");
      setError(null);
      try {
        await accountApi.updateMe({ username: u, display_name: d, donation_url: l || null });
        lastSaved.current = { u, d, l };
        await refresh();
        setStatus("saved");
      } catch (err) {
        setError(errMsg(err));
        setStatus(null);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [username, displayName, donation, avail, refresh]);

  return (
    <Section title="Profile" description="Your @username and display name appear on everything you publish.">
      <form onSubmit={(e) => e.preventDefault()} className="grid gap-5">
        <div className="flex items-start gap-4">
          <Avatar name={me.user.display_name} url={me.user.avatar_url} size={44} />
          <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2">
            <Field
              label="Username"
              hint={
                avail ? (
                  <span className={avail.ok ? "text-[#9CC09F]" : "text-[#E89B9E]"}>{avail.text}</span>
                ) : (
                  "3–30 characters: letters, numbers, - and _."
                )
              }
            >
              <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} autoComplete="off" />
            </Field>
            <Field label="Display name">
              <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
            </Field>
          </div>
        </div>
        <Disclosure summary="Donation link" hint="optional" defaultOpen={Boolean(me.user.donation_url)}>
          <Field label="Link" hint="GitHub Sponsors, Ko-fi, Buy Me a Coffee, PayPal.me… any https link. Shows on your profile and design pages. Leave blank to hide.">
            <input className={inputClass} type="url" placeholder="https://ko-fi.com/you" value={donation} onChange={(e) => setDonation(e.target.value)} maxLength={300} />
          </Field>
        </Disclosure>
        <div className="h-4 text-[13px] text-[#8A8A86]">
          {status === "saving" ? "Saving…" : status === "saved" ? <span className="text-[#9CC09F]">Saved</span> : null}
        </div>
        {error ? <Notice>{error}</Notice> : null}
      </form>
    </Section>
  );
}

function SecurityCard({ me }: { me: Me }) {
  const refresh = useAuthStore((s) => s.refresh);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const { account } = me;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await accountApi.changePassword(account.has_password ? current : undefined, next);
      setCurrent("");
      setNext("");
      setOk(true);
      await refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Sign-in & security" description="How you get into this account.">
      <div className="flex flex-col gap-5">
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">Email</dt>
            <dd className="mt-1 text-[#E8E8E6]">
              {account.email ?? "None on file"}
              {account.email && !account.email_verified ? <span className="ml-2 text-[#D8B870]">unverified</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">Connected</dt>
            <dd className="mt-1 text-[#E8E8E6]">
              {[...account.providers.map((p) => (p === "github" ? "GitHub" : "Google")), ...(account.has_password ? ["Password"] : [])].join(", ") || "—"}
            </dd>
          </div>
        </dl>
        <Disclosure summary={account.has_password ? "Change password" : "Set a password"}>
          <form onSubmit={submit} className="grid max-w-[420px] gap-4">
            {account.has_password ? (
              <Field label="Current password">
                <input className={inputClass} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
              </Field>
            ) : null}
            <Field label={account.has_password ? "New password" : "Password"} hint="At least 8 characters. Other devices are signed out.">
              <input className={inputClass} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
            </Field>
            {error ? <Notice>{error}</Notice> : null}
            {ok ? <Notice tone="ok">Password updated.</Notice> : null}
            <div>
              <Btn type="submit" disabled={busy}>
                {busy ? "Saving…" : account.has_password ? "Change password" : "Set password"}
              </Btn>
            </div>
          </form>
        </Disclosure>
      </div>
    </Section>
  );
}

function PublishedCard({ me }: { me: Me }) {
  const [data, setData] = useState<{ items: MyDesign[]; featured_count: number; featured_cap: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = () => accountApi.myDesigns().then(setData).catch((e) => setError(errMsg(e)));
  useEffect(() => {
    void load();
  }, []);

  async function toggle(d: MyDesign) {
    setError(null);
    try {
      await accountApi.setFeatured(d.id, !d.featured);
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const items = data?.items ?? [];
  const shown = showAll ? items : items.slice(0, 5);

  return (
    <Section
      title="Published designs"
      description={
        me.pro.active
          ? `Feature up to ${data?.featured_cap ?? me.plan.featuredCap} at the top of the community gallery.${data ? ` ${data.featured_count} in use.` : ""}`
          : "Designs you publish while signed in show here. Featuring them is part of Pro."
      }
    >
      {error ? <Notice>{error}</Notice> : null}
      {data && items.length === 0 ? (
        <p className="text-[13px] text-[#8A8A86]">
          Nothing published yet. Publish from the <Link href="/builder" className="text-[#E8E8E6] underline underline-offset-[4px]">builder</Link> while signed in and it appears here under your name.
        </p>
      ) : null}
      <ul className="-mt-3 divide-y divide-white/[0.05]">
        {shown.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <Link href={`/community/${d.slug}`} className="truncate text-[14px] text-[#E8E8E6] no-underline hover:underline">
                {d.name}
              </Link>
              <div className="mt-0.5 text-[12px] text-[#6F6F6B]">
                {fmtDate(d.published_at)} · {d.installs} installs · {d.forks} forks · {d.views} views
              </div>
            </div>
            <Btn variant={d.featured ? "primary" : "secondary"} disabled={!me.pro.active && !d.featured} onClick={() => void toggle(d)}>
              {d.featured ? "Featured" : "Feature"}
            </Btn>
          </li>
        ))}
      </ul>
      {items.length > 5 ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[13px] text-[#A8A8A4] transition-colors hover:text-[#E8E8E6]">
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </Section>
  );
}
