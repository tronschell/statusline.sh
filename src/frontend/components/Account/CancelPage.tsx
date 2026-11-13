import { useState } from "react";
import { accountApi, type Me } from "../../lib/accountApi";
import { navigate } from "../../lib/navigate";
import { useAuthStore } from "../../store/authStore";
import { Btn, LinkBtn, Notice, Page, RequireAuth, fmtDate } from "./ui";

export function CancelPage() {
  return <RequireAuth>{(me) => <CancelInner me={me} />}</RequireAuth>;
}

function CancelInner({ me }: { me: Me }) {
  const refresh = useAuthStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const { pro, plan } = me;

  const cancelled = pro.status === "cancelled";
  const pastDue = pro.status === "past_due" || pro.status === "unpaid";
  const canCancel = pro.status === "active" || pro.status === "on_trial" || pastDue;

  if (!canCancel && !(cancelled && pro.active)) {
    const neverPro = pro.status === null && !pro.active;
    return (
      <Page
        title="Cancel Pro"
        width="max-w-[640px]"
        lead={
          pro.status === null
            ? "You don't have a Pro subscription, so there is nothing to cancel."
            : `Your subscription is already ${pro.status}, so there is nothing to cancel.`
        }
      >
        <LinkBtn href={neverPro ? "/pricing" : "/account"}>{neverPro ? "See Pro" : "Back to account"}</LinkBtn>
      </Page>
    );
  }

  const until = fmtDate(cancelled ? (pro.ends_at ?? pro.until) : (pro.renews_at ?? pro.until));
  let renewal = ` Renews on ${fmtDate(pro.renews_at)}.`;
  if (pastDue) renewal = " Your last payment didn't go through.";
  if (cancelled) renewal = "";

  const onceProEnds = [
    ["Installed statuslines", "Keep working."],
    [
      "Permanent links",
      "Stay live and keep serving the last version you saved. Once Pro ends, a design with a link can't be edited unless you switch the link off, which stops its installs updating. Switching it back on needs Pro.",
    ],
    ["Private library", `Nothing is deleted. You can't save new designs while you have ${plan.freeLibraryCap} or more.`],
    [
      "Team statuslines",
      "Teams you own become read-only for everyone until you are on Pro again. Members' installs keep working. You can't create new teams.",
    ],
    [
      "Featured slots",
      "Your featured designs leave the featured row and stay published. Your picks return if you subscribe again.",
    ],
    ["Verified badge", "Comes off your name and your designs."],
    ["Publishing", `Drops from ${plan.proPublishesPerDay} community designs a day to ${plan.freePublishesPerDay}.`],
  ];
  // A failed payment leaves the end date to the billing provider, so no date is promised.
  const whatHappens = pastDue
    ? onceProEnds
    : [
        ["Pro access", `Stays on until ${until}.`],
        ...onceProEnds,
        ["Changing your mind", `You can resume any time before ${until}. After that you would subscribe again.`],
      ];

  async function run(call: () => Promise<unknown>, isResume: boolean) {
    setBusy(true);
    setError(null);
    setResumed(false);
    try {
      await call();
      await refresh();
      setResumed(isResume);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Cancel Pro" width="max-w-[640px]" lead={`Pro, $${plan.priceUsdPerMonth} a month.${renewal}`}>
      <h2 className="mb-3 text-[15px] font-medium text-[#E8E8E6]">What happens</h2>
      <dl className="border-b border-white/[0.06]">
        {whatHappens.map(([label, detail]) => (
          <div key={label} className="grid gap-1 border-t border-white/[0.06] py-3.5 sm:grid-cols-[170px_1fr] sm:gap-6">
            <dt className="text-[14px] font-medium text-[#E8E8E6]">{label}</dt>
            <dd className="text-[13px] leading-[1.55] text-[#8A8A86]">{detail}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-4">
        {cancelled || resumed ? (
          <p role="status" className="text-[15px] font-medium text-[#E8E8E6]">
            {cancelled ? `Subscription cancelled. Pro stays on until ${until}.` : "Subscription resumed."}
          </p>
        ) : null}
        {error ? <Notice>{error}</Notice> : null}
        {cancelled ? (
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" disabled={busy} onClick={() => run(accountApi.resumeSub, true)}>
              {busy ? "Resuming…" : "Resume subscription"}
            </Btn>
            <LinkBtn href="/account">Back to account</LinkBtn>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" disabled={busy} onClick={() => navigate("/account")}>
              Keep Pro
            </Btn>
            <Btn variant="danger" disabled={busy} onClick={() => run(accountApi.cancelSub, false)}>
              {busy ? "Cancelling…" : "Cancel subscription"}
            </Btn>
          </div>
        )}
      </div>
    </Page>
  );
}
