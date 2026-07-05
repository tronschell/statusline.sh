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

  // A stationary click (the PointerSensor has a 4px activation distance, so it
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
      className="group flex items-start gap-3 text-left px-3 py-2.5 rounded-[8px] border border-transparent hover:bg-[#1C1C1F] hover:border-white/[0.04] transition-colors duration-200 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:border-[#8FB8DA]/40"
      aria-label={`Add ${label} element`}
      title={`Add ${label} — click, or drag onto the canvas`}
    >
      <span className="mt-0.5 text-[#E8E8E6] shrink-0">
        <Icon size={16} weight="bold" />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[13px] text-[#E8E8E6] leading-tight">
          {label}
        </span>
        <span className="text-[11px] text-[#8A8A86] leading-snug mt-0.5 truncate">
          {description}
        </span>
      </span>
    </button>
  );
}
