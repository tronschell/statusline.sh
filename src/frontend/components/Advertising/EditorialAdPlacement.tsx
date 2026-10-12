import { canPreviewEditorialAd } from "./advertising";

/** Local visual review only; unconfigured and deployed builds render nothing. */
export function EditorialAdPlacement({ afterSection }: { afterSection: string }) {
  if (
    typeof window === "undefined" ||
    !canPreviewEditorialAd(window.location, afterSection)
  ) return null;

  return (
    <aside
      aria-label="Advertisement layout preview"
      data-ad-layout-preview
      className="my-16 border-y border-white/[0.08] py-10"
    >
      <p className="mb-4 text-center text-[11px] uppercase tracking-[0.14em] text-[#8A8A86]">
        Advertisement
      </p>
      <div className="flex min-h-[250px] items-center justify-center border border-dashed border-white/[0.12] px-6 text-center text-[14px] leading-relaxed text-[#8A8A86]">
        Layout preview only. Advertising is disabled; no ad request is sent.
      </div>
    </aside>
  );
}
