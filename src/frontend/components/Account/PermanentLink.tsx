import { useEffect, useState } from "react";
import { LinkSimple } from "@phosphor-icons/react";
import { accountApi } from "../../lib/accountApi";
import { ACCOUNTS_ENABLED } from "../../lib/config";
import { useAuthStore } from "../../store/authStore";
import { useCloudStore } from "../../store/cloudStore";
import { useDesignStore } from "../../store/designStore";
import { Link } from "../../router";

/** Id of the bound design when it has a live permanent link, else null. Used by InstallDrawer. */
export function usePermanentLinkId(): string | null {
  const me = useAuthStore((s) => s.me);
  const current = useCloudStore((s) => s.current);
  return ACCOUNTS_ENABLED && me && current?.linkEnabled ? current.id : null;
}

/**
 * Install-drawer section for permanent, auto-updating links (Pro). Signed-out
 * and Free users see what it is and where to get it; Pro users can create the
 * link from the current design in one click.
 */
export function PermanentLink() {
  const me = useAuthStore((s) => s.me);
  const design = useDesignStore((s) => s.design);
  const { current, snapshot, saving, error, save, bind } = useCloudStore();
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => setLinkErr(null), [tick]);

  if (!ACCOUNTS_ENABLED) return null;

  const box = "flex flex-col gap-2 rounded-[8px] border border-white/[0.08] bg-[#0E0E10] px-4 py-3";
  const title = (
    <div className="flex items-center gap-2 text-sm text-[#E8E8E6]">
      <LinkSimple size={14} weight="bold" className="text-[#8FB8DA]" />
      Permanent, auto-updating link
    </div>
  );

  if (!me) {
    return (
      <div className={box}>
        {title}
        <p className="text-xs text-[#8A8A86]">
          A Pro feature: install once, then every edit you save reaches that machine on its own.{" "}
          <Link href={`/signin?next=${encodeURIComponent("/builder")}`} className="text-[#8FB8DA] hover:underline">Sign in</Link>{" "}
          or <Link href="/pricing" className="text-[#8FB8DA] hover:underline">see Pro</Link>.
        </p>
      </div>
    );
  }
  if (!me.pro.active) {
    return (
      <div className={box}>
        {title}
        <p className="text-xs text-[#8A8A86]">
          Install once and every edit you save reaches that machine on its own. Part of{" "}
          <Link href="/pricing" className="text-[#8FB8DA] hover:underline">Pro</Link>.
        </p>
      </div>
    );
  }

  const live = current?.linkEnabled === true;
  const dirty = live && snapshot !== JSON.stringify(design);

  async function create() {
    setLinkErr(null);
    const cd = await save(design);
    if (cd && !cd.link_enabled) {
      try {
        bind(await accountApi.librarySetLink(cd.id, true));
      } catch (e) {
        setLinkErr(e instanceof Error ? e.message : String(e));
      }
    }
    setTick((t) => t + 1);
  }

  return (
    <div className={box}>
      {title}
      {live ? (
        <>
          <p className="text-xs text-[#8A8A86]">
            The command below is your permanent link (v{current!.version}). Installed copies check it every few hours.
          </p>
          {dirty ? (
            <div className="flex items-center justify-between gap-3 rounded-[6px] border border-[#D8B870]/30 bg-[#2E2820]/50 px-3 py-2 text-xs text-[#D8B870]">
              Unsaved edits aren't on the link yet.
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(design)}
                className="rounded-[4px] border border-white/[0.12] bg-[#1C1C1F] px-2.5 py-1 text-[#E8E8E6] hover:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Saving…" : `Publish v${current!.version + 1}`}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-xs text-[#8A8A86]">
            Saves this design to your library and gives it a link that always serves your latest version.
          </p>
          <div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void create()}
              className="rounded-[4px] border border-white/[0.06] bg-[#E8E8E6] px-3 py-1.5 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create permanent link"}
            </button>
          </div>
        </>
      )}
      {error || linkErr ? (
        <p role="alert" className="text-xs text-[#E8A08A]">
          {linkErr ?? error?.message}
        </p>
      ) : null}
    </div>
  );
}
