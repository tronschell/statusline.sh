import type { ReactNode } from "react";

export interface TerminalFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * Faux macOS terminal chrome.
 *
 * Three small light-gray traffic-light circles in the top-left of a slim
 * header bar, body uses font-mono for ANSI preview content. Dark-mode
 * minimalist aesthetic per the design system spec.
 */
export function TerminalFrame({ children, className }: TerminalFrameProps) {
  return (
    <div
      className={
        "bg-[#0E0E10] border border-white/[0.06] rounded-[10px] overflow-hidden" +
        (className ? " " + className : "")
      }
    >
      <div className="flex items-center gap-[6px] px-4 py-2.5 border-b border-white/[0.04]">
        <span className="block w-[10px] h-[10px] rounded-full bg-white/15" />
        <span className="block w-[10px] h-[10px] rounded-full bg-white/15" />
        <span className="block w-[10px] h-[10px] rounded-full bg-white/15" />
      </div>
      <div className="font-mono text-sm px-5 py-4 text-[#E8E8E6] overflow-x-auto whitespace-nowrap">
        {children}
      </div>
    </div>
  );
}
