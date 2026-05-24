import { useId, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

export interface CollapsibleProps {
  title: string;
  /** When provided, summary text rendered to the right of the title (e.g. an active-condition pill or live preview). */
  summary?: ReactNode;
  /** Trailing action rendered inline in the trigger (right-aligned). Stops propagation so it doesn't toggle. */
  trailing?: ReactNode;
  /** Whether the panel is open initially (uncontrolled). Defaults to false. */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Notifies parent of state changes. Pass with `open` for controlled mode. */
  onOpenChange?: (next: boolean) => void;
  /** Render the content with extra padding/background. Defaults to "card". */
  variant?: "card" | "flush";
  /** Visual emphasis of the trigger row. */
  density?: "default" | "compact";
  children: ReactNode;
}

/**
 * Accessible disclosure widget. The trigger is a real <button> with
 * aria-expanded + aria-controls, the panel is hidden via the `hidden`
 * attribute (no display:none games) so screen readers honor expansion
 * state. Caret rotates via CSS for a subtle reveal cue without animating
 * layout (which would jank when nested pickers expand).
 */
export default function Collapsible({
  title,
  summary,
  trailing,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  variant = "card",
  density = "default",
  children,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const panelId = useId();
  const triggerId = useId();

  const pad = density === "compact" ? "px-2 py-1.5" : "px-3 py-2";

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 flex">
        <button
          id={triggerId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={`flex w-full items-center gap-2 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-2)] ${pad} text-left transition-colors hover:border-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40`}
        >
          <CaretDown
            size={12}
            weight="bold"
            className={`shrink-0 text-[var(--color-text-muted)] transition-transform duration-150 ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            {title}
          </span>
          {summary !== undefined && (
            <span className="ml-auto flex items-center gap-2">{summary}</span>
          )}
          {trailing !== undefined && (
            <span
              className="flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {trailing}
            </span>
          )}
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className={
          variant === "card"
            ? "flex flex-col gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            : "flex flex-col gap-3"
        }
      >
        {open && children}
      </div>
    </section>
  );
}
