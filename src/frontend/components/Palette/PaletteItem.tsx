import type { ComponentType } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { IconProps } from "@phosphor-icons/react";
import type { ElementType } from "../../../shared/types";
import { paletteDragId } from "../../hooks/useDnd";

export interface PaletteItemProps {
  type: ElementType;
  label: string;
  description: string;
  Icon: ComponentType<IconProps>;
}

export function PaletteItem({ type, label, description, Icon }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: paletteDragId(type) });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  } as const;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      style={style}
      className="group flex items-start gap-3 text-left px-3 py-2.5 rounded-[8px] border border-transparent hover:bg-[#1C1C1F] hover:border-white/[0.04] transition-colors duration-200 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:border-[#8FB8DA]/40"
      aria-label={`Add ${label} element`}
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
