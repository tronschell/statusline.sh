import type { ComponentType, KeyboardEvent, MouseEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { IconProps } from "@phosphor-icons/react";
import type { ElementType } from "@statusline/shared/types";
import { useDesignStore } from "../../store/designStore";
import { paletteDragId } from "../../hooks/useDnd";

export interface PaletteItemProps {
  type: ElementType;
  label: string;
  description: string;
  Icon: ComponentType<IconProps>;
}

export function PaletteItem({ type, label, description, Icon }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({ id: paletteDragId(type) });

  // DragOverlay in DndProvider renders the cursor-following visual, so the
  // source button must stay put. Applying CSS.Translate here would translate
  // the entire pane sideways (the bug fix this avoids).
  const style = {
    opacity: isDragging ? 0.4 : 1,
  } as const;

  function add() {
    useDesignStore.getState().addElement(type);
  }

  // A stationary click (the MouseSensor has a 4px activation distance, so it
  // never starts a drag) appends the element. `defaultPrevented` is set by the
  // drag pipeline on the trailing click after a real drag, so this guard stops
  // a drag-drop from also firing an append. Mirrors ElementChip's click guard.
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (e.defaultPrevented) return;
    add();
  }

  // dnd-kit's KeyboardSensor listener (spread via `listeners`) would otherwise
  // grab Enter/Space to begin a keyboard drag and preventDefault the native
  // button click. Overriding onKeyDown here makes the keyboard behaviour a
  // plain "add" instead, which is what users expect from the palette.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      add();
    }
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={style}
      className="group -mx-2 flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-[13px] text-[#C9C9C5] transition-colors duration-150 cursor-grab hover:bg-white/[0.04] hover:text-[#F2F2F0] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label={`Add ${label} element`}
      title={`${description}. Click to add, or drag onto the canvas`}
    >
      <Icon size={14} weight="bold" className="shrink-0 text-[#6F6F6B] transition-colors group-hover:text-[#E8E8E6]" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
