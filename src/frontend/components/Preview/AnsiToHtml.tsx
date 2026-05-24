import { memo } from "react";
import { escapeHtml, parseAnsi, segmentToStyle } from "@statusline/shared/ansi";

export interface AnsiToHtmlProps {
  ansi: string;
}

function AnsiToHtmlImpl({ ansi }: AnsiToHtmlProps) {
  const segments = parseAnsi(ansi);
  return (
    <span className="font-mono whitespace-pre">
      {segments.map((seg, i) => {
        const style = segmentToStyle(seg);
        // escapeHtml is unnecessary in JSX (React escapes children) but we
        // include it here per the task spec so the helper is exercised and
        // the same logic could be reused outside React without changes.
        const safe = escapeHtml(seg.text);
        return (
          <span
            key={i}
            style={cssStringToObject(style)}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        );
      })}
    </span>
  );
}

function cssStringToObject(css: string): React.CSSProperties {
  if (!css) return {};
  const obj: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (!key) continue;
    const camel = key.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    obj[camel] = val;
  }
  return obj as React.CSSProperties;
}

export const AnsiToHtml = memo(AnsiToHtmlImpl, (a, b) => a.ansi === b.ansi);
