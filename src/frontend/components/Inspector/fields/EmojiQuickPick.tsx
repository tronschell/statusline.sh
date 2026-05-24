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
      <span className="text-[11px] uppercase tracking-wider text-[#8A8A86]/80">
        {label}
      </span>
      <div className="grid grid-cols-8 gap-1">
        {COMMON_EMOJIS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="flex items-center justify-center h-7 rounded-[4px] border border-white/[0.04] bg-[#1C1C1F] text-sm text-[#E8E8E6] transition-colors hover:border-white/[0.16] hover:bg-[#22222A]"
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
