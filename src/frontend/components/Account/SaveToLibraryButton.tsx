import { FloppyDisk } from "@phosphor-icons/react";
import { navigate } from "../../lib/navigate";
import { useAuthStore } from "../../store/authStore";
import { useCloudStore } from "../../store/cloudStore";
import { useDesignStore } from "../../store/designStore";
import { Link } from "../../router";

const btn =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2 text-[13px] text-[#A8A8A4] transition-colors hover:bg-white/[0.05] hover:text-[#E8E8E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#A8A8A4] lg:px-2.5";

/**
 * Builder top-bar control: saves the design to the signed-in user's private
 * library (or a new version of the library/team design the builder is bound to).
 */
export function SaveToLibraryButton() {
  const me = useAuthStore((s) => s.me);
  const design = useDesignStore((s) => s.design);
  const { current, snapshot, saving, error, save } = useCloudStore();

  if (!me) {
    return (
      <button
        type="button"
        className={btn}
        onClick={() => navigate(`/signin?next=${encodeURIComponent("/builder")}`)}
        title="Sign in to save designs to a private library"
      >
        <FloppyDisk size={14} weight="bold" />
        <span className="sr-only lg:not-sr-only">Save</span>
      </button>
    );
  }

  const dirty = !current || snapshot !== JSON.stringify(design);
  return (
    <div className="relative">
      <button
        type="button"
        className={btn}
        disabled={saving || !dirty}
        onClick={() => void save(design)}
        title={current ? `Save a new version (currently v${current.version})` : "Save to your private library"}
      >
        <FloppyDisk size={14} weight="bold" />
        <span className="sr-only lg:not-sr-only">
          {saving ? "Saving…" : current ? (dirty ? `Save v${current.version + 1}` : `Saved v${current.version}`) : "Save to library"}
        </span>
      </button>
      {error ? (
        <div role="alert" className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[8px] border border-[#E89B9E]/30 bg-[#2a1a1c] px-3 py-2 text-[12px] text-[#E89B9E]">
          {error.message}{" "}
          {error.code === "pro_required" ? (
            <Link href="/pricing" className="underline">See Pro</Link>
          ) : error.code === "version_conflict" ? (
            <span>Reload from your <Link href="/library" className="underline">library</Link> to continue.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
