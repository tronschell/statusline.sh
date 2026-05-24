import { useMemo } from "react";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { ClaudeStdin, Design } from "@statusline/shared/types";
import { TerminalFrame } from "../Layout/TerminalFrame";
import { AnsiToHtml } from "./AnsiToHtml";

export interface StaticPreviewProps {
  design: Design;
  mock?: ClaudeStdin;
  className?: string;
}

export function StaticPreview({ design, mock, className }: StaticPreviewProps) {
  const ansi = useMemo(() => {
    try {
      return renderToAnsi(design, mock ?? DEFAULT_MOCK_STDIN);
    } catch (e) {
      return `[render error: ${e instanceof Error ? e.message : String(e)}]`;
    }
  }, [design, mock]);
  return (
    <TerminalFrame className={className}>
      <AnsiToHtml ansi={ansi} />
    </TerminalFrame>
  );
}
