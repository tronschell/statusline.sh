import type { ReactNode } from "react";

export interface AppShellProps {
  /** Left palette pane (220px). */
  palette: ReactNode;
  /** Center canvas + preview stack (flex-1). */
  canvas: ReactNode;
  /** Right inspector pane (320px when open, ~56px when collapsed). */
  inspector: ReactNode;
  /** Optional top bar (e.g. TopBar) rendered above the bento grid. */
  topBar?: ReactNode;
  /** When true, the inspector column collapses to a thin rail. */
  inspectorCollapsed?: boolean;
}

/**
 * Bento 3-pane shell for the builder route.
 *
 * Vertical macro-padding `py-12`, max-width `1400px`, gap `gap-6`.
 * Each pane: `rounded-[10px] border border-white/[0.06] bg-[#161618]`.
 * Palette / inspector use `p-6`; canvas uses `p-8` (slightly more breathing
 * room for the live preview).
 */
export function AppShell({
  palette,
  canvas,
  inspector,
  topBar,
  inspectorCollapsed = false,
}: AppShellProps) {
  const gridCols = inspectorCollapsed
    ? "grid-cols-[240px_1fr_56px]"
    : "grid-cols-[240px_1fr_320px]";
  return (
    <div className="min-h-screen w-full bg-[var(--color-canvas)] text-[var(--color-text)]">
      <div className="mx-auto max-w-[1400px] px-8 py-12">
        {topBar ? <div className="mb-8">{topBar}</div> : null}
        <div className={`grid ${gridCols} items-start gap-6 transition-[grid-template-columns] duration-200`}>
          <aside className="sticky top-20 max-h-[calc(100vh-6rem)] self-start overflow-y-auto rounded-[10px] border border-white/[0.06] bg-[#161618] p-5">
            {palette}
          </aside>
          <main className="min-w-0 rounded-[10px] border border-white/[0.06] bg-[#161618] p-8">
            <div className="flex flex-col gap-6">{canvas}</div>
          </main>
          <aside
            className={`sticky top-20 max-h-[calc(100vh-6rem)] self-start overflow-y-auto rounded-[10px] border border-white/[0.06] bg-[#161618] ${
              inspectorCollapsed ? "p-2" : "p-5"
            }`}
          >
            {inspector}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
