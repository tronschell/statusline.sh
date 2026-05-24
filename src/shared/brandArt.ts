/**
 * Single source of truth for the "statusline.sh" brand ASCII art.
 *
 * Used by:
 *   - server/install/bashTemplate.ts (success/warn/error banner)
 *   - server/install/psTemplate.ts   (same, three colored states)
 *   - frontend/components/Brand/BrandArt.tsx (rendered in NavBar, hero, modals)
 *
 * Figlet "Standard" font, 5 rows, ~63 cols wide.
 *
 * Backslashes are double-escaped because Bun's parser rejects unknown
 * single-char escapes (e.g. `\_`) even inside `String.raw` templates.
 */
export const BRAND_ART_LINES: readonly string[] = [
  "      _        _             _ _                  _",
  "  ___| |_ __ _| |_ _   _ ___| (_)_ __   ___   ___| |__",
  " / __| __/ _` | __| | | / __| | | '_ \\ / _ \\ / __| '_ \\",
  " \\__ \\ || (_| | |_| |_| \\__ \\ | | | | |  __/_\\__ \\ | | |",
  " |___/\\__\\__,_|\\__|\\__,_|___/_|_|_| |_|\\___(_)___/_| |_|",
];

export const BRAND_ART_STATUSLINE_SH = BRAND_ART_LINES.join("\n");

export const BRAND_NAME = "statusline.sh" as const;
