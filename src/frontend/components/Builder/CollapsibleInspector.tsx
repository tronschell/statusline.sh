import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import InspectorPanel from "../Inspector/InspectorPanel";

export interface CollapsibleInspectorProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Wraps InspectorPanel with a collapse toggle.
 *
 * At `lg+` the inspector is a column: collapsed it is a thin rail with an
 * expand caret and a vertical label; open it has a slim header with a collapse
 * caret. Below `lg` the inspector is a stacked section, so the toggle becomes a
 * full-width header row (the rail would be meaningless there). The actual
 * column width is controlled by AppShell via `inspectorCollapsed`.
 */
export function CollapsibleInspector({
  collapsed,
  onToggle,
}: CollapsibleInspectorProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Stacked (below lg): one header row that toggles the section. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand inspector" : "Collapse inspector"}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6 lg:hidden"
      >
        <span className="flex items-baseline gap-3">
          <span className="font-serif text-[24px] leading-none tracking-tight text-[#F2F2F0]">
            Inspector
          </span>
          {collapsed ? (
            <span className="text-[12px] text-[#6F6F6B]">Select an element to edit it</span>
          ) : null}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          className={`text-[#8A8A86] transition-transform duration-150 ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      {/* Column (lg+): rail when collapsed, header + panel when open. */}
      {collapsed ? (
        <div className="hidden flex-col items-center gap-4 py-4 lg:flex">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand inspector"
            aria-expanded="false"
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8A8A86] transition-colors hover:bg-white/[0.05] hover:text-[#E8E8E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <div className="rotate-180 text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B] [writing-mode:vertical-rl]">
            Inspector
          </div>
        </div>
      ) : (
        <div className="hidden items-center justify-between gap-2 px-6 pt-6 lg:flex">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
            Inspector
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse inspector"
            aria-expanded="true"
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8A8A86] transition-colors hover:bg-white/[0.05] hover:text-[#E8E8E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <CaretRight size={12} weight="bold" />
          </button>
        </div>
      )}

      {/* Below lg the panel only shows when expanded; at lg+ likewise. */}
      {collapsed ? null : <InspectorPanel />}
    </div>
  );
}

export default CollapsibleInspector;
