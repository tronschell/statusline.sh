import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CaretUp } from "@phosphor-icons/react";
import { useLiquidGlass } from "./liquidGlass";

export interface AppShellProps {
  /** Elements palette, shown in the glass drawer. */
  palette: ReactNode;
  /** Main column: canvas + preview. */
  canvas: ReactNode;
  /** Right inspector column. */
  inspector: ReactNode;
  /** Slim toolbar rendered full-width above the columns (e.g. TopBar). */
  topBar?: ReactNode;
  /** When true, the inspector column shrinks to a thin rail (lg and up). */
  inspectorCollapsed?: boolean;
}

/**
 * Builder shell: toolbar row, then canvas + preview | inspector, with the Elements
 * palette as a liquid-glass drawer. Below `lg` the drawer is fixed to the bottom of the
 * viewport (above all content); at `lg+` it sticks to the bottom of the canvas column.
 * The inspector is a sticky, independently scrolling column at `lg+` (under the NavBar
 * 61px + toolbar 57px) and a stacked section below.
 */
export function AppShell({
  palette,
  canvas,
  inspector,
  topBar,
  inspectorCollapsed = false,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Drawer height: compact until the user scrolls into the list, then up to 2/3 of the
  // screen; back at the top it shrinks to fit again. (Hysteresis: grow >16px, shrink at 0.)
  const [drawerTall, setDrawerTall] = useState(false);
  const onDrawerScroll = (top: number) => {
    if (top > 16) setDrawerTall(true);
    else if (top <= 0) setDrawerTall(false);
  };
  // Compact body height: ~36% of the viewport, snapped down so the last visible row (or group
  // header) is whole rather than cut off, i.e. the number of elements shown follows viewport height.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState<number | null>(null);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // Measured while closed too (children keep their layout under max-height:0), so opening
    // animates straight to the final height instead of retargeting after the first frame.
    const measure = () => {
      const target = Math.max(120, window.innerHeight * 0.36 - 56);
      const origin = body.getBoundingClientRect().top - body.scrollTop;
      let best = 0;
      body.querySelectorAll('[aria-label^="Add "], [aria-controls^="palette-group-"]').forEach((el) => {
        const bottom = el.getBoundingClientRect().bottom - origin;
        if (bottom <= target && bottom > best) best = bottom;
      });
      setCompact(Math.round((best || target) + 10));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const glass = useLiquidGlass(22);
  const cols = inspectorCollapsed
    ? "lg:grid-cols-[minmax(0,1fr)_44px]"
    : "lg:grid-cols-[minmax(0,1fr)_336px]";
  return (
    <div className="min-h-screen w-full bg-[var(--color-canvas)] pb-24 text-[var(--color-text)] lg:pb-0">
      {topBar}
      <div
        className={`mx-auto grid max-w-[1560px] grid-cols-1 transition-[grid-template-columns] duration-200 ${cols}`}
      >
        <main className="order-1 flex min-w-0 flex-col px-4 py-8 sm:px-6 lg:order-none lg:min-h-[calc(100vh-118px)] lg:px-10 lg:py-10">
          <div className="flex flex-col gap-12">{canvas}</div>
          <div
            ref={glass.ref}
            style={glass.style}
            className="glass-box fixed inset-x-3 bottom-3 z-30 mb-[env(safe-area-inset-bottom)] overflow-hidden rounded-[22px] border border-white/[0.05] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-10px_18px_-10px_rgba(255,255,255,0.04),0_28px_56px_-18px_rgba(0,0,0,0.85),0_2px_6px_rgba(0,0,0,0.4)] lg:sticky lg:inset-x-auto lg:bottom-5 lg:mx-auto lg:mb-0 lg:mt-auto lg:w-full lg:max-w-[720px]"
          >
            {glass.filter}
            <button
              type="button"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? "Collapse elements drawer" : "Expand elements drawer"}
              className="relative flex h-14 w-full items-center justify-between px-5 text-left"
            >
              <span className="font-serif text-[22px] leading-none tracking-tight text-[#F2F2F0]">Elements</span>
              <span className="flex items-center gap-2 text-[12px] text-[#A8A8A4]">
                {drawerOpen ? "Click to add, or drag onto the canvas" : "Add to your statusline"}
                <CaretUp
                  size={14}
                  weight="bold"
                  className={`text-[#C9C9C5] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${drawerOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {/* Body scrolls inside the glass; shrinks away mid-drag (DndProvider sets data-palette-drag) so the canvas is clear. */}
            <div
              ref={bodyRef}
              onScroll={(e) => onDrawerScroll(e.currentTarget.scrollTop)}
              style={{ "--drawer-h": drawerTall ? "calc(66.6vh - 56px)" : compact ? `${compact}px` : "calc(36vh - 56px)" } as CSSProperties}
              inert={!drawerOpen}
              // Ease-out-quint: near-instant start, soft settle at the very end. Always mounted so height can animate.
              className={`relative overflow-y-auto overscroll-contain px-5 transition-[max-height,padding,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [html[data-palette-drag]_&]:max-h-0 [html[data-palette-drag]_&]:overflow-hidden [html[data-palette-drag]_&]:pb-0 ${drawerOpen ? "max-h-[var(--drawer-h)] pb-5 opacity-100" : "max-h-0 overflow-hidden pb-0 opacity-0"}`}
            >
              {palette}
            </div>
          </div>
        </main>
        <div className="order-2 min-w-0 border-t border-white/[0.06] lg:order-none lg:border-l lg:border-t-0">
          <div className="lg:sticky lg:top-[118px] lg:max-h-[calc(100vh-118px)] lg:overflow-y-auto">
            {inspector}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
