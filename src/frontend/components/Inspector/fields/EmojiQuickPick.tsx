const COMMON_EMOJIS = [
  "✨", "⚡", "🔥", "🌙", "⭐", "💎", "🌈", "🚀",
  "🎯", "🎨", "🎵", "🤖", "🐙", "🐱", "🦊", "🦄",
  "☕", "🌸", "❤️", "💙", "💚", "💛", "💜", "🖤",
  "✓", "✗", "▸", "◆", "●", "○", "♦", "★",
] as const;

export interface EmojiQuickPickProps {
  onPick: (emoji: string) => void;
  /** Optional label rendered above the row. Defaults to "Quick pick". */
  label?: string;
}

/**
 * Compact 8-column grid of common statusline glyphs / emojis. Clicking one
 * fires onPick(char) so callers can append to a text field or replace a
 * single-char glyph.
 */
export function EmojiQuickPick({ onPick, label = "Quick pick" }: EmojiQuickPickProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[#8A8A86]">
        {label}
      </span>
      <div className="grid grid-cols-8 gap-1">
        {COMMON_EMOJIS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="flex h-7 items-center justify-center rounded-[6px] text-sm text-[#E8E8E6] transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40"
            aria-label={`Insert ${c}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiQuickPick;
