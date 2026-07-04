import type { Design } from "@statusline/shared/types";

/**
 * Turn a design name into a safe download filename stem (no extension).
 * Strips path-hostile characters and collapses whitespace to dashes.
 * Falls back to "statusline" when nothing usable remains.
 */
export function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const cleaned = trimmed.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return cleaned.length ? cleaned : "statusline";
}

/**
 * Download a design as a pretty-printed JSON file. When `name` is provided it
 * overrides the design's own name in both the payload and the filename.
 * Performs the Blob → object URL → anchor click → revoke dance.
 */
export function exportDesignAsJson(design: Design, name?: string): void {
  const exportName = (name ?? design.name ?? "").trim() || "statusline";
  const payload = { ...design, name: exportName };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(exportName)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
