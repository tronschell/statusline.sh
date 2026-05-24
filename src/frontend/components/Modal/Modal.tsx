import { useEffect, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

export interface ModalProps {
  isOpen: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  /** Optional element rendered into the panel header bar, right of title. */
  headerRight?: ReactNode;
  /** Max-width Tailwind class — defaults to max-w-md. */
  widthClass?: string;
  /** Aria label for the close button. */
  closeLabel?: string;
}

/**
 * Minimal accessible modal primitive used by InstallDrawer and
 * PublishDialog. Implements:
 *  - fixed backdrop + centered panel
 *  - Escape-to-close key handler
 *  - click on backdrop closes
 *  - body scroll lock while open
 *  - dark-mode minimalist styling per the design system spec
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  headerRight,
  widthClass = "max-w-md",
  closeLabel = "Close",
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={
          "w-full mx-4 mt-12 bg-[#161618] border border-white/[0.06] rounded-[10px] p-8 " +
          widthClass
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-lg font-medium tracking-tight text-[#E8E8E6]">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] p-1.5 text-[#8A8A86] transition-transform hover:scale-[0.98] hover:text-[#E8E8E6]"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
