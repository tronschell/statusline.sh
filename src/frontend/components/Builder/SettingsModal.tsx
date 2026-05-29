import { useEffect, useRef, useState } from "react";
import {
  ArrowsHorizontal,
  CaretLeft,
  CaretRight,
  Palette,
  UploadSimple,
} from "@phosphor-icons/react";
import Modal from "../Modal/Modal";
import { useDesignStore } from "../../store/designStore";
import { safeValidateDesign } from "@statusline/shared/schema";
import SpacingSettings from "./SpacingSettings";
import ThemePresets from "../Inspector/ThemePresets";

type View = "hub" | "spacing" | "themes" | "import";

const TITLES: Record<View, string> = {
  hub: "Settings",
  spacing: "Spacing between elements",
  themes: "Theme presets",
  import: "Import design",
};

export interface SettingsModalProps {
  isOpen: boolean;
  onClose(): void;
  /** Template id the builder was seeded from, if any (drives re-space copy). */
  templateId: string | null;
  /** Human-readable template name for the re-space section. */
  templateName: string | null;
}

const ROWS: ReadonlyArray<{
  view: Exclude<View, "hub">;
  label: string;
  description: string;
  Icon: typeof ArrowsHorizontal;
}> = [
  {
    view: "spacing",
    label: "Spacing",
    description: "Auto-insert padding, spacers or separators between elements.",
    Icon: ArrowsHorizontal,
  },
  {
    view: "themes",
    label: "Themes",
    description: "Recolor every element from a curated preset.",
    Icon: Palette,
  },
  {
    view: "import",
    label: "Import",
    description: "Load a design from an exported JSON file.",
    Icon: UploadSimple,
  },
];

/**
 * Settings hub modal. The single TopBar "Settings" entry point routes into
 * Spacing, Themes, and Import subpages. `view` resets to the hub whenever the
 * modal (re)opens; the shared `<Modal>` title is driven by `view`.
 */
export default function SettingsModal({
  isOpen,
  onClose,
  templateId,
  templateName,
}: SettingsModalProps) {
  const [view, setView] = useState<View>("hub");

  const importDesign = useDesignStore((s) => s.importDesign);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  // Always return to the hub when the modal is (re)opened, and clear any
  // stale import feedback.
  useEffect(() => {
    if (isOpen) {
      setView("hub");
      setImportError(null);
      setImported(false);
    }
  }, [isOpen]);

  function onImportClick() {
    setImportError(null);
    setImported(false);
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
      setImported(true);
    } catch (err) {
      setImportError(`Could not read file: ${(err as Error).message}`);
    }
  }

  const backToHub = (
    <button
      type="button"
      onClick={() => setView("hub")}
      className="flex items-center gap-1 text-xs uppercase tracking-wider text-[#8A8A86] transition-colors hover:text-[#E8E8E6]"
    >
      <CaretLeft size={12} weight="bold" />
      Settings
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={TITLES[view]}
      aboveTitle={view === "hub" ? undefined : backToHub}
      widthClass="max-w-xl"
    >
      {view === "hub" && (
        <div className="flex flex-col gap-2">
          {ROWS.map(({ view: target, label, description, Icon }) => (
            <button
              key={target}
              type="button"
              onClick={() => {
                if (target === "import") {
                  setImportError(null);
                  setImported(false);
                }
                setView(target);
              }}
              className="flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-[#1C1C1F] px-4 py-3 text-left transition-colors hover:border-white/[0.16]"
            >
              <Icon size={18} weight="bold" className="shrink-0 text-[#E8E8E6]" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-[#E8E8E6]">{label}</span>
                <span className="text-[11px] leading-snug text-[#8A8A86]">
                  {description}
                </span>
              </span>
              <CaretRight size={14} weight="bold" className="shrink-0 text-[#8A8A86]" />
            </button>
          ))}
        </div>
      )}

      {view === "spacing" && (
        <SpacingSettings templateId={templateId} templateName={templateName} />
      )}

      {view === "themes" && <ThemePresets onClose={() => setView("hub")} />}

      {view === "import" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-[#A8A8A4]">
            Load a design from an exported JSON file. This replaces your
            current design — use Cmd/Ctrl+Z afterwards if you want to revert.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <div>
            <button
              type="button"
              onClick={onImportClick}
              className="flex items-center gap-1.5 rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98]"
            >
              <UploadSimple size={12} weight="bold" />
              Choose JSON file
            </button>
          </div>
          {importError && (
            <p className="text-xs text-[#E8A08A]" role="alert">
              {importError}
            </p>
          )}
          {imported && !importError && (
            <p className="text-xs text-[#8FB8DA]" role="status">
              Design imported.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
