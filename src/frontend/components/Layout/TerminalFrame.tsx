import type { ReactNode } from "react";

export interface TerminalFrameProps {
  children: ReactNode;
  className?: string;
  /**
   * Terminal body theme. `"dark"` (default) keeps the near-black canvas used
   * everywhere (hero, template cards); `"light"` swaps to a paper background so
   * the builder can preview how a statusline reads on a light terminal. Only
   * the frame's own background + default text colour change — the rendered
   * ANSI content keeps its own colours.
   */
  theme?: "dark" | "light";
}

/**
 * Faux macOS terminal chrome.
 *
 * Three small light-gray traffic-light circles in the top-left of a slim
 * header bar, body uses font-mono for ANSI preview content. Dark-mode
 * minimalist aesthetic per the design system spec.
 */
export function TerminalFrame({ children, className, theme = "dark" }: TerminalFrameProps) {
  const isLight = theme === "light";
  // Inline styles (not dynamic Tailwind arbitrary values, which the JIT can't
  // see) so the swap is reliable in the built bundle.
  const bg = isLight ? "#F5F5F3" : "#0E0E10";
  const fg = isLight ? "#1A1A18" : "#E8E8E6";
  return (
    <div
      className={
        "border border-white/[0.06] rounded-[10px] overflow-hidden" +
        (className ? " " + className : "")
      }
      style={{ background: bg }}
    >
      <div className="group flex items-center gap-[6px] px-4 py-2.5 border-b border-white/[0.04]">
        <span className="block w-[10px] h-[10px] rounded-full bg-white/15 transition-colors duration-200 group-hover:bg-[#FF5F57]" />
        <span className="block w-[10px] h-[10px] rounded-full bg-white/15 transition-colors duration-200 group-hover:bg-[#FEBC2E]" />
        <span className="block w-[10px] h-[10px] rounded-full bg-white/15 transition-colors duration-200 group-hover:bg-[#28C840]" />
      </div>
      <div
        className="font-mono text-sm px-5 py-4 overflow-x-auto whitespace-nowrap"
        style={{ color: fg }}
      >
        {children}
      </div>
    </div>
  );
}
