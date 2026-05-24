import { CaretLeft, CaretRight, SlidersHorizontal } from "@phosphor-icons/react";
import InspectorPanel from "../Inspector/InspectorPanel";

export interface CollapsibleInspectorProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Wraps InspectorPanel with a collapse toggle. When collapsed, renders a thin
 * vertical rail with an expand button so the canvas gets the full remaining
 * width. The actual column width is controlled by AppShell via the
 * `inspectorCollapsed` prop — this component just renders the right contents.
 */
export function CollapsibleInspector({
  collapsed,
  onToggle,
}: CollapsibleInspectorProps) {
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-3 py-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand inspector"
          aria-expanded="false"
          className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] text-[#E8E8E6] transition-colors hover:border-white/[0.12]"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <div className="rotate-180 [writing-mode:vertical-rl] text-[11px] uppercase tracking-wider text-[#8A8A86] flex items-center gap-1.5">
          <SlidersHorizontal size={12} weight="bold" />
          Inspector
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="-mt-1 mb-2 flex items-end justify-between gap-2">
        <span className="px-1 pb-0.5 text-xs uppercase tracking-wider text-[var(--color-text-muted)] leading-none">
          Inspector
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse inspector"
          aria-expanded="true"
          className="flex items-center justify-center w-7 h-7 rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] text-[#8A8A86] transition-colors hover:text-[#E8E8E6] hover:border-white/[0.12]"
        >
          <CaretRight size={12} weight="bold" />
        </button>
      </div>
      <InspectorPanel />
    </div>
  );
}

export default CollapsibleInspector;
