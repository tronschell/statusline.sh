import { useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  UploadSimple,
  DownloadSimple,
  Globe,
} from "@phosphor-icons/react";
import { useDesignStore } from "../../store/designStore";
import { api } from "../../lib/api";
import { safeValidateDesign } from "../../../shared/schema";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";

export interface TopBarProps {
  designId: string | null;
  slug: string | null;
  onSaveShare(id: string): void;
  onOpenPublish(): void;
}

const btnBase =
  "flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary =
  "flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#E8E8E6] px-3 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

function shortIdLabel(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const cleaned = trimmed.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return cleaned.length ? cleaned : "statusline";
}

export default function TopBar({
  designId,
  slug,
  onSaveShare,
  onOpenPublish,
}: TopBarProps) {
  const design = useDesignStore((s) => s.design);
  const setName = useDesignStore((s) => s.setName);
  const importDesign = useDesignStore((s) => s.importDesign);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const past = useDesignStore((s) => s.past);
  const future = useDesignStore((s) => s.future);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function onSave() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { id } = await api.createDesign(design);
      onSaveShare(id);
    } catch (e) {
      setSaveError((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function onExport() {
    const blob = new Blob([JSON.stringify(design, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(design.name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = safeValidateDesign(parsed);
      if (!result.ok) {
        setImportError(`Invalid design: ${result.error.message}`);
        return;
      }
      importDesign(result.design);
      setImportError(null);
    } catch (err) {
      setImportError(`Could not read file: ${(err as Error).message}`);
    }
  }

  const status: string = designId
    ? slug
      ? `Published as ${shortIdLabel(designId)}`
      : `Saved as ${shortIdLabel(designId)}`
    : "Unsaved";

  return (
    <div className="sticky top-0 z-30 -mx-8 mb-6 border-b border-white/[0.06] bg-[#0E0E10]/85 px-8 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            type="text"
            value={design.name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Design name"
            placeholder="Untitled"
            className="min-w-0 flex-1 max-w-xs bg-transparent border-b border-transparent px-1 py-1 text-sm font-medium text-[#E8E8E6] focus:border-white/[0.12] focus:outline-none"
          />
        </div>

        <div className="hidden text-xs text-[#8A8A86] sm:block" aria-live="polite">
          {status}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            aria-label="Undo"
            title="Undo (Cmd/Ctrl+Z)"
            className={btnBase}
          >
            <ArrowCounterClockwise size={12} weight="bold" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Redo"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            className={btnBase}
          >
            <ArrowClockwise size={12} weight="bold" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <button
            type="button"
            onClick={onImportClick}
            className={btnBase}
            aria-label="Import design"
          >
            <UploadSimple size={12} weight="bold" />
            Import
          </button>
          <button
            type="button"
            onClick={onExport}
            className={btnBase}
            aria-label="Export design"
          >
            <DownloadSimple size={12} weight="bold" />
            Export
          </button>

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className={btnPrimary}
            aria-label="Install in Claude Code"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                Install in
                <ClaudeCodeLogo size={12} className="ml-0.5" />
                Claude Code
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenPublish}
            className={btnBase}
            aria-label="Publish to community"
          >
            <Globe size={12} weight="bold" />
            Publish
          </button>
        </div>
      </div>
      {(importError || saveError) && (
        <p className="mt-2 text-xs text-[#E8A08A]" role="alert">
          {importError || saveError}
        </p>
      )}
    </div>
  );
}
