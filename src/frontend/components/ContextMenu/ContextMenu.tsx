import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import type { IconProps } from "@phosphor-icons/react";

export interface ContextMenuItem {
  label: string;
  Icon?: ComponentType<IconProps>;
  onSelect: () => void;
  destructive?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Lightweight right-click menu rendered into a portal so it can escape
 * overflow-clipped containers (the terminal frame's `overflow-x-auto`).
 * Closes on outside pointer-down, Escape, or window scroll.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onScroll() {
      onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Clamp to viewport AFTER measuring so we don't render off-screen at the
  // bottom or right edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(x, window.innerWidth - rect.width - margin),
    );
    const top = Math.max(
      margin,
      Math.min(y, window.innerHeight - rect.height - margin),
    );
    setPos({ left, top });
  }, [x, y, items.length]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
      className="min-w-[180px] rounded-[8px] border border-white/[0.08] bg-[#161618] p-1 shadow-xl shadow-black/40"
    >
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            item.onSelect();
            onClose();
          }}
          className={`flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[12px] transition-colors ${
            item.destructive
              ? "text-[#E89B9E] hover:bg-[#3A1F21]/40"
              : "text-[#E8E8E6] hover:bg-white/[0.04]"
          }`}
        >
          {item.Icon ? <item.Icon size={13} weight="bold" /> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

export default ContextMenu;
