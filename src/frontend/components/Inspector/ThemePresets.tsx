import { useEffect, useId, useState } from "react";
import { useDesignStore } from "../../store/designStore";
import { THEME_PRESETS, type ThemePreset } from "../../themes/presets";

interface ThemePresetsProps {
  /** Called after a preset is applied (typically to close the host modal). */
  onClose?: () => void;
}

/**
 * Theme-preset picker. Renders a card grid of curated color schemes;
 * clicking a card opens a minimal confirm modal warning that every
 * element's foreground color will be overwritten. Apply goes through
 * `applyThemePreset` (wrapped in `withHistory` so Cmd/Ctrl+Z restores
 * prior colors).
 */
export default function ThemePresets({ onClose }: ThemePresetsProps) {
  const applyThemePreset = useDesignStore((s) => s.applyThemePreset);
  const elementCount = useDesignStore((s) => s.design.elements.length);
  const [pending, setPending] = useState<ThemePreset | null>(null);

  const titleId = useId();
  const descId = useId();

  const disabled = elementCount === 0;

  const onConfirm = () => {
    if (!pending) return;
    applyThemePreset(pending.id);
    setPending(null);
    onClose?.();
  };

  // Escape dismisses the confirm modal. Bound only while open so it
  // doesn't compete with other global escape handlers.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  return (
    <section aria-label="Theme presets" className="flex flex-col gap-3">
      <p className="m-0 text-[12px] leading-snug text-[var(--color-text-muted)]">
        Recolors every element. Use Cmd/Ctrl+Z to revert.
      </p>

      {disabled && (
        <p className="m-0 text-[11px] leading-snug text-[var(--color-text-muted)]/80">
          Add elements to apply a theme.
        </p>
      )}

      <div
        className={[
          "grid gap-2 grid-cols-1 sm:grid-cols-2",
          disabled ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPending(preset)}
            disabled={disabled}
            aria-label={`Apply ${preset.name} theme`}
            className={[
              "group flex flex-col gap-2 rounded-[10px] border border-[var(--color-border)]",
              "bg-[var(--color-surface-2)] px-3 py-3 text-left",
              "transition-colors hover:border-[var(--color-text-muted)]/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--color-border)]",
            ].join(" ")}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-tight text-[var(--color-text)]">
                {preset.name}
              </span>
              <span className="text-[11px] leading-snug text-[var(--color-text-muted)]">
                {preset.description}
              </span>
            </div>
            <span
              className="flex w-full overflow-hidden rounded-[3px]"
              aria-hidden="true"
            >
              {preset.swatch.map((c, i) => (
                <span
                  key={i}
                  className="block h-2 flex-1"
                  style={{ background: c }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setPending(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <h3
              id={titleId}
              className="editorial m-0 text-xl text-[var(--color-text)]"
            >
              Apply {pending.name}?
            </h3>
            <p
              id={descId}
              className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]"
            >
              Overwrites the foreground color on every element. Undo with
              Cmd/Ctrl+Z.
            </p>
            <div className="mt-6 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-[6px] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-[6px] bg-[#F26B1D] px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-[#E55E15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B1D]/50"
              >
                Apply theme
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
